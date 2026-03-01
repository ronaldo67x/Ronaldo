import Fastify from 'fastify';
import {
  API_BASE_PATH,
  createQuizRequestSchema,
  quizSchema,
  type CreateQuizRequest,
  type Quiz,
} from '@ronaldo/shared';

const app = Fastify({ logger: true });

const quizzes: Quiz[] = [];

app.get(`${API_BASE_PATH}/health`, async () => ({ status: 'ok' }));

app.get(`${API_BASE_PATH}/quizzes`, async () => ({ data: quizzes }));

app.post(`${API_BASE_PATH}/quizzes`, async (request, reply) => {
  const parsed = createQuizRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const body: CreateQuizRequest = parsed.data;
  const quiz: Quiz = quizSchema.parse({
    ...body,
    id: crypto.randomUUID(),
  });

  quizzes.push(quiz);
  return reply.status(201).send({ data: quiz });
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
