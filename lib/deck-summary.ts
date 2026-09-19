/**
 * FSRS stores stability in days. A card that can be expected to stay recalled
 * for at least three weeks is presented as mastered in the deck overview.
 * Keeping this policy here makes the tab semantics explicit and testable.
 */
export const MASTERED_STABILITY_DAYS = 21;

export type DeckFilter = "all" | "learning" | "new" | "mastered" | "favorites";

export const DECK_FILTERS: ReadonlyArray<{ value: DeckFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "learning", label: "学习中" },
  { value: "new", label: "未学习" },
  { value: "mastered", label: "已掌握" },
  { value: "favorites", label: "收藏夹" },
];

export type DeckSummaryCard = {
  state: number;
  stability: number | null;
  due: string | Date;
  starred: boolean;
  suspended?: boolean;
};

export type DeckSummary = {
  total: number;
  due: number;
  newCount: number;
  masteredCount: number;
  starredCount: number;
  remaining: number;
  progressPercent: number;
  isNew: boolean;
  isLearning: boolean;
  isMastered: boolean;
  isFavorite: boolean;
};

function isMasteredCard(card: DeckSummaryCard) {
  return card.state === 2 && (card.stability ?? 0) >= MASTERED_STABILITY_DAYS;
}

export function summarizeDeck(cards: readonly DeckSummaryCard[], now = new Date()): DeckSummary {
  const activeCards = cards.filter((card) => !card.suspended);
  const total = activeCards.length;
  const newCount = activeCards.filter((card) => card.state === 0).length;
  const masteredCount = activeCards.filter(isMasteredCard).length;
  // Starred is a content choice, so it remains discoverable even when a card is suspended.
  const starredCount = cards.filter((card) => card.starred).length;
  const due = activeCards.filter((card) => {
    if (card.state === 0) return true;
    return new Date(card.due).getTime() <= now.getTime();
  }).length;
  const isNew = total > 0 && newCount === total;
  const isMastered = total > 0 && masteredCount === total;
  const isLearning = total > 0 && !isNew && !isMastered;

  return {
    total,
    due,
    newCount,
    masteredCount,
    starredCount,
    remaining: total - masteredCount,
    progressPercent: total > 0 ? Math.round((masteredCount / total) * 100) : 0,
    isNew,
    isLearning,
    isMastered,
    isFavorite: starredCount > 0,
  };
}

export function deckMatchesFilter(summary: DeckSummary, filter: DeckFilter) {
  switch (filter) {
    case "learning":
      return summary.isLearning;
    case "new":
      return summary.isNew;
    case "mastered":
      return summary.isMastered;
    case "favorites":
      return summary.isFavorite;
    default:
      return true;
  }
}
