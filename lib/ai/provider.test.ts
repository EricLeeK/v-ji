import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import {
  deepseekKeyStatus,
  getDeepseekApiKey,
  maskSecret,
  normalizeDeepseekApiKey,
  overlayUserSettings,
  withDeepseekApiKey,
} from "@/lib/ai/provider";

describe("deepseek user key", () => {
  it("reads a stored key and ignores invalid placeholders", () => {
    expect(getDeepseekApiKey({ deepseekApiKey: "sk-abcdefghijklmnopqrstuvwxyz" })).toBe(
      "sk-abcdefghijklmnopqrstuvwxyz",
    );
    expect(getDeepseekApiKey({ deepseekApiKey: "short" })).toBeNull();
    expect(getDeepseekApiKey({ deepseekApiKey: "not-a-deepseek-key-value" })).toBeNull();
    expect(getDeepseekApiKey({})).toBeNull();
  });

  it("normalizes pasted keys", () => {
    expect(normalizeDeepseekApiKey("  sk-abcdefghijklmnopqrstuvwxyz  ")).toEqual({
      ok: true,
      key: "sk-abcdefghijklmnopqrstuvwxyz",
    });
    expect(normalizeDeepseekApiKey("")).toMatchObject({ ok: false });
    expect(normalizeDeepseekApiKey("sk-short")).toMatchObject({ ok: false });
  });

  it("exposes a masked public status without the raw key", () => {
    expect(deepseekKeyStatus({ deepseekApiKey: "sk-abcdefghijklmnopqrstuvwxyz" })).toEqual({
      configured: true,
      masked: "sk-••••wxyz",
    });
    expect(deepseekKeyStatus({})).toEqual({ configured: false, masked: null });
  });

  it("masks the middle of a key", () => {
    expect(maskSecret("sk-abcdefghijklmnopqrstuvwxyz")).toBe("sk-••••wxyz");
  });

  it("keeps the key when overlaying study settings", () => {
    const merged = overlayUserSettings(
      { deepseekApiKey: "sk-abcdefghijklmnopqrstuvwxyz", newCardsPerDay: 5 },
      DEFAULT_SETTINGS,
    );
    expect(getDeepseekApiKey(merged)).toBe("sk-abcdefghijklmnopqrstuvwxyz");
    expect(merged).toMatchObject({ newCardsPerDay: 20 });
  });

  it("can replace or clear the key", () => {
    const stored = withDeepseekApiKey({}, "sk-abcdefghijklmnopqrstuvwxyz");
    expect(getDeepseekApiKey(stored)).toBeTruthy();
    expect(getDeepseekApiKey(withDeepseekApiKey(stored, null))).toBeNull();
  });
});
