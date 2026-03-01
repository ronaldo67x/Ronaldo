import { z } from 'zod';

export const QUIZ_CATEGORIES = ['history', 'science', 'sports', 'geography'] as const;

export const questionSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(QUIZ_CATEGORIES),
  prompt: z.string().min(10),
  choices: z.array(z.string().min(1)).min(2).max(6),
  answerIndex: z.number().int().nonnegative(),
});

export const quizSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questions: z.array(questionSchema).min(1),
});

export const createQuizRequestSchema = quizSchema.omit({ id: true });

export const antiCheatPolicySchema = z.object({
  blockCopy: z.boolean().default(true),
  blockPaste: z.boolean().default(true),
  maxFocusLossEvents: z.number().int().nonnegative().default(3),
});

export const attemptTimingModeSchema = z.enum(['global', 'per-question']);

export const attemptStartRequestSchema = z.object({
  quizId: z.string().uuid(),
  participantId: z.string().min(1),
  timingMode: attemptTimingModeSchema,
  globalTimeLimitMs: z.number().int().positive().optional(),
  perQuestionTimeLimitMs: z.number().int().positive().optional(),
  antiCheatPolicy: antiCheatPolicySchema.default({}),
  randomizeQuestionOrder: z.boolean().default(true),
  randomizeOptionOrder: z.boolean().default(true),
});

export const attemptAnswerChangeSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIndex: z.number().int().nonnegative(),
  clientTimestamp: z.string().datetime().optional(),
});

export const attemptEventTypeSchema = z.enum([
  'attempt_started',
  'attempt_paused',
  'attempt_submitted',
  'answer_changed',
  'focus_lost',
  'focus_restored',
  'copy_blocked',
  'paste_blocked',
]);

export const attemptEventSchema = z.object({
  id: z.string().uuid(),
  attemptId: z.string().uuid(),
  type: attemptEventTypeSchema,
  occurredAt: z.string().datetime(),
  questionId: z.string().uuid().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];
export type Question = z.infer<typeof questionSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;

export type AntiCheatPolicy = z.infer<typeof antiCheatPolicySchema>;
export type AttemptTimingMode = z.infer<typeof attemptTimingModeSchema>;
export type AttemptStartRequest = z.infer<typeof attemptStartRequestSchema>;
export type AttemptAnswerChange = z.infer<typeof attemptAnswerChangeSchema>;
export type AttemptEventType = z.infer<typeof attemptEventTypeSchema>;
export type AttemptEvent = z.infer<typeof attemptEventSchema>;

export const API_BASE_PATH = '/api/v1';
