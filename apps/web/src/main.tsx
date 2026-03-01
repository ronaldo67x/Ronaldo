import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { API_BASE_PATH, QUIZ_CATEGORIES } from '@ronaldo/shared';
import { attachAntiCheatGuards } from './runtime/antiCheat';
import { progressAnimationStyle } from './runtime/motion';
import {
  autosaveAnswer,
  readSessionLocally,
  restoreSession,
  saveSessionLocally,
} from './runtime/session';
import { createTimerState, formatClock, type TimerMode } from './runtime/timers';
import {
  getContrastRatio,
  Mode,
  PresetName,
  THEME_PRESETS,
  toCssVariables,
  wcagResult,
} from './designTokens';
import './styles.css';

type Preferences = {
  mode: Mode;
  preset: PresetName;
  customPrimary: string;
  customAccent: string;
  syncProfile: boolean;
};

const STORAGE_KEY = 'ronaldo.theme.preferences.v1';

const questionSteps = [
  'Question stem',
  'Answer choices',
  'Timer settings',
  'Scoring rules',
  'Review behavior',
];

const runtimeChoices = ['Choice A', 'Choice B', 'Choice C', 'Choice D'];

const runtimeQuestionIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];
const globalTimerLimitMs = 5 * 60 * 1000;
const perQuestionLimitMs = 45 * 1000;

const defaultPreferences: Preferences = {
  mode: 'light',
  preset: 'ocean',
  customPrimary: THEME_PRESETS.ocean.light.primary,
  customAccent: THEME_PRESETS.ocean.light.accent,
  syncProfile: false,
};

const readStoredPreferences = (): Preferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...defaultPreferences,
      ...parsed,
    };
  } catch {
    return defaultPreferences;
  }
};

const applyTheme = (preferences: Preferences) => {
  const variables = toCssVariables(preferences.mode, preferences.preset, {
    primary: preferences.customPrimary,
    accent: preferences.customAccent,
  });

  Object.entries(variables).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });

  document.documentElement.dataset.theme = preferences.mode;
};

