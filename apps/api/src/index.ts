import cors from '@fastify/cors';
import Fastify from 'fastify';
import {
  API_BASE_PATH,
  attemptAnswerChangeSchema,
  attemptEventSchema,
  attemptOpenResponseSchema,
  attemptStartRequestSchema,
  createQuizRequestSchema,
  quizSchema,
  scoreAttempt,
  type AttemptEvent,
  type AttemptStartRequest,
  type Quiz,
} from '@ronaldo/shared';

type AttemptStatus = 'active' | 'paused' | 'submitted' | 'expired';

type AttemptSession = {
  id: string;
  quizId: string;
  participantId: string;
  timingMode: 'global' | 'per-question';
  globalTimeLimitMs?: number;
  perQuestionTimeLimitMs?: number;
  antiCheatPolicy: AttemptStartRequest['antiCheatPolicy'];
  questionOrder: string[];
  optionOrderByQuestion: Record<string, number[]>;
  answers: Record<string, number>;
  openResponses: Record<string, string>;
  questionDurationMsByQuestion: Record<string, number[]>;
  createdAt: string;
  startedAt: string;
  pausedAt?: string;
  status: AttemptStatus;
  totalPausedMs: number;
  currentQuestionId?: string;
  questionStartedAt?: string;
  events: AttemptEvent[];
};

const now = () => new Date().toISOString();

