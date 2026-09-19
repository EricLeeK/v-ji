import { describe, expect, it } from "vitest";
import {
  MASTERED_STABILITY_DAYS,
  deckMatchesFilter,
  summarizeDeck,
} from "@/lib/deck-summary";

const now = new Date("2026-09-19T00:00:00.000Z");

function card(overrides: Partial<Parameters<typeof summarizeDeck>[0][number]> = {}) {
  return {
    state: 0,
    stability: 0,
    due: "2026-09-20T00:00:00.000Z",
    starred: false,
    suspended: false,
    ...overrides,
  };
}

describe("deck summaries", () => {
  it("classifies a deck with only new cards as 未学习", () => {
    const summary = summarizeDeck([card(), card({ due: "2026-09-18T00:00:00.000Z" })], now);

    expect(summary).toMatchObject({
      total: 2,
      newCount: 2,
      masteredCount: 0,
      remaining: 2,
      isNew: true,
      isLearning: false,
      isMastered: false,
    });
  });

  it("keeps reviewed cards below the stability threshold in 学习中", () => {
    const summary = summarizeDeck([
      card({ state: 2, stability: MASTERED_STABILITY_DAYS - 0.01 }),
    ], now);

    expect(summary.isNew).toBe(false);
    expect(summary.isLearning).toBe(true);
    expect(summary.isMastered).toBe(false);
    expect(summary.remaining).toBe(1);
  });

  it("requires every active card to reach stable review before 已掌握", () => {
    const summary = summarizeDeck([
      card({ state: 2, stability: MASTERED_STABILITY_DAYS }),
      card({ state: 2, stability: MASTERED_STABILITY_DAYS + 10 }),
    ], now);

    expect(summary.isMastered).toBe(true);
    expect(summary.isLearning).toBe(false);
    expect(summary.progressPercent).toBe(100);
    expect(summary.remaining).toBe(0);
  });

  it("uses starred cards in the deck for 收藏夹, including suspended content", () => {
    const summary = summarizeDeck([
      card({ state: 2, stability: MASTERED_STABILITY_DAYS, starred: true }),
      card({ state: 2, stability: MASTERED_STABILITY_DAYS, starred: true, suspended: true }),
    ], now);

    expect(summary.starredCount).toBe(2);
    expect(summary.isFavorite).toBe(true);
    expect(deckMatchesFilter(summary, "favorites")).toBe(true);
    expect(summarizeDeck([card({ starred: true, suspended: true })], now).isFavorite).toBe(true);
  });

  it("maps mixed and empty decks to the expected filters", () => {
    const learning = summarizeDeck([card(), card({ state: 1, stability: 1 })], now);
    const empty = summarizeDeck([], now);

    expect(deckMatchesFilter(learning, "new")).toBe(false);
    expect(deckMatchesFilter(learning, "learning")).toBe(true);
    expect(deckMatchesFilter(learning, "mastered")).toBe(false);
    expect(deckMatchesFilter(empty, "all")).toBe(true);
    expect(deckMatchesFilter(empty, "new")).toBe(false);
  });
});
