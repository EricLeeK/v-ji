import { describe, expect, it } from "vitest";
import { clozeIds, clozeParts, nextClozeIndex, renderCloze, wrapCloze } from "@/lib/cloze";
import { Rating, createEmptyCard, scheduleReview } from "@/lib/srs/scheduler";
import { buildTodayQueue } from "@/lib/srs/queue";
import type { QueueCard } from "@/lib/srs/queue";

describe("cloze", () => {
  it("wraps the selected word with the next index", () => {
    const source = "海内存知己，天涯若比邻。";
    const start = source.indexOf("天涯若比邻");
    const text = wrapCloze(source, start, start + "天涯若比邻".length);
    expect(text).toContain("{{c1::天涯若比邻}}");
    expect(nextClozeIndex(text)).toBe(2);
    expect(clozeIds(text)).toEqual([1]);
  });

  it("hides only the target cloze before reveal", () => {
    const source = "Scientists {{c1::hypothesize}} that species will {{c2::adapt}}.";
    expect(renderCloze(source, 0, false)).toContain("______");
    expect(renderCloze(source, 0, false)).toContain("adapt");
    expect(renderCloze(source, 0, true)).toContain("hypothesize");
  });

  it("keeps the blank answer so the study face can size and highlight it", () => {
    const source = "海内存知己，{{c1::天涯若比邻}}。";
    expect(clozeParts(source, 0)).toEqual([
      { type: "text", value: "海内存知己，" },
      { type: "blank", answer: "天涯若比邻" },
      { type: "text", value: "。" },
    ]);
    expect(clozeParts("Scientists {{c1::hypothesize}} that species will {{c2::adapt}}.", 0)).toEqual([
      { type: "text", value: "Scientists " },
      { type: "blank", answer: "hypothesize" },
      { type: "text", value: " that species will adapt." },
    ]);
  });
});

describe("fsrs scheduler", () => {
  it("schedules a later due date after Good", () => {
    const now = new Date("2026-09-14T08:00:00.000Z");
    const card = createEmptyCard(now);
    const good = scheduleReview(card, Rating.Good, now, 0.9);
    const again = scheduleReview(card, Rating.Again, now, 0.9);
    expect(good.card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(again.card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(good.card.reps).toBe(1);
  });
});

describe("today queue", () => {
  it("puts due reviews before new cards and respects the new-card cap", () => {
    const now = new Date("2026-09-14T08:00:00.000Z");
    const base = {
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      last_review: null,
      starred: false,
      suspended: false,
      stability: 0,
      owner_id: "u",
      note_id: "n",
      deckName: "英语",
      note: {
        id: "n",
        deck_id: "d",
        owner_id: "u",
        type: "qa" as const,
        fields: {},
        tags: [],
        layout: "minimal",
        source: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    };
    const cards = [
      {
        ...base,
        id: "new-1",
        deck_id: "d",
        ord: 0,
        state: 0,
        due: now.toISOString(),
        created_at: now.toISOString(),
      },
      {
        ...base,
        id: "new-2",
        deck_id: "d",
        ord: 0,
        state: 0,
        due: now.toISOString(),
        created_at: now.toISOString(),
      },
      {
        ...base,
        id: "rev-1",
        deck_id: "d",
        ord: 0,
        state: 2,
        due: "2026-09-13T08:00:00.000Z",
        created_at: now.toISOString(),
      },
    ] as QueueCard[];
    const result = buildTodayQueue(cards, 1, now);
    expect(result.queue.map((card) => card.id)).toEqual(["rev-1", "new-1"]);
  });
});
