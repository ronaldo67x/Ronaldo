import Fastify from 'fastify';
import {
  API_BASE_PATH,
  attemptAnswerChangeSchema,
  attemptEventSchema,
  attemptStartRequestSchema,
  createQuizRequestSchema,
  quizSchema,
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
  createdAt: string;
  startedAt: string;
  pausedAt?: string;
  status: AttemptStatus;
  totalPausedMs: number;
  currentQuestionId?: string;
  questionStartedAt?: string;
  events: AttemptEvent[];
};

const app = Fastify({ logger: true });

const quizzes: Quiz[] = [];
const attempts = new Map<string, AttemptSession>();

const now = () => new Date().toISOString();

const shuffle = <T>(input: T[]) => {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

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
      const defaultOrder = question.choices.map((_, index) => index);
      return [question.id, parsed.data.randomizeOptionOrder ? shuffle(defaultOrder) : defaultOrder];
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

  attempt.answers[parsed.data.questionId] = parsed.data.selectedOptionIndex;
  attempt.currentQuestionId = parsed.data.questionId;
  attempt.questionStartedAt = now();
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
      events: attempt.events,
    },
  };
});

const start = async () => {
  try {
    await app.listen({ port: 4000, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
