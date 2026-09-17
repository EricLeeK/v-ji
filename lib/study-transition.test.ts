import { describe, expect, it } from "vitest";
import { resolveSwipeGesture, swipeExitX, SWIPE_EXIT_X } from "@/lib/study-transition";

describe("study swipe transition", () => {
  it("only commits a rating after the swipe clears the threshold", () => {
    expect(resolveSwipeGesture(40)).toBeNull();
    expect(resolveSwipeGesture(-40)).toBeNull();
    expect(resolveSwipeGesture(90)).toBe("right");
    expect(resolveSwipeGesture(-91)).toBe("left");
  });

  it("exits farther in the swipe direction so the card never springs back to center", () => {
    expect(swipeExitX("right")).toBe(SWIPE_EXIT_X);
    expect(swipeExitX("left")).toBe(-SWIPE_EXIT_X);
    expect(Math.abs(swipeExitX("right"))).toBeGreaterThan(90);
  });
});
