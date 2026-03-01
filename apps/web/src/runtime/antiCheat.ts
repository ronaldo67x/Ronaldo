import { API_BASE_PATH } from '@ronaldo/shared';

export type AntiCheatPolicy = {
  blockCopy: boolean;
  blockPaste: boolean;
  maxFocusLossEvents: number;
};

const postEvent = async (
  attemptId: string,
  type: 'focus_lost' | 'focus_restored' | 'copy_blocked' | 'paste_blocked',
  payload?: Record<string, unknown>,
) => {
  await fetch(`${API_BASE_PATH}/attempts/${attemptId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  });
};

export const attachAntiCheatGuards = (
  attemptId: string,
  policy: AntiCheatPolicy,
  target: HTMLElement,
  onViolation?: (message: string) => void,
) => {
  let focusLossCount = 0;

  const handleVisibility = () => {
    const hidden = document.visibilityState === 'hidden' || !document.hasFocus();
    if (hidden) {
      focusLossCount += 1;
      onViolation?.(`Focus lost ${focusLossCount}/${policy.maxFocusLossEvents}`);
      void postEvent(attemptId, 'focus_lost', { count: focusLossCount });
    } else {
      void postEvent(attemptId, 'focus_restored');
    }
  };

  const onCopy = (event: ClipboardEvent) => {
    if (!policy.blockCopy) {
      return;
    }
    event.preventDefault();
    onViolation?.('Copy disabled for this attempt');
    void postEvent(attemptId, 'copy_blocked');
  };

  const onPaste = (event: ClipboardEvent) => {
    if (!policy.blockPaste) {
      return;
    }
    event.preventDefault();
    onViolation?.('Paste disabled for this attempt');
    void postEvent(attemptId, 'paste_blocked');
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('blur', handleVisibility);
  window.addEventListener('focus', handleVisibility);
  target.addEventListener('copy', onCopy);
  target.addEventListener('paste', onPaste);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('blur', handleVisibility);
    window.removeEventListener('focus', handleVisibility);
    target.removeEventListener('copy', onCopy);
    target.removeEventListener('paste', onPaste);
  };
};
