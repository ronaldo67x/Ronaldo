import { z } from "zod";

export const questionTypeSchema = z.enum([
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
  "long_open_ended",
  "numeric_formula"
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const symbolPayloadSchema = z.object({
  format: z.enum(["latex", "katex"]).default("latex"),
  expression: z.string().min(1),
  displayMode: z.boolean().default(false)
});
export type SymbolPayload = z.infer<typeof symbolPayloadSchema>;

export const attachmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().nonnegative().optional()
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const scoringPolicySchema = z.object({
  points: z.number().nonnegative().default(1),
  allowPartialCredit: z.boolean().default(false),
  negativeMarking: z.number().min(0).max(1).default(0),
  rubric: z.array(z.string()).default([])
});
export type ScoringPolicy = z.infer<typeof scoringPolicySchema>;

export const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  isCorrect: z.boolean().default(false),
  explanation: z.string().optional(),
  symbols: z.array(symbolPayloadSchema).default([])
});
export type Option = z.infer<typeof optionSchema>;

export const timerPolicySchema = z.object({
  mode: z.enum(["none", "quiz", "section", "question"]),
  durationSeconds: z.number().int().positive().optional(),
  hardStop: z.boolean().default(false),
  autoSubmitOnExpiry: z.boolean().default(true)
});
export type TimerPolicy = z.infer<typeof timerPolicySchema>;

export const antiCheatPolicySchema = z.object({
  lockNavigation: z.boolean().default(false),
  randomizeQuestionOrder: z.boolean().default(false),
  randomizeOptionOrder: z.boolean().default(false),
  disableCopyPaste: z.boolean().default(false),
  webcamRequired: z.boolean().default(false),
  tabSwitchLimit: z.number().int().nonnegative().default(0)
});
export type AntiCheatPolicy = z.infer<typeof antiCheatPolicySchema>;

export const themeConfigSchema = z.object({
  brandColor: z.string().default("#2563eb"),
  backgroundColor: z.string().default("#ffffff"),
  fontFamily: z.string().default("Inter"),
  logoUrl: z.string().url().optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable")
});
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export const exportConfigSchema = z.object({
  formats: z.array(z.enum(["pdf", "csv", "json", "qti"])).default(["pdf", "json"]),
  includeResponses: z.boolean().default(false),
  includeScoringBreakdown: z.boolean().default(true),
  redactPII: z.boolean().default(true)
});
export type ExportConfig = z.infer<typeof exportConfigSchema>;

export const questionSchema = z.object({
  id: z.string().min(1),
  type: questionTypeSchema,
  prompt: z.string().min(1),
  sectionId: z.string().min(1).optional(),
  options: z.array(optionSchema).default([]),
  answerKey: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]).optional(),
  acceptableAnswers: z.array(z.string()).default([]),
  formula: z.string().optional(),
  tolerance: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  hints: z.array(z.string()).default([]),
  attachments: z.array(attachmentSchema).default([]),
  symbols: z.array(symbolPayloadSchema).default([]),
  scoringPolicy: scoringPolicySchema.default({ points: 1, allowPartialCredit: false, negativeMarking: 0, rubric: [] })
});
export type Question = z.infer<typeof questionSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  timerPolicy: timerPolicySchema.optional(),
  questionIds: z.array(z.string()).default([])
});
export type Section = z.infer<typeof sectionSchema>;

export const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  questions: z.array(questionSchema).default([]),
  sections: z.array(sectionSchema).default([]),
  timerPolicy: timerPolicySchema.default({ mode: "none", hardStop: false, autoSubmitOnExpiry: true }),
  antiCheatPolicy: antiCheatPolicySchema.default({
    lockNavigation: false,
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    disableCopyPaste: false,
    webcamRequired: false,
    tabSwitchLimit: 0
  }),
  themeConfig: themeConfigSchema.default({
    brandColor: "#2563eb",
    backgroundColor: "#ffffff",
    fontFamily: "Inter",
    density: "comfortable"
  }),
  exportConfig: exportConfigSchema.default({
    formats: ["pdf", "json"],
    includeResponses: false,
    includeScoringBreakdown: true,
    redactPII: true
  }),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});
export type Quiz = z.infer<typeof quizSchema>;

export const attemptSchema = z.object({
  id: z.string().min(1),
  quizId: z.string().min(1),
  candidateId: z.string().min(1),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().optional(),
  status: z.enum(["in_progress", "submitted", "graded"]).default("in_progress"),
  responses: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string()), z.number(), z.boolean()])
  ).default({}),
  score: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  flaggedEvents: z.array(z.string()).default([])
});
export type Attempt = z.infer<typeof attemptSchema>;

export const questionTemplateSchema = questionSchema.extend({
  templateId: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: z.string().optional()
});
export type QuestionTemplate = z.infer<typeof questionTemplateSchema>;
