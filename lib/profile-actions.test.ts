import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";

const mock = vi.hoisted(() => ({
  read: { data: { settings: { deepseekApiKey: "test-only-secret", unknownPreference: true }, updated_at: "2026-09-26T01:00:00Z" }, error: null as null | { message: string } },
  write: { data: { id: "owner" } as { id: string } | null, error: null },
  update: vi.fn(), eq: vi.fn(), revalidate: vi.fn(), uid: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: mock.uid,
  createClient: async () => ({ from: () => {
    const chain = {
      select: () => chain, eq: (...args: unknown[]) => { mock.eq(...args); return chain; },
      single: async () => mock.read, maybeSingle: async () => mock.write,
      update: (patch: unknown) => { mock.update(patch); return chain; },
    };
    return chain;
  } }),
}));
import { updateProfile, clearDeepseekApiKey } from "@/app/actions/profile";

describe("profile action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.uid.mockResolvedValue("owner"); mock.read.error = null; mock.write.data = { id: "owner" };
  });
  it("rejects invalid settings without writing", async () => {
    expect((await updateProfile({ settings: { ...DEFAULT_SETTINGS, newCardsPerDay: -1 } })).error).toBeTruthy();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("preserves private and unknown settings and refreshes study entry points", async () => {
    expect(await updateProfile({ nickname: " 学习者 ", settings: DEFAULT_SETTINGS })).toEqual({});
    expect(mock.update).toHaveBeenCalledWith({ nickname: "学习者", settings: { ...DEFAULT_SETTINGS, deepseekApiKey: "test-only-secret", unknownPreference: true } });
    expect(mock.eq).toHaveBeenCalledWith("id", "owner");
    expect(mock.eq).toHaveBeenCalledWith("updated_at", mock.read.data.updated_at);
    expect(mock.revalidate).toHaveBeenCalledWith("/today");
    expect(mock.revalidate).toHaveBeenCalledWith("/study");
  });
  it("reports concurrent updates instead of claiming success", async () => {
    mock.write.data = null;
    expect((await updateProfile({ settings: DEFAULT_SETTINGS })).error).toContain("另一处");
    expect(mock.revalidate).not.toHaveBeenCalled();
  });
  it("does not clear a key if the current settings cannot be read", async () => {
    mock.read.error = { message: "offline" };
    expect((await clearDeepseekApiKey()).error).toContain("读取");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated writes", async () => {
    mock.uid.mockResolvedValue(null);
    expect((await updateProfile({ nickname: "学习者" })).error).toBe("请先登录");
    expect(mock.update).not.toHaveBeenCalled();
  });

});
