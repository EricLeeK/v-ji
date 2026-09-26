import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  read: { data: { settings: { unknownPreference: true }, updated_at: "2026-09-26T01:00:00Z" }, error: null as null | { message: string } },
  write: { data: { id: "owner" } as { id: string } | null, error: null as null | { message: string } },
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
import { updateProfile } from "@/app/actions/profile";

describe("preset avatar profile writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.uid.mockResolvedValue("owner");
    mock.read.error = null;
    mock.write.error = null;
    mock.write.data = { id: "owner" };
  });
  it("saves a preset avatar for the signed-in owner without replacing settings", async () => {
    expect(await updateProfile({ avatarId: "rabbit" })).toEqual({});
    expect(mock.update).toHaveBeenCalledWith({ avatar_url: "/avatars/v1/rabbit.webp" });
    expect(mock.eq).toHaveBeenCalledWith("id", "owner");
    expect(mock.eq).toHaveBeenCalledWith("updated_at", mock.read.data.updated_at);
    expect(mock.revalidate).toHaveBeenCalledWith("/me");
    expect(mock.revalidate).toHaveBeenCalledWith("/today");
  });
  it.each(["https://example.com/avatar.png", "../../other", "unknown", "", 42, {}])("rejects an unlisted avatar %j before writing", async (avatarId) => {
    expect((await updateProfile({ avatarId: avatarId as string })).error).toBe("请选择预设头像");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("can restore the initial avatar without changing nickname or settings", async () => {
    expect(await updateProfile({ avatarId: null })).toEqual({});
    expect(mock.update).toHaveBeenCalledWith({ avatar_url: null });
  });
  it("does not clear an existing avatar during an ordinary nickname update", async () => {
    expect(await updateProfile({ nickname: "学习者" })).toEqual({});
    expect(mock.update).toHaveBeenCalledWith({ nickname: "学习者" });
  });
  it("rejects avatar changes without a signed-in user", async () => {
    mock.uid.mockResolvedValue(null);
    expect((await updateProfile({ avatarId: "rabbit" })).error).toBe("请先登录");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("does not write if the current profile cannot be read", async () => {
    mock.read.error = { message: "offline" };
    expect((await updateProfile({ avatarId: "rabbit" })).error).toContain("读取");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("reports a concurrent profile change instead of a false success", async () => {
    mock.write.data = null;
    expect((await updateProfile({ avatarId: "rabbit" })).error).toContain("另一处");
    expect(mock.revalidate).not.toHaveBeenCalled();
  });
  it("returns a save error without invalidating a successful profile", async () => {
    mock.write.error = { message: "save failed" };
    expect((await updateProfile({ avatarId: "rabbit" })).error).toBe("save failed");
    expect(mock.revalidate).not.toHaveBeenCalled();
  });
});
