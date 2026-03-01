import { useMemo, useState } from "react";
import type { QuestionType } from "@ronaldo/shared";

type BuilderFormat = "practice" | "exam" | "worksheet";

type BuilderState = {
  title: string;
  format: BuilderFormat;
  numberOfQuestions: number;
  openQuestionRatio: number;
  closedQuestionRatio: number;
  allowMathSymbols: boolean;
  metadata: {
    subject: string;
    level: string;
    language: string;
  };
  notes: string;
};

const defaultState: BuilderState = {
  title: "",
  format: "practice",
  numberOfQuestions: 10,
  openQuestionRatio: 40,
  closedQuestionRatio: 60,
  allowMathSymbols: true,
  metadata: {
    subject: "Mathematics",
    level: "Intermediate",
    language: "English"
  },
  notes: ""
};

const openTypes: QuestionType[] = ["short_answer", "long_open_ended", "numeric_formula"];
const closedTypes: QuestionType[] = ["multiple_choice", "multiple_select", "true_false"];

export function QuizBuilder(): JSX.Element {
  const [state, setState] = useState<BuilderState>(defaultState);

  const mixSummary = useMemo(() => {
    const openCount = Math.round((state.numberOfQuestions * state.openQuestionRatio) / 100);
    const closedCount = state.numberOfQuestions - openCount;

    return {
      openCount,
      closedCount,
      recommendedOpenTypes: openTypes,
      recommendedClosedTypes: closedTypes
    };
  }, [state.numberOfQuestions, state.openQuestionRatio]);

  return (
    <section style={{ display: "grid", gap: 16, maxWidth: 820 }}>
      <h1>Quiz Builder</h1>

      <label>
        Quiz title
        <input
          value={state.title}
          onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
          placeholder="Example: Physics Midterm"
        />
      </label>

      <label>
        Format
        <select
          value={state.format}
          onChange={(event) => setState((current) => ({ ...current, format: event.target.value as BuilderFormat }))}
        >
          <option value="practice">Practice</option>
          <option value="exam">Exam</option>
          <option value="worksheet">Worksheet</option>
        </select>
      </label>

      <label>
        Number of questions
        <input
          type="number"
          min={1}
          max={200}
          value={state.numberOfQuestions}
          onChange={(event) =>
            setState((current) => ({ ...current, numberOfQuestions: Number(event.target.value) || 1 }))
          }
        />
      </label>

      <fieldset>
        <legend>Open/Closed task mix</legend>
        <label>
          Open-ended (%)
          <input
            type="number"
            min={0}
            max={100}
            value={state.openQuestionRatio}
            onChange={(event) => {
              const openQuestionRatio = Number(event.target.value) || 0;
              setState((current) => ({
                ...current,
                openQuestionRatio,
                closedQuestionRatio: Math.max(0, 100 - openQuestionRatio)
              }));
            }}
          />
        </label>

        <label>
          Closed (%)
          <input type="number" value={state.closedQuestionRatio} readOnly />
        </label>
      </fieldset>

      <fieldset>
        <legend>Notes & metadata</legend>

        <label>
          Subject
          <input
            value={state.metadata.subject}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                metadata: { ...current.metadata, subject: event.target.value }
              }))
            }
          />
        </label>

        <label>
          Level
          <input
            value={state.metadata.level}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                metadata: { ...current.metadata, level: event.target.value }
              }))
            }
          />
        </label>

        <label>
          Language
          <input
            value={state.metadata.language}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                metadata: { ...current.metadata, language: event.target.value }
              }))
            }
          />
        </label>

        <label>
          Author notes
          <textarea
            value={state.notes}
            onChange={(event) => setState((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
          />
        </label>
      </fieldset>

      <label>
        Enable math/physics symbols (LaTeX / KaTeX)
        <input
          type="checkbox"
          checked={state.allowMathSymbols}
          onChange={(event) => setState((current) => ({ ...current, allowMathSymbols: event.target.checked }))}
        />
      </label>

      <aside>
        <h2>Builder Preview</h2>
        <p>
          This configuration creates <strong>{mixSummary.openCount}</strong> open questions and
          <strong> {mixSummary.closedCount}</strong> closed questions.
        </p>
        <p>Open types: {mixSummary.recommendedOpenTypes.join(", ")}</p>
        <p>Closed types: {mixSummary.recommendedClosedTypes.join(", ")}</p>
      </aside>
    </section>
  );
}
