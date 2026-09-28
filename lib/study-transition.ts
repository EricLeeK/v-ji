/** Horizontal exit distance (px) after a swipe rating gesture. */
export const SWIPE_EXIT_X = 480;

/** Seconds for the card to leave after a pointer or touch swipe. */
export const SWIPE_EXIT_DURATION = 0.14;

/**
 * Seconds for the card to leave after a desktop Q/E swipe.
 * Twice the pointer duration so the keyboard gesture reads at about half speed.
 */
export const KEYBOARD_SWIPE_EXIT_DURATION = SWIPE_EXIT_DURATION * 2;

export type SwipeExit = "left" | "right";

/** Decide whether a finished drag should rate, and which way the card exits. */
export function resolveSwipeGesture(
  offsetX: number,
  threshold = 90,
): SwipeExit | null {
  if (offsetX <= -threshold) return "left";
  if (offsetX >= threshold) return "right";
  return null;
}

/** Target x for animating the current card off-screen before advancing the queue. */
export function swipeExitX(exit: SwipeExit) {
  return exit === "right" ? SWIPE_EXIT_X : -SWIPE_EXIT_X;
}
