export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const progressAnimationStyle = (progress: number) => {
  if (prefersReducedMotion()) {
    return {
      transition: 'none',
      width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
    };
  }

  return {
    transition: 'width 200ms linear',
    width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
  };
};
