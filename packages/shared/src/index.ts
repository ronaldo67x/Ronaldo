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

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];
export type Question = z.infer<typeof questionSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;

export const API_BASE_PATH = '/api/v1';
