import { describe, expect, it } from 'vitest';
import { createTimerState, formatClock } from './timers';

describe('createTimerState', () => {
  it('bounds elapsed time and computes progress', () => {
    const state = createTimerState('global', 30_000, 60_000);
    expect(state.remainingMs).toBe(30_000);
    expect(state.progress).toBe(0.5);
    expect(state.timedOut).toBe(false);
  });

  it('times out when elapsed exceeds limit', () => {
    const state = createTimerState('per-question', 70_000, 60_000);
    expect(state.remainingMs).toBe(0);
    expect(state.progress).toBe(1);
    expect(state.timedOut).toBe(true);
  });
});

describe('formatClock', () => {
  it('formats mm:ss output', () => {
    expect(formatClock(61_000)).toBe('01:01');
  });
});
