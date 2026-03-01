import { expect, test } from '@playwright/test';

const API = '/api/v1';

test('quiz creation, submission, and export smoke flow', async ({ request }) => {
  const quiz = await request.post(`${API}/quizzes`, {
    data: {
      title: 'E2E quiz',
      difficulty: 'medium',
      questions: [
        {
          id: 'e1111111-1111-4111-8111-111111111111',
          type: 'objective',
          category: 'science',
          prompt: 'Which gas do plants absorb for photosynthesis?',
          choices: ['Carbon dioxide', 'Oxygen'],
          answerIndex: 0,
        },
      ],
    },
  });
  expect(quiz.ok()).toBeTruthy();
  const quizId = (await quiz.json()).data.id as string;

  const attempt = await request.post(`${API}/attempts/start`, {
    data: {
      quizId,
      participantId: 'e2e-student',
      timingMode: 'global',
      globalTimeLimitMs: 60_000,
      antiCheatPolicy: { blockCopy: true, blockPaste: true, maxFocusLossEvents: 2 },
    },
  });
  expect(attempt.ok()).toBeTruthy();
  const attemptId = (await attempt.json()).data.attemptId as string;

  const answer = await request.post(`${API}/attempts/${attemptId}/answers`, {
    data: { questionId: 'e1111111-1111-4111-8111-111111111111', selectedOptionIndex: 0 },
  });
  expect(answer.ok()).toBeTruthy();

  const submit = await request.post(`${API}/attempts/${attemptId}/submit`);
  expect(submit.ok()).toBeTruthy();

  const exportJson = await request.get(`${API}/quizzes/${quizId}/export/objective?format=json`);
  expect(exportJson.ok()).toBeTruthy();
  const payload = await exportJson.json();
  expect(payload.data.length).toBeGreaterThan(0);
});
