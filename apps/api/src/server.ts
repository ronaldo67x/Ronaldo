import express from "express";
import {
  questionTemplateSchema,
  quizSchema,
  type QuestionTemplate,
  type Quiz
} from "@ronaldo/shared";

const app = express();
app.use(express.json());

const quizzes = new Map<string, Quiz>();
const questionTemplates = new Map<string, QuestionTemplate>();

const createQuizSchema = quizSchema.omit({ createdAt: true, updatedAt: true });
const updateQuizSchema = createQuizSchema.partial();
const updateTemplateSchema = questionTemplateSchema.partial();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/quizzes", (req, res) => {
  const parsed = createQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const timestamp = new Date().toISOString();
  const quiz: Quiz = {
    ...parsed.data,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  quizzes.set(quiz.id, quiz);
  return res.status(201).json(quiz);
});

app.get("/quizzes", (_req, res) => {
  return res.json(Array.from(quizzes.values()));
});

app.get("/quizzes/:id", (req, res) => {
  const quiz = quizzes.get(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found" });
  }
  return res.json(quiz);
});

app.put("/quizzes/:id", (req, res) => {
  const current = quizzes.get(req.params.id);
  if (!current) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  const parsed = updateQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const updated: Quiz = {
    ...current,
    ...parsed.data,
    id: current.id,
    updatedAt: new Date().toISOString()
  };

  quizzes.set(current.id, updated);
  return res.json(updated);
});

app.delete("/quizzes/:id", (req, res) => {
  if (!quizzes.has(req.params.id)) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  quizzes.delete(req.params.id);
  return res.status(204).send();
});

app.post("/question-templates", (req, res) => {
  const parsed = questionTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  questionTemplates.set(parsed.data.templateId, parsed.data);
  return res.status(201).json(parsed.data);
});

app.get("/question-templates", (_req, res) => {
  return res.json(Array.from(questionTemplates.values()));
});

app.get("/question-templates/:id", (req, res) => {
  const template = questionTemplates.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Question template not found" });
  }

  return res.json(template);
});

app.put("/question-templates/:id", (req, res) => {
  const current = questionTemplates.get(req.params.id);
  if (!current) {
    return res.status(404).json({ error: "Question template not found" });
  }

  const parsed = updateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const updated: QuestionTemplate = {
    ...current,
    ...parsed.data,
    templateId: current.templateId,
    id: current.id
  };

  questionTemplates.set(current.templateId, updated);
  return res.json(updated);
});

app.delete("/question-templates/:id", (req, res) => {
  if (!questionTemplates.has(req.params.id)) {
    return res.status(404).json({ error: "Question template not found" });
  }

  questionTemplates.delete(req.params.id);
  return res.status(204).send();
});

export default app;
