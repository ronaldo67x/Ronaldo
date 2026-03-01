import { describe, expect, it } from 'vitest';
import { scoreAttempt, type Quiz } from './index';

const quiz: Quiz = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Sample quiz',
  difficulty: 'medium',
  questions: [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      type: 'objective',
      category: 'science',
      prompt: 'What planet is known as the red planet?',
      choices: ['Earth', 'Mars'],
      answerIndex: 1,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      type: 'open-ended',
      category: 'history',
      prompt: 'Explain one major cause of the Roman empire decline.',
      maxLength: 500,
    },
  ],
};

describe('scoreAttempt', () => {
  it('scores only objective questions', () => {
    const result = scoreAttempt(quiz, {
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': 1,
    });

    expect(result.total).toBe(1);
    expect(result.correct).toBe(1);
    expect(result.percent).toBe(100);
  });

  it('returns zero when no answers are correct', () => {
    const result = scoreAttempt(quiz, {
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': 0,
    });

    expect(result.correct).toBe(0);
    expect(result.percent).toBe(0);
  });
});
