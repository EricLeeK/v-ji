import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/settings";

describe("saved settings normalization", () => {
  it("rejects out-of-range numbers before they reach the scheduler or speech API", () => {
    expect(parseSettings({ newCardsPerDay: -1, requestRetention: 2, tts: { rate: 99 } })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ newCardsPerDay: 1.5, requestRetention: 0, tts: { rate: -1 } })).toEqual(DEFAULT_SETTINGS);
  });
  it("uses valid defaults for malformed nested values and reminder times", () => {
    expect(parseSettings({ gesture: "broken", tts: [], reminder: { time: "25:99" } })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ tts: { lang: "invalid_language" } }).tts.lang).toBe("zh-CN");
  });
  it("preserves zero new cards and valid preferences", () => {
    expect(parseSettings({ newCardsPerDay: 0, gesture: { left: "hard" }, reminder: { enabled: true, time: "08:05" } })).toMatchObject({ newCardsPerDay: 0, gesture: { left: "hard", right: "good" }, reminder: { enabled: true, time: "08:05" } });
  });
});