const App = () => {
  const [preferences, setPreferences] = useState<Preferences>(readStoredPreferences);
  const [syncStatus, setSyncStatus] = useState('Sync disabled');
  const [builderIndex, setBuilderIndex] = useState(0);
  const [runtimeIndex, setRuntimeIndex] = useState(0);
  const [runtimeSelection, setRuntimeSelection] = useState(runtimeChoices[0]);
  const [timerMode, setTimerMode] = useState<TimerMode>('global');
  const [attemptId, setAttemptId] = useState('local-demo-attempt');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [violationMessage, setViolationMessage] = useState('No violations detected');

  const builderRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const proctoringZoneRef = useRef<HTMLDivElement | null>(null);
  const runtimeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activePalette = useMemo(
    () => ({
      ...THEME_PRESETS[preferences.preset][preferences.mode],
      primary: preferences.customPrimary,
      accent: preferences.customAccent,
    }),
    [preferences],
  );

  const contrastChecks = useMemo(() => {
    const bodyText = wcagResult(getContrastRatio(activePalette.text, activePalette.surface));
    const primaryOnSurface = wcagResult(
      getContrastRatio(activePalette.primary, activePalette.surface),
      true,
    );
    const accentOnSurface = wcagResult(
      getContrastRatio(activePalette.accent, activePalette.surface),
      true,
    );

    return [
      { name: 'Body text on surface', ...bodyText },
      { name: 'Primary on surface (large text)', ...primaryOnSurface },
      { name: 'Accent on surface (large text)', ...accentOnSurface },
    ];
  }, [activePalette]);

  useEffect(() => {
    applyTheme(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (!preferences.syncProfile) {
      setSyncStatus('Sync disabled');
      return;
    }

    const syncProfile = async () => {
      try {
        setSyncStatus('Syncing theme profile...');
        const response = await fetch(`${API_BASE_PATH}/profile/theme`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences),
        });

        if (!response.ok) {
          throw new Error(`Profile sync failed with status ${response.status}`);
        }

        setSyncStatus('Theme synced to backend profile');
      } catch {
        setSyncStatus('Backend sync unavailable (preferences still saved locally)');
      }
    };

    void syncProfile();
  }, [preferences]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedMs((current) => current + 1000);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const storedSession = readSessionLocally();
    if (!storedSession) {
      return;
    }

    setAttemptId(storedSession.attemptId);
    void restoreSession(storedSession.attemptId).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!proctoringZoneRef.current) {
      return;
    }

    return attachAntiCheatGuards(
      attemptId,
      {
        blockCopy: true,
        blockPaste: true,
        maxFocusLossEvents: 3,
      },
      proctoringZoneRef.current,
      setViolationMessage,
    );
  }, [attemptId]);

  const updatePreferences = (patch: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  };

  const onBuilderKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (index + 1) % questionSteps.length;
      setBuilderIndex(next);
      builderRefs.current[next]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (index - 1 + questionSteps.length) % questionSteps.length;
      setBuilderIndex(next);
      builderRefs.current[next]?.focus();
    }
  };

  const onRuntimeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (index + 1) % runtimeChoices.length;
      setRuntimeIndex(next);
      runtimeRefs.current[next]?.focus();
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (index - 1 + runtimeChoices.length) % runtimeChoices.length;
      setRuntimeIndex(next);
      runtimeRefs.current[next]?.focus();
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      setRuntimeSelection(runtimeChoices[index]);
    }
  };

  const activeLimitMs = timerMode === 'global' ? globalTimerLimitMs : perQuestionLimitMs;
  const timerState = createTimerState(timerMode, elapsedMs, activeLimitMs);

  const onRuntimeAnswerSelection = (questionId: string, choice: string, index: number) => {
    setRuntimeSelection(choice);
    void autosaveAnswer(attemptId, questionId, index).catch(() => undefined);
    saveSessionLocally({
      attemptId,
      answers: { [questionId]: index },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <main>
      <section className="panel grid" aria-label="Theme system overview">
        <h1>Design token system</h1>
        <p>
          Includes palette, typography, spacing, radius, and shadow tokens with light/dark variants.
          Preferences persist locally with optional backend profile sync.
        </p>
        <div className="token-preview">
          {[
            ['Primary', activePalette.primary],
            ['Accent', activePalette.accent],
            ['Surface', activePalette.surface],
            ['Success', activePalette.success],
            ['Warning', activePalette.warning],
            ['Danger', activePalette.danger],
          ].map(([label, color]) => (
            <div key={label} className="token-card">
              <div
                className="swatch"
                style={{ background: color }}
                aria-label={`${label} token swatch`}
              />
              <strong>{label}</strong>
              <div className="small">{color}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel grid two" aria-label="Theme controls and accessibility checks">
        <div className="grid">
          <h2>User-selectable themes</h2>
          <label>
            Theme mode
            <select
              aria-label="Theme mode selector"
              value={preferences.mode}
              onChange={(event) => updatePreferences({ mode: event.target.value as Mode })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <label>
            Theme preset
            <select
              aria-label="Theme preset selector"
              value={preferences.preset}
              onChange={(event) => {
                const nextPreset = event.target.value as PresetName;
                updatePreferences({
                  preset: nextPreset,
                  customPrimary: THEME_PRESETS[nextPreset][preferences.mode].primary,
                  customAccent: THEME_PRESETS[nextPreset][preferences.mode].accent,
                });
              }}
            >
              <option value="ocean">Ocean</option>
              <option value="sunset">Sunset</option>
              <option value="forest">Forest</option>
            </select>
          </label>

          <label>
            Primary color override
            <input
              type="color"
              aria-label="Primary color picker"
              value={preferences.customPrimary}
              onChange={(event) => updatePreferences({ customPrimary: event.target.value })}
            />
          </label>

          <label>
            Accent color override
            <input
              type="color"
              aria-label="Accent color picker"
              value={preferences.customAccent}
              onChange={(event) => updatePreferences({ customAccent: event.target.value })}
            />
          </label>

          <label>
            <input
              type="checkbox"
              aria-label="Enable backend profile sync"
              checked={preferences.syncProfile}
              onChange={(event) => updatePreferences({ syncProfile: event.target.checked })}
            />
            Enable backend profile sync
          </label>
          <p className="small">{syncStatus}</p>
        </div>

        <div className="grid">
          <h2>WCAG contrast guardrails</h2>
          {contrastChecks.map((check) => (
            <div key={check.name} className={`status ${check.passes ? 'pass' : 'fail'}`}>
              {check.name}: {check.ratio.toFixed(2)}:1 — {check.level}
            </div>
          ))}
          <p className="small">
            Guardrail target: AA for normal text (4.5:1) and large text (3:1).
          </p>
        </div>
      </section>

      <section className="panel grid two" aria-label="Keyboard accessibility examples">
        <div className="grid">
          <h2>Quiz builder keyboard navigation</h2>
          <p className="small">
            Use Arrow Up/Down to move between builder steps. Enter activates a step.
          </p>
          <div className="listbox" role="listbox" aria-label="Quiz builder steps">
            {questionSteps.map((step, index) => (
              <button
                key={step}
                ref={(element) => {
                  builderRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-label={`Builder step ${step}`}
                aria-selected={builderIndex === index}
                className={`list-option ${builderIndex === index ? 'active' : ''}`}
                tabIndex={builderIndex === index ? 0 : -1}
                onFocus={() => setBuilderIndex(index)}
                onKeyDown={(event) => onBuilderKeyDown(event, index)}
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        <div className="grid">
          <h2>Quiz runtime keyboard navigation</h2>
          <p className="small">Use Arrow keys to move. Press Space/Enter to choose an answer.</p>
          <div className="listbox" role="radiogroup" aria-label="Quiz answer options">
            {runtimeChoices.map((choice, index) => (
              <button
                key={choice}
                ref={(element) => {
                  runtimeRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-label={`Select ${choice}`}
                aria-checked={runtimeSelection === choice}
                className={`list-option ${runtimeSelection === choice ? 'active' : ''}`}
                tabIndex={runtimeIndex === index ? 0 : -1}
                onFocus={() => setRuntimeIndex(index)}
                onKeyDown={(event) => onRuntimeKeyDown(event, index)}
                onClick={() => {
                  setRuntimeIndex(index);
                  onRuntimeAnswerSelection(runtimeQuestionIds[index]!, choice, index);
                }}
              >
                {choice}
              </button>
            ))}
          </div>
          <p className="small">Current answer: {runtimeSelection}</p>
        </div>
      </section>

      <section
        className="panel grid"
        aria-label="Runtime controls for timer, autosave, and anti-cheat"
      >
        <h2>Quiz runtime modules</h2>
        <div className="grid two">
          <div className="grid">
            <label>
              Timer mode
              <select
                value={timerMode}
                onChange={(event) => setTimerMode(event.target.value as TimerMode)}
              >
                <option value="global">Global quiz timer</option>
                <option value="per-question">Per-question timer</option>
              </select>
            </label>
            <div className="timer-track" aria-label="Runtime timer progress">
              <div className="timer-fill" style={progressAnimationStyle(timerState.progress)} />
            </div>
            <p className="small">
              {timerMode === 'global' ? 'Global' : 'Per-question'} time remaining:{' '}
              {formatClock(timerState.remainingMs)}
            </p>
          </div>

          <div className="grid" ref={proctoringZoneRef}>
            <h3>Proctoring / anti-cheat</h3>
            <p className="small">
              Tab switching, blur, copy, and paste are logged to attempt events.
            </p>
            <p className="small">Latest policy signal: {violationMessage}</p>
            <p className="small">Autosave + reconnect session id: {attemptId}</p>
          </div>
        </div>
      </section>

      <section className="panel grid" aria-label="Shared package info">
        <h3>Supported Categories</h3>
        <div className="swatches">
          {QUIZ_CATEGORIES.map((category) => (
            <span key={category} className="token-card" aria-label={`Quiz category ${category}`}>
              {category}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
