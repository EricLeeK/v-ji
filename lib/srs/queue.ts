import type { Tables } from "@/types/database";

export type QueueCard = Tables<"cards"> & {
  note: Tables<"notes">;
  deckName: string;
};

export type QueueMeta = Pick<Tables<"cards">, "id" | "state" | "due" | "created_at" | "suspended">;

export function buildTodayQueue<T extends QueueMeta>(
  cards: T[],
  newLimit: number,
  now = new Date(),
) {
  const active = cards.filter((card) => !card.suspended);
  const reviews = active
    .filter((card) => card.state !== 0 && new Date(card.due) <= now)
    .sort((a, b) => +new Date(a.due) - +new Date(b.due));
  const news = active
    .filter((card) => card.state === 0)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    .slice(0, Math.max(0, newLimit));
  return { reviews, news, queue: [...reviews, ...news] };
}

export function summarizeQueue(cards: QueueMeta[], newLimit: number, now = new Date()) {
  const { reviews, news } = buildTodayQueue(cards, newLimit, now);
  return {
    reviewCount: reviews.length,
    newCount: news.length,
    total: reviews.length + news.length,
    estimatedMinutes: Math.max(1, Math.ceil((reviews.length + news.length) * 0.3)),
  };
}