const shuffle = <T>(input: T[]) => {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const csvEscape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export const createApp = () => {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: true,
  });

  const quizzes: Quiz[] = [];
  const attempts = new Map<string, AttemptSession>();

  const getQuizOrThrow = (quizId: string) => {
    const quiz = quizzes.find((item) => item.id === quizId);
    if (!quiz) {
      throw new Error('Quiz not found');
    }
    return quiz;
  };

  const logEvent = (
    attempt: AttemptSession,
    type: AttemptEvent['type'],
    payload?: Record<string, unknown>,
    questionId?: string,
  ) => {
    const event = attemptEventSchema.parse({
      id: crypto.randomUUID(),
      attemptId: attempt.id,
      type,
      occurredAt: now(),
      payload,
      questionId,
    });

    attempt.events.push(event);
    return event;
  };

  const assertAttemptNotTimedOut = (attempt: AttemptSession) => {
    if (attempt.status === 'submitted' || attempt.status === 'expired') {
      return;
    }

    const currentTime = Date.now();
    const started = new Date(attempt.startedAt).getTime();
    const pausedTime =
      attempt.status === 'paused' && attempt.pausedAt
        ? currentTime - new Date(attempt.pausedAt).getTime()
        : 0;
    const elapsedMs = currentTime - started - attempt.totalPausedMs - pausedTime;

    if (
      attempt.timingMode === 'global' &&
      attempt.globalTimeLimitMs &&
      elapsedMs >= attempt.globalTimeLimitMs
    ) {
      attempt.status = 'expired';
      logEvent(attempt, 'attempt_submitted', { reason: 'server_timeout_global' });
      throw new Error('Attempt expired due to global timeout');
    }

    if (
      attempt.timingMode === 'per-question' &&
      attempt.perQuestionTimeLimitMs &&
      attempt.questionStartedAt &&
      currentTime - new Date(attempt.questionStartedAt).getTime() >= attempt.perQuestionTimeLimitMs
    ) {
      attempt.status = 'expired';
      logEvent(attempt, 'attempt_submitted', {
        reason: 'server_timeout_question',
        questionId: attempt.currentQuestionId,
      });
      throw new Error('Attempt expired due to question timeout');
    }
  };

  const trackQuestionDuration = (attempt: AttemptSession, nextQuestionId: string) => {
    if (!attempt.currentQuestionId || !attempt.questionStartedAt) {
      attempt.currentQuestionId = nextQuestionId;
      attempt.questionStartedAt = now();
      return;
    }

    if (attempt.currentQuestionId !== nextQuestionId) {
      const duration = Date.now() - new Date(attempt.questionStartedAt).getTime();
      attempt.questionDurationMsByQuestion[attempt.currentQuestionId] ??= [];
      attempt.questionDurationMsByQuestion[attempt.currentQuestionId].push(Math.max(0, duration));
      attempt.currentQuestionId = nextQuestionId;
      attempt.questionStartedAt = now();
    }
  };

  app.get(`${API_BASE_PATH}/health`, async () => ({ status: 'ok' }));
  app.get(`${API_BASE_PATH}/quizzes`, async () => ({ data: quizzes }));

  app.post(`${API_BASE_PATH}/quizzes`, async (request, reply) => {
    const parsed = createQuizRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ errors: parsed.error.flatten() });
    }

    const quiz: Quiz = quizSchema.parse({
      ...parsed.data,
      id: crypto.randomUUID(),
    });

    quizzes.push(quiz);
    return reply.status(201).send({ data: quiz });
  });

  app.post(`${API_BASE_PATH}/attempts/start`, async (request, reply) => {
    const parsed = attemptStartRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ errors: parsed.error.flatten() });
    }

    let quiz: Quiz;
    try {
      quiz = getQuizOrThrow(parsed.data.quizId);
    } catch {
      return reply.status(404).send({ error: 'Quiz not found' });
    }

    const questionOrder = parsed.data.randomizeQuestionOrder
      ? shuffle(quiz.questions.map((question) => question.id))
      : quiz.questions.map((question) => question.id);

    const optionOrderByQuestion = Object.fromEntries(
      quiz.questions.map((question) => {
        if (question.type === 'open-ended') {
          return [question.id, []];
        }
        const defaultOrder = question.choices.map((_, index) => index);
        return [
          question.id,
          parsed.data.randomizeOptionOrder ? shuffle(defaultOrder) : defaultOrder,
        ];
      }),
    );

    const attempt: AttemptSession = {
      id: crypto.randomUUID(),
      quizId: parsed.data.quizId,
      participantId: parsed.data.participantId,
      timingMode: parsed.data.timingMode,
      globalTimeLimitMs: parsed.data.globalTimeLimitMs,
      perQuestionTimeLimitMs: parsed.data.perQuestionTimeLimitMs,
      antiCheatPolicy: parsed.data.antiCheatPolicy,
      questionOrder,
      optionOrderByQuestion,
      answers: {},
      openResponses: {},
      questionDurationMsByQuestion: {},
      createdAt: now(),
      startedAt: now(),
      status: 'active',
      totalPausedMs: 0,
      currentQuestionId: questionOrder[0],
      questionStartedAt: now(),
      events: [],
    };

    logEvent(attempt, 'attempt_started', {
      randomizeQuestionOrder: parsed.data.randomizeQuestionOrder,
      randomizeOptionOrder: parsed.data.randomizeOptionOrder,
    });

    attempts.set(attempt.id, attempt);

    return reply.status(201).send({
      data: {
        attemptId: attempt.id,
        status: attempt.status,
        questionOrder: attempt.questionOrder,
        optionOrderByQuestion: attempt.optionOrderByQuestion,
        antiCheatPolicy: attempt.antiCheatPolicy,
        startedAt: attempt.startedAt,
      },
    });
  });

  app.get(`${API_BASE_PATH}/attempts/:attemptId`, async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = attempts.get(attemptId);

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' });
    }

    try {
      assertAttemptNotTimedOut(attempt);
    } catch (error) {
      return reply.status(410).send({ error: (error as Error).message });
    }

    return {
      data: {
        id: attempt.id,
        status: attempt.status,
        answers: attempt.answers,
        openResponses: attempt.openResponses,
        currentQuestionId: attempt.currentQuestionId,
        questionOrder: attempt.questionOrder,
        optionOrderByQuestion: attempt.optionOrderByQuestion,
        antiCheatPolicy: attempt.antiCheatPolicy,
      },
    };
  });

  app.post(`${API_BASE_PATH}/attempts/:attemptId/pause`, async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = attempts.get(attemptId);

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' });
    }

    if (attempt.status !== 'active') {
      return reply
        .status(409)
        .send({ error: `Attempt cannot be paused from status ${attempt.status}` });
    }

    try {
      assertAttemptNotTimedOut(attempt);
    } catch (error) {
      return reply.status(410).send({ error: (error as Error).message });
    }

    attempt.status = 'paused';
    attempt.pausedAt = now();
    logEvent(attempt, 'attempt_paused');

    return { data: { attemptId: attempt.id, status: attempt.status, pausedAt: attempt.pausedAt } };
  });

  app.post(`${API_BASE_PATH}/attempts/:attemptId/answers`, async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = attempts.get(attemptId);

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' });
    }

    if (attempt.status === 'paused') {
      if (attempt.pausedAt) {
        attempt.totalPausedMs += Date.now() - new Date(attempt.pausedAt).getTime();
      }
      attempt.pausedAt = undefined;
      attempt.status = 'active';
      attempt.questionStartedAt = now();
    }

    if (attempt.status !== 'active') {
      return reply.status(409).send({ error: `Attempt is ${attempt.status}` });
    }

    const parsed = attemptAnswerChangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ errors: parsed.error.flatten() });
    }

    try {
      assertAttemptNotTimedOut(attempt);
    } catch (error) {
      return reply.status(410).send({ error: (error as Error).message });
    }

    trackQuestionDuration(attempt, parsed.data.questionId);
    attempt.answers[parsed.data.questionId] = parsed.data.selectedOptionIndex;

    logEvent(
      attempt,
      'answer_changed',
      {
        selectedOptionIndex: parsed.data.selectedOptionIndex,
        clientTimestamp: parsed.data.clientTimestamp,
      },
      parsed.data.questionId,
    );

    return { data: { attemptId: attempt.id, answers: attempt.answers } };
  });

  app.post(`${API_BASE_PATH}/attempts/:attemptId/open-responses`, async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = attempts.get(attemptId);

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' });
    }

    if (attempt.status !== 'active') {
      return reply.status(409).send({ error: `Attempt is ${attempt.status}` });
    }

    const parsed = attemptOpenResponseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ errors: parsed.error.flatten() });
    }

    trackQuestionDuration(attempt, parsed.data.questionId);
    attempt.openResponses[parsed.data.questionId] = parsed.data.richText;

    logEvent(
      attempt,
      'open_response_changed',
      { clientTimestamp: parsed.data.clientTimestamp },
      parsed.data.questionId,
    );

    return { data: { attemptId: attempt.id, openResponses: attempt.openResponses } };
  });

  app.post(`${API_BASE_PATH}/attempts/:attemptId/events`, async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = attempts.get(attemptId);

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' });
    }

    const body = request.body as { type?: AttemptEvent['type']; payload?: Record<string, unknown> };
    if (!body.type) {
      return reply.status(400).send({ error: 'Event type is required' });
    }

    const event = logEvent(attempt, body.type, body.payload);
    return reply.status(201).send({ data: event });
  });

  app.post(`${API_BASE_PATH}/attempts/:attemptId/submit`, async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = attempts.get(attemptId);

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' });
    }

    if (attempt.status === 'submitted') {
      return { data: { attemptId: attempt.id, status: attempt.status } };
    }

    try {
      assertAttemptNotTimedOut(attempt);
    } catch {
      // expired attempts are still considered closed submissions
    }

    attempt.status = 'submitted';
    logEvent(attempt, 'attempt_submitted', { answerCount: Object.keys(attempt.answers).length });

    return {
      data: {
        attemptId: attempt.id,
        status: attempt.status,
        submittedAt: now(),
        answers: attempt.answers,
        openResponses: attempt.openResponses,
        events: attempt.events,
      },
    };
  });

  app.get(`${API_BASE_PATH}/quizzes/:quizId/export/objective`, async (request, reply) => {
    const { quizId } = request.params as { quizId: string };
    const anonymized = (request.query as { anonymized?: string }).anonymized === 'true';
    const format = (request.query as { format?: string }).format ?? 'json';

    const quizAttempts = [...attempts.values()].filter((attempt) => attempt.quizId === quizId);
    const rows = quizAttempts.map((attempt) => ({
      attemptId: anonymized ? undefined : attempt.id,
      participantId: anonymized ? undefined : attempt.participantId,
      status: attempt.status,
      objectiveAnswers: attempt.answers,
      score: scoreAttempt(getQuizOrThrow(quizId), attempt.answers),
    }));

    if (format === 'csv') {
      const header = ['attemptId', 'participantId', 'status', 'correct', 'total', 'percent'];
      const lines = rows.map((row) =>
        [
          row.attemptId ?? 'anonymous',
          row.participantId ?? 'anonymous',
          row.status,
          row.score.correct,
          row.score.total,
          row.score.percent.toFixed(2),
        ]
          .map(csvEscape)
          .join(','),
      );
      reply.header('content-type', 'text/csv; charset=utf-8');
      return [header.map(csvEscape).join(','), ...lines].join('\n');
    }

    return { data: rows };
  });

  app.get(`${API_BASE_PATH}/quizzes/:quizId/export/open-ended`, async (request) => {
    const { quizId } = request.params as { quizId: string };
    const anonymized = (request.query as { anonymized?: string }).anonymized === 'true';

    const rows = [...attempts.values()]
      .filter((attempt) => attempt.quizId === quizId)
      .flatMap((attempt) =>
        Object.entries(attempt.openResponses).map(([questionId, richText]) => ({
          attemptId: anonymized ? undefined : attempt.id,
          participantId: anonymized ? undefined : attempt.participantId,
          questionId,
          richText,
        })),
      );

    return { data: rows };
  });

  app.get(`${API_BASE_PATH}/quizzes/:quizId/instructor/metrics`, async (request) => {
    const { quizId } = request.params as { quizId: string };
    const quiz = getQuizOrThrow(quizId);
    const quizAttempts = [...attempts.values()].filter((attempt) => attempt.quizId === quizId);
    const submitted = quizAttempts.filter((attempt) =>
      ['submitted', 'expired'].includes(attempt.status),
    );

    const completionRate = quizAttempts.length === 0 ? 0 : submitted.length / quizAttempts.length;

    const timingDistributionMs = quizAttempts.flatMap((attempt) =>
      Object.values(attempt.questionDurationMsByQuestion).flatMap((samples) => samples),
    );

    const perQuestion = quiz.questions.map((question) => {
      const objectiveSubmissions = submitted.filter(
        (attempt) => typeof attempt.answers[question.id] !== 'undefined',
      );
      const incorrectCount = objectiveSubmissions.filter(
        (attempt) =>
          question.type === 'objective' && attempt.answers[question.id] !== question.answerIndex,
      ).length;

      const difficulty =
        objectiveSubmissions.length === 0 ? 0 : incorrectCount / objectiveSubmissions.length;

      const highGroup = submitted
        .map((attempt) => ({ attempt, score: scoreAttempt(quiz, attempt.answers).percent }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(submitted.length / 2));
      const lowGroup = submitted
        .map((attempt) => ({ attempt, score: scoreAttempt(quiz, attempt.answers).percent }))
        .sort((a, b) => a.score - b.score)
        .slice(0, Math.ceil(submitted.length / 2));

      const highCorrect =
        highGroup.length === 0 || question.type !== 'objective'
          ? 0
          : highGroup.filter((entry) => entry.attempt.answers[question.id] === question.answerIndex)
              .length / highGroup.length;
      const lowCorrect =
        lowGroup.length === 0 || question.type !== 'objective'
          ? 0
          : lowGroup.filter((entry) => entry.attempt.answers[question.id] === question.answerIndex)
              .length / lowGroup.length;

      return {
        questionId: question.id,
        heuristicDifficulty: Number(difficulty.toFixed(3)),
        heuristicDiscrimination: Number((highCorrect - lowCorrect).toFixed(3)),
      };
    });

    return {
      data: {
        attemptCount: quizAttempts.length,
        completionRate: Number(completionRate.toFixed(3)),
        timingDistributionMs,
        perQuestion,
      },
    };
  });

  return app;
};

const start = async () => {
  const app = createApp();

  try {
    await app.listen({ port: 4000, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  void start();
}
