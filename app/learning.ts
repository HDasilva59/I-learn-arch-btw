export const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewRecord = {
  attempts: number;
  mistakes: number;
  intervalDays: number;
  nextReviewAt: number;
};

export type StreakState = {
  current: number;
  best: number;
  lastActiveDay: string | null;
};

export type AchievementId =
  | "first-command"
  | "error-decoder"
  | "three-day-streak"
  | "mission-complete";

export type LearningOutcome =
  | { kind: "success"; usedHint?: boolean }
  | { kind: "failure"; usedHint?: boolean };

export function recordTaskAttempt(
  records: Readonly<Record<string, ReviewRecord>>,
  taskKey: string,
  outcome: LearningOutcome,
  now: number,
): Readonly<Record<string, ReviewRecord>> {
  const previous = records[taskKey];
  const intervalDays = outcome.kind === "failure"
    ? 1
    : outcome.usedHint
      ? Math.min(3, Math.max(1, previous?.intervalDays ?? 1))
      : Math.min(30, previous ? Math.max(1, previous.intervalDays) * 2 : 1);

  const record: ReviewRecord = {
    attempts: (previous?.attempts ?? 0) + 1,
    mistakes: (previous?.mistakes ?? 0) + (outcome.kind === "failure" ? 1 : 0),
    intervalDays,
    nextReviewAt: now + intervalDays * DAY_MS,
  };

  return { ...records, [taskKey]: record };
}

function calendarDay(timestamp: number): string | null {
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function recordLearningDay(streak: StreakState, now: number): StreakState {
  const activeDay = calendarDay(now);

  if (!activeDay || streak.lastActiveDay === activeDay) {
    return streak;
  }

  const previousDay = calendarDay(now - DAY_MS);
  const current = streak.lastActiveDay === previousDay ? streak.current + 1 : 1;

  return {
    current,
    best: Math.max(streak.best, current),
    lastActiveDay: activeDay,
  };
}

export function dueReviewCount(
  records: Readonly<Record<string, ReviewRecord>>,
  knownTaskKeys: readonly string[],
  now: number,
): number {
  const dueKeys = new Set<string>();

  for (const taskKey of knownTaskKeys) {
    const record = records[taskKey];

    if (record && record.nextReviewAt <= now) {
      dueKeys.add(taskKey);
    }
  }

  return dueKeys.size;
}
