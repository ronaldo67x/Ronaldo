import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { API_BASE_PATH, QUIZ_CATEGORIES, scoreAttempt, type Quiz } from '@ronaldo/shared';
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

type AttemptBootstrap = {
  attemptId: string;
  questionOrder: string[];
  optionOrderByQuestion: Record<string, number[]>;
};

const STORAGE_KEY = 'ronaldo.theme.preferences.v1';

const questionSteps = [
  'Question stem',
  'Answer choices',
  'Timer settings',
  'Scoring rules',
  'Review behavior',
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

const demoQuizPayload = {
  title: 'Demo quiz: podstawy fizyki',
  difficulty: 'easy' as const,
  questions: [
    {
      id: crypto.randomUUID(),
      type: 'objective' as const,
      category: 'science' as const,
      prompt: 'Która jednostka SI opisuje siłę?',
      choices: ['Wat', 'Newton', 'Dżul', 'Wolt'],
      answerIndex: 1,
    },
    {
      id: crypto.randomUUID(),
      type: 'objective' as const,
      category: 'science' as const,
      prompt: 'Jaka jest przybliżona wartość przyspieszenia ziemskiego?',
      choices: ['9.81 m/s²', '1.62 m/s²', '24.79 m/s²', '3.71 m/s²'],
      answerIndex: 0,
    },
    {
      id: crypto.randomUUID(),
      type: 'objective' as const,
      category: 'science' as const,
      prompt: 'Która wielkość opisuje opór elektryczny?',
      choices: ['Amper (A)', 'Om (Ω)', 'Tesla (T)', 'Farad (F)'],
      answerIndex: 1,
    },
  ],
};

const App = () => {
  const [preferences, setPreferences] = useState<Preferences>(readStoredPreferences);
  const [syncStatus, setSyncStatus] = useState('Sync disabled');
  const [builderIndex, setBuilderIndex] = useState(0);
  const [runtimeIndex, setRuntimeIndex] = useState(0);
  const [runtimeQuestionIndex, setRuntimeQuestionIndex] = useState(0);
  const [timerMode, setTimerMode] = useState<TimerMode>('global');
  const [attemptId, setAttemptId] = useState('local-demo-attempt');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [violationMessage, setViolationMessage] = useState('No violations detected');
  const [instructorQuizId, setInstructorQuizId] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attemptBootstrap, setAttemptBootstrap] = useState<AttemptBootstrap | null>(null);
  const [runtimeAnswers, setRuntimeAnswers] = useState<Record<string, number>>({});
  const [runtimeStatus, setRuntimeStatus] = useState('Ładowanie demo quizu...');
  const [submittedScore, setSubmittedScore] = useState<null | {
    total: number;
    correct: number;
    percent: number;
  }>(null);
  const [instructorMetrics, setInstructorMetrics] = useState<null | {
    attemptCount: number;
    completionRate: number;
    timingDistributionMs: number[];
    perQuestion: Array<{
      questionId: string;
      heuristicDifficulty: number;
      heuristicDiscrimination: number;
    }>;
  }>(null);

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

  const orderedQuestions = useMemo(() => {
    if (!quiz || !attemptBootstrap) {
      return [];
    }
    return attemptBootstrap.questionOrder
      .map((id) => quiz.questions.find((question) => question.id === id))
      .filter((question): question is NonNullable<typeof question> => Boolean(question));
  }, [quiz, attemptBootstrap]);

  const activeQuestion = orderedQuestions[runtimeQuestionIndex];
  const runtimeOptions = useMemo(() => {
    if (!activeQuestion || activeQuestion.type !== 'objective' || !attemptBootstrap) {
      return [] as Array<{ label: string; originalIndex: number }>;
    }

    const optionOrder = attemptBootstrap.optionOrderByQuestion[activeQuestion.id];
    if (!optionOrder) {
      return activeQuestion.choices.map((label, originalIndex) => ({ label, originalIndex }));
    }

    return optionOrder.map((originalIndex) => ({
      label: activeQuestion.choices[originalIndex] ?? '—',
      originalIndex,
    }));
  }, [activeQuestion, attemptBootstrap]);

  const answeredCount = useMemo(() => Object.keys(runtimeAnswers).length, [runtimeAnswers]);

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
    setRuntimeAnswers(storedSession.answers);
    void restoreSession(storedSession.attemptId).catch(() => undefined);
  }, []);

  useEffect(() => {
    const bootstrapRuntime = async () => {
      try {
        setRuntimeStatus('Tworzę/odnajduję demo quiz...');
        const quizzesResponse = await fetch(`${API_BASE_PATH}/quizzes`);
        if (!quizzesResponse.ok) {
          throw new Error(`Quiz list fetch failed (${quizzesResponse.status})`);
        }
        const quizzesPayload = (await quizzesResponse.json()) as { data: Quiz[] };
        let selectedQuiz = quizzesPayload.data.find(
          (entry) => entry.title === demoQuizPayload.title,
        );

        if (!selectedQuiz) {
          const createResponse = await fetch(`${API_BASE_PATH}/quizzes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(demoQuizPayload),
          });
          if (!createResponse.ok) {
            throw new Error(`Quiz create failed (${createResponse.status})`);
          }
          const createdPayload = (await createResponse.json()) as { data: Quiz };
          selectedQuiz = createdPayload.data;
        }

        setQuiz(selectedQuiz);
        setInstructorQuizId(selectedQuiz.id);

        const startResponse = await fetch(`${API_BASE_PATH}/attempts/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizId: selectedQuiz.id,
            participantId: `demo-${crypto.randomUUID().slice(0, 8)}`,
            timingMode: 'global',
            globalTimeLimitMs: globalTimerLimitMs,
            antiCheatPolicy: {
              blockCopy: true,
              blockPaste: true,
              maxFocusLossEvents: 3,
            },
            randomizeQuestionOrder: true,
            randomizeOptionOrder: true,
          }),
        });

        if (!startResponse.ok) {
          throw new Error(`Attempt start failed (${startResponse.status})`);
        }

        const startPayload = (await startResponse.json()) as {
          data: {
            attemptId: string;
            questionOrder: string[];
            optionOrderByQuestion: Record<string, number[]>;
          };
        };

        setAttemptBootstrap(startPayload.data);
        setAttemptId(startPayload.data.attemptId);
        setRuntimeAnswers({});
        saveSessionLocally({
          attemptId: startPayload.data.attemptId,
          answers: {},
          updatedAt: new Date().toISOString(),
        });
        setRuntimeStatus('Demo działa: zaznacz odpowiedzi i kliknij "Zatwierdź próbę".');
      } catch (error) {
        setRuntimeStatus(`Nie udało się uruchomić demo: ${(error as Error).message}`);
      }
    };

    void bootstrapRuntime();
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

  useEffect(() => {
    if (!instructorQuizId) {
      return;
    }

    const loadMetrics = async () => {
      const response = await fetch(
        `${API_BASE_PATH}/quizzes/${instructorQuizId}/instructor/metrics`,
      );
      if (!response.ok) {
        setInstructorMetrics(null);
        return;
      }
      const payload = (await response.json()) as { data: NonNullable<typeof instructorMetrics> };
      setInstructorMetrics(payload.data);
    };

    void loadMetrics();
  }, [instructorQuizId, submittedScore]);

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
      const next = (index + 1) % runtimeOptions.length;
      setRuntimeIndex(next);
      runtimeRefs.current[next]?.focus();
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (index - 1 + runtimeOptions.length) % runtimeOptions.length;
      setRuntimeIndex(next);
      runtimeRefs.current[next]?.focus();
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const option = runtimeOptions[index];
      if (!option || !activeQuestion) {
        return;
      }
      void onRuntimeAnswerSelection(activeQuestion.id, option.originalIndex);
    }
  };

  const activeLimitMs = timerMode === 'global' ? globalTimerLimitMs : perQuestionLimitMs;
  const timerState = createTimerState(timerMode, elapsedMs, activeLimitMs);

  const onRuntimeAnswerSelection = async (questionId: string, originalIndex: number) => {
    setRuntimeAnswers((current) => {
      const next = { ...current, [questionId]: originalIndex };
      saveSessionLocally({
        attemptId,
        answers: next,
        updatedAt: new Date().toISOString(),
      });
      return next;
    });

    try {
      await autosaveAnswer(attemptId, questionId, originalIndex);
    } catch {
      // offline mode: keep local autosave
    }
  };

  const submitAttempt = async () => {
    if (!attemptId || !quiz) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_PATH}/attempts/${attemptId}/submit`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Submit failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        data: {
          answers: Record<string, number>;
        };
      };
      const result = scoreAttempt(quiz, payload.data.answers ?? runtimeAnswers);
      setSubmittedScore(result);
      setRuntimeStatus('Próba zatwierdzona. Wynik obliczony.');
    } catch (error) {
      setRuntimeStatus(`Nie udało się zatwierdzić próby: ${(error as Error).message}`);
    }
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
          <h2>Quiz runtime (real API-backed attempt)</h2>
          <p className="small">{runtimeStatus}</p>
          {activeQuestion?.type === 'objective' ? (
            <>
              <p>
                <strong>
                  Pytanie {runtimeQuestionIndex + 1}/{orderedQuestions.length}
                </strong>{' '}
                — {activeQuestion.prompt}
              </p>
              <div className="listbox" role="radiogroup" aria-label="Quiz answer options">
                {runtimeOptions.map((option, index) => {
                  const selectedOriginal = runtimeAnswers[activeQuestion.id];
                  const selected = selectedOriginal === option.originalIndex;
                  return (
                    <button
                      key={`${activeQuestion.id}-${option.originalIndex}`}
                      ref={(element) => {
                        runtimeRefs.current[index] = element;
                      }}
                      type="button"
                      role="radio"
                      aria-label={`Select option ${option.label}`}
                      aria-checked={selected}
                      className={`list-option ${selected ? 'active' : ''}`}
                      tabIndex={runtimeIndex === index ? 0 : -1}
                      onFocus={() => setRuntimeIndex(index)}
                      onKeyDown={(event) => onRuntimeKeyDown(event, index)}
                      onClick={() => {
                        setRuntimeIndex(index);
                        void onRuntimeAnswerSelection(activeQuestion.id, option.originalIndex);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid two">
                <button
                  type="button"
                  disabled={runtimeQuestionIndex === 0}
                  onClick={() => setRuntimeQuestionIndex((current) => Math.max(0, current - 1))}
                >
                  Poprzednie pytanie
                </button>
                <button
                  type="button"
                  disabled={runtimeQuestionIndex === orderedQuestions.length - 1}
                  onClick={() =>
                    setRuntimeQuestionIndex((current) =>
                      Math.min(orderedQuestions.length - 1, current + 1),
                    )
                  }
                >
                  Następne pytanie
                </button>
              </div>
            </>
          ) : (
            <p className="small">Brak aktywnego pytania. Poczekaj na inicjalizację próby.</p>
          )}
          <p className="small">
            Answered: {answeredCount}/{orderedQuestions.length}
          </p>
          <button type="button" onClick={() => void submitAttempt()}>
            Zatwierdź próbę i policz wynik
          </button>
          {submittedScore ? (
            <div className="status pass">
              Wynik: {submittedScore.correct}/{submittedScore.total} (
              {submittedScore.percent.toFixed(1)}%)
            </div>
          ) : null}
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

      <section className="panel grid" aria-label="Instructor dashboard">
        <h2>Instructor dashboard</h2>
        <label>
          Quiz ID
          <input
            aria-label="Instructor quiz id"
            value={instructorQuizId}
            onChange={(event) => setInstructorQuizId(event.target.value)}
            placeholder="Enter quiz id"
          />
        </label>
        {!instructorMetrics ? (
          <p className="small">
            Provide a quiz id to load completion, timing, and question heuristics.
          </p>
        ) : (
          <div className="grid two">
            <div className="grid">
              <p className="small">Attempts: {instructorMetrics.attemptCount}</p>
              <p className="small">
                Completion rate: {(instructorMetrics.completionRate * 100).toFixed(1)}%
              </p>
              <p className="small">
                Timing distribution samples: {instructorMetrics.timingDistributionMs.length}
              </p>
            </div>
            <div className="grid">
              {instructorMetrics.perQuestion.map((question) => (
                <div key={question.questionId} className="status pass">
                  <div className="small">Question: {question.questionId}</div>
                  <div className="small">Difficulty heuristic: {question.heuristicDifficulty}</div>
                  <div className="small">
                    Discrimination heuristic: {question.heuristicDiscrimination}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
