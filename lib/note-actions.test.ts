import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ eq: vi.fn(), revalidate: vi.fn(), row: { id: "note" } as { id: string } | null }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => "owner",
  createClient: async () => ({ from: () => {
    const chain = { delete: () => chain, select: () => chain, eq: (...args: unknown[]) => { mocks.eq(...args); return chain; }, maybeSingle: async () => ({ data: mocks.row, error: null }) };
    return chain;
  } }),
}));
import { deleteNote } from "@/app/actions/notes";
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
