import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from '@ronaldo/shared';
import { createApp } from './index';

const makeQuizPayload = {
  title: 'Integration quiz',
  difficulty: 'easy',
  questions: [
    {
      id: 'd1111111-1111-4111-8111-111111111111',
      type: 'objective',
      category: 'science',
      prompt: 'What is H2O commonly called?',
      choices: ['Oxygen', 'Water'],
      answerIndex: 1,
    },
    {
      id: 'd2222222-2222-4222-8222-222222222222',
      type: 'open-ended',
      category: 'history',
      prompt: 'Describe one reason the industrial revolution expanded rapidly.',
      maxLength: 1000,
    },
  ],
} as const;

describe('authoring + attempt integration flow', () => {
  it('creates a quiz, starts attempt, answers, submits, and exports', async () => {
    const app = createApp();

    const createQuiz = await app.inject({
      method: 'POST',
      url: `${API_BASE_PATH}/quizzes`,
      payload: makeQuizPayload,
    });
    expect(createQuiz.statusCode).toBe(201);
    const quizId = createQuiz.json().data.id as string;

    const startAttempt = await app.inject({
      method: 'POST',
      url: `${API_BASE_PATH}/attempts/start`,
      payload: {
        quizId,
        participantId: 'student-1',
        timingMode: 'global',
        globalTimeLimitMs: 60_000,
        antiCheatPolicy: { blockCopy: true, blockPaste: true, maxFocusLossEvents: 3 },
      },
    });
    expect(startAttempt.statusCode).toBe(201);
    const attemptId = startAttempt.json().data.attemptId as string;

    const answerObjective = await app.inject({
      method: 'POST',
      url: `${API_BASE_PATH}/attempts/${attemptId}/answers`,
      payload: {
        questionId: 'd1111111-1111-4111-8111-111111111111',
        selectedOptionIndex: 1,
      },
    });
    expect(answerObjective.statusCode).toBe(200);

    const answerOpenEnded = await app.inject({
      method: 'POST',
      url: `${API_BASE_PATH}/attempts/${attemptId}/open-responses`,
      payload: {
        questionId: 'd2222222-2222-4222-8222-222222222222',
        richText: '<p>Steam power and factory networks increased productivity.</p>',
      },
    });
    expect(answerOpenEnded.statusCode).toBe(200);

    const submit = await app.inject({
      method: 'POST',
      url: `${API_BASE_PATH}/attempts/${attemptId}/submit`,
    });
    expect(submit.statusCode).toBe(200);

    const objectiveExport = await app.inject({
      method: 'GET',
      url: `${API_BASE_PATH}/quizzes/${quizId}/export/objective?format=json&anonymized=true`,
    });
    expect(objectiveExport.statusCode).toBe(200);
    expect(objectiveExport.json().data[0].participantId).toBeUndefined();

    const openExport = await app.inject({
      method: 'GET',
      url: `${API_BASE_PATH}/quizzes/${quizId}/export/open-ended`,
    });
    expect(openExport.statusCode).toBe(200);
    expect(openExport.json().data[0].richText).toContain('<p>');

    await app.close();
  });
});
