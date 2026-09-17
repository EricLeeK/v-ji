import { beforeEach, describe, expect, it } from "vitest";
import { Rating } from "@/lib/srs/scheduler";
import { useStudyStore } from "@/lib/stores/study-store";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { QueueCard } from "@/lib/srs/queue";

function fakeCard(id: string, question: string): QueueCard {
  const now = new Date().toISOString();
  return {
    id,
    note_id: `note-${id}`,
    deck_id: "deck-1",
    owner_id: "user-1",
    ord: 0,
    state: 0,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    starred: false,
    suspended: false,
    created_at: now,
    deckName: "测试盒",
    note: {
      id: `note-${id}`,
      deck_id: "deck-1",
      owner_id: "user-1",
      type: "qa",
      fields: { question, answer: "答案" },
      tags: [],
      layout: "minimal",
      source: null,
      created_at: now,
      updated_at: now,
    },
  };
}

describe("study store transitions", () => {
  beforeEach(() => {
    useStudyStore.setState({
      queue: [],
      face: "front",
      reviews: 0,
      total: 0,
      startedAt: 0,
      cardStartedAt: 0,
      settings: DEFAULT_SETTINGS,
    });
  });

  it("advances to the next card after rating without putting the rated card back on top", () => {
    const first = fakeCard("c1", "卡 1");
    const second = fakeCard("c2", "卡 2");
    useStudyStore.getState().hydrate([first, second], DEFAULT_SETTINGS);
    useStudyStore.getState().showAnswer();

    const payload = useStudyStore.getState().rate(Rating.Good);
    expect(payload?.cardId).toBe("c1");

    const { queue, face } = useStudyStore.getState();
    expect(queue[0]?.id).toBe("c2");
    expect(queue.map((card) => card.id)).not.toContain("c1");
    expect(face).toBe("front");
  });

  it("ignores rating while the front face is still showing", () => {
    useStudyStore.getState().hydrate([fakeCard("c1", "卡 1")], DEFAULT_SETTINGS);
    expect(useStudyStore.getState().rate(Rating.Good)).toBeNull();
    expect(useStudyStore.getState().queue[0]?.id).toBe("c1");
  });

  it("keeps session total fixed and does not count Again as clearing a card", () => {
    const cards = [fakeCard("c1", "卡 1"), fakeCard("c2", "卡 2"), fakeCard("c3", "卡 3")];
    useStudyStore.getState().hydrate(cards, DEFAULT_SETTINGS);
    expect(useStudyStore.getState().total).toBe(3);

    useStudyStore.getState().showAnswer();
    useStudyStore.getState().rate(Rating.Again);
    expect(useStudyStore.getState().queue).toHaveLength(3);
    expect(useStudyStore.getState().queue.map((card) => card.id)).toEqual(["c2", "c3", "c1"]);
    expect(useStudyStore.getState().reviews).toBe(1);
    expect(useStudyStore.getState().total).toBe(3);

    useStudyStore.getState().showAnswer();
    useStudyStore.getState().rate(Rating.Good);
    useStudyStore.getState().showAnswer();
    useStudyStore.getState().rate(Rating.Good);

    const state = useStudyStore.getState();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]?.id).toBe("c1");
    expect(state.reviews).toBe(3);
    expect(state.total).toBe(3);
    // Progress must stay below 100% while the Again card is still waiting.
    expect(state.total - state.queue.length).toBe(2);
  });
});
