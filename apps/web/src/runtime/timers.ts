export type TimerMode = 'global' | 'per-question';

export type TimerState = {
  mode: TimerMode;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  timedOut: boolean;
};

export const createTimerState = (
  mode: TimerMode,
  elapsedMs: number,
  limitMs: number,
): TimerState => {
  const boundedElapsed = Math.max(0, elapsedMs);
  const remainingMs = Math.max(0, limitMs - boundedElapsed);

  return {
    mode,
    elapsedMs: boundedElapsed,
    remainingMs,
    progress: Math.min(1, boundedElapsed / limitMs),
    timedOut: remainingMs === 0,
  };
};

export const formatClock = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};
