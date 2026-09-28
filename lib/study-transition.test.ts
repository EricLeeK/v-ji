import { describe, expect, it } from "vitest";
import {
  KEYBOARD_SWIPE_EXIT_DURATION,
  resolveSwipeGesture,
  SWIPE_EXIT_DURATION,
  SWIPE_EXIT_X,
  swipeExitX,
} from "@/lib/study-transition";

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

  it("keeps keyboard Q/E exit twice as long as the pointer swipe", () => {
    expect(SWIPE_EXIT_DURATION).toBe(0.14);
    expect(KEYBOARD_SWIPE_EXIT_DURATION).toBe(0.28);
    expect(KEYBOARD_SWIPE_EXIT_DURATION).toBe(SWIPE_EXIT_DURATION * 2);
  });
});
