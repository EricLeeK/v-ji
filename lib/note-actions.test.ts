import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  revalidate: vi.fn(),
  update: vi.fn(),
  row: { id: "note" } as { id: string; deck_id?: string } | null,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => "owner",
  createClient: async () => ({ from: (table: string) => {
    mocks.from(table);
    const chain = {
      delete: () => chain,
      update: (payload: unknown) => { mocks.update(payload); return chain; },
      select: () => chain,
      eq: (...args: unknown[]) => { mocks.eq(...args); return chain; },
      maybeSingle: async () => ({ data: mocks.row, error: null }),
    };
    return chain;
  } }),
}));
import { deleteNote, toggleStar } from "@/app/actions/notes";
beforeEach(() => { vi.clearAllMocks(); mocks.row = { id: "note" }; });
it("deletes only a note still belonging to this owner and displayed deck", async () => {
  expect(await deleteNote("note", "source-deck")).toEqual({});
  expect(mocks.eq.mock.calls).toEqual([["id", "note"], ["deck_id", "source-deck"], ["owner_id", "owner"]]);
  expect(mocks.revalidate).toHaveBeenCalledWith("/decks");
});
it("rejects a stale row after it has moved out of the displayed deck", async () => {
  mocks.row = null;
  expect((await deleteNote("note", "source-deck")).error).toContain("已移动或删除");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("stars a card and refreshes the deck lists", async () => {
  mocks.row = { id: "card", deck_id: "deck-1" };
  expect(await toggleStar("card", true)).toEqual({});
  expect(mocks.from).toHaveBeenCalledWith("cards");
  expect(mocks.update).toHaveBeenCalledWith({ starred: true });
  expect(mocks.eq.mock.calls).toEqual([["id", "card"], ["owner_id", "owner"]]);
  expect(mocks.revalidate.mock.calls).toEqual([["/decks/deck-1"], ["/decks"]]);
});
it("unstars a card with the same owner check", async () => {
  mocks.row = { id: "card", deck_id: "deck-1" };
  expect(await toggleStar("card", false)).toEqual({});
  expect(mocks.update).toHaveBeenCalledWith({ starred: false });
  expect(mocks.eq.mock.calls).toEqual([["id", "card"], ["owner_id", "owner"]]);
});
it("does not refresh decks when the card is already gone", async () => {
  mocks.row = null;
  expect((await toggleStar("card", true)).error).toContain("不存在或已被删除");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
