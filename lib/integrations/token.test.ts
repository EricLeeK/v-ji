import { describe, expect, it } from "vitest";
import { createLearningHubToken, hashLearningHubToken } from "./token";

describe("Learning Hub bearer tokens", () => {
  it("creates high-entropy tokens with the documented wire format", () => {
    const first = createLearningHubToken();
    const second = createLearningHubToken();

    expect(first).toMatch(/^vji_live_[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^vji_live_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("stores a SHA-256 hex digest instead of the raw token", () => {
    expect(hashLearningHubToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
