import { describe, expect, it } from "vitest";
import { isDateKey } from "./dates";

describe("isDateKey", () => {
  it("accepts a real calendar date", () => {
    expect(isDateKey("2026-09-19")).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    expect(isDateKey("2026-9-19")).toBe(false);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("not-a-date")).toBe(false);
  });
});
