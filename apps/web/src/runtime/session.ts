import { API_BASE_PATH } from '@ronaldo/shared';

export type RuntimeSessionState = {
  attemptId: string;
  answers: Record<string, number>;
  updatedAt: string;
};

const LOCAL_SESSION_KEY = 'ronaldo.runtime.session.v1';

export const saveSessionLocally = (state: RuntimeSessionState) => {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(state));
};

export const readSessionLocally = () => {
  const raw = localStorage.getItem(LOCAL_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RuntimeSessionState;
  } catch {
    return null;
  }
};

export const autosaveAnswer = async (
  attemptId: string,
  questionId: string,
  selectedOptionIndex: number,
) => {
  await fetch(`${API_BASE_PATH}/attempts/${attemptId}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId,
      selectedOptionIndex,
      clientTimestamp: new Date().toISOString(),
    }),
  });
};

export const restoreSession = async (attemptId: string) => {
  const response = await fetch(`${API_BASE_PATH}/attempts/${attemptId}`);
  if (!response.ok) {
    throw new Error(`Unable to restore session (${response.status})`);
  }

  return (await response.json()) as {
    data: {
      id: string;
      status: string;
      answers: Record<string, number>;
      currentQuestionId?: string;
      questionOrder: string[];
      antiCheatPolicy: {
        blockCopy: boolean;
        blockPaste: boolean;
      };
    };
  };
};
