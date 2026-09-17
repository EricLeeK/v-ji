import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { Tables } from "@/types/database";

export { Rating, createEmptyCard };
export type { Card, Grade };

export type FsrsCardPatch = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export function getScheduler(requestRetention = 0.9) {
  return fsrs({ request_retention: requestRetention });
}

export function dbToFsrs(row: Tables<"cards">): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fsrsToPatch(card: Card): FsrsCardPatch {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function scheduleReview(
  card: Card,
  rating: Grade,
  now = new Date(),
  requestRetention = 0.9,
) {
  return getScheduler(requestRetention).repeat(card, now)[rating];
}

export const RATING_LABELS: Record<Grade, { key: string; label: string; hint: string; color: string }> =
  {
    [Rating.Again]: {
      key: "again",
      label: "忘记",
      hint: "马上再来",
      color: "bg-rose-500",
    },
    [Rating.Hard]: {
      key: "hard",
      label: "困难",
      hint: "勉强想起",
      color: "bg-amber-500",
    },
    [Rating.Good]: {
      key: "good",
      label: "记得",
      hint: "正常回忆",
      color: "bg-emerald-500",
    },
    [Rating.Easy]: {
      key: "easy",
      label: "简单",
      hint: "脱口而出",
      color: "bg-sky-500",
    },
  };

export function gestureToRating(action: string): Grade {
  switch (action) {
    case "hard":
      return Rating.Hard;
    case "easy":
      return Rating.Easy;
    case "good":
      return Rating.Good;
    default:
      return Rating.Again;
  }
}
