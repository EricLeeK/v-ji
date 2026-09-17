export type StudyScope = "today" | "deck";

export function studyDoneTitle(scope: StudyScope) {
  return scope === "deck" ? "本轮已完成" : "今日已完成";
}

export function studySessionPhase(total: number, remaining: number) {
  if (total <= 0) return "empty" as const;
  if (remaining <= 0) return "done" as const;
  return "active" as const;
}

/** Progress for an in-session study queue. */
export function studyProgress(total: number, remaining: number) {
  const safeTotal = Math.max(0, total);
  if (safeTotal === 0) {
    return { cleared: 0, remaining: 0, total: 0, percent: 0 };
  }
  const clampedRemaining = Math.min(Math.max(0, remaining), safeTotal);
  const cleared = safeTotal - clampedRemaining;
  return {
    cleared,
    remaining: clampedRemaining,
    total: safeTotal,
    percent: Math.min(100, (cleared / safeTotal) * 100),
  };
}
