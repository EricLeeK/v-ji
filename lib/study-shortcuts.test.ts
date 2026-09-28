import { describe, expect, it } from "vitest";
import { gestureToRating, Rating } from "@/lib/srs/scheduler";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import {
  isStudyTypingTarget,
  resolveStudyShortcut,
  type StudyShortcutEvent,
} from "@/lib/study-shortcuts";

function key(partial: Partial<StudyShortcutEvent> & { key: string }): StudyShortcutEvent {
  return { target: null, ...partial };
}

function field(tagName: string, extra?: { isContentEditable?: boolean; closest?: (selector: string) => unknown }) {
  return { tagName, ...extra } as unknown as EventTarget;
}

describe("study keyboard shortcuts", () => {
  it("maps space to flip and Q/E to the existing swipe directions", () => {
    expect(resolveStudyShortcut(key({ key: " " }))).toBe("flip");
    expect(resolveStudyShortcut(key({ key: "Spacebar" }))).toBe("flip");
    expect(resolveStudyShortcut(key({ key: "q" }))).toBe("left");
    expect(resolveStudyShortcut(key({ key: "Q" }))).toBe("left");
    expect(resolveStudyShortcut(key({ key: "e" }))).toBe("right");
    expect(resolveStudyShortcut(key({ key: "E" }))).toBe("right");
  });

  it("keeps space off the grading path used by left and right swipes", () => {
    expect(resolveStudyShortcut(key({ key: " " }))).toBe("flip");
    expect(resolveStudyShortcut(key({ key: "q" }))).not.toBe("flip");
    expect(resolveStudyShortcut(key({ key: "e" }))).not.toBe("flip");
    // Default gesture map is what the study screen already rates on swipe.
    expect(gestureToRating(DEFAULT_SETTINGS.gesture.left)).toBe(Rating.Again);
    expect(gestureToRating(DEFAULT_SETTINGS.gesture.right)).toBe(Rating.Good);
  });

  it("ignores unrelated keys, repeats, and modifier chords", () => {
    expect(resolveStudyShortcut(key({ key: "Enter" }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "ArrowLeft" }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "1" }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "q", repeat: true }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "e", metaKey: true }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "q", ctrlKey: true }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: " ", altKey: true }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "q", isComposing: true }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "e", defaultPrevented: true }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "q" }), { blocked: true })).toBeNull();
  });

  it("does not fire while typing in a field", () => {
    for (const tagName of ["INPUT", "textarea", "SELECT"]) {
      const target = field(tagName);
      expect(isStudyTypingTarget(target)).toBe(true);
      expect(resolveStudyShortcut(key({ key: " ", target }))).toBeNull();
      expect(resolveStudyShortcut(key({ key: "q", target }))).toBeNull();
      expect(resolveStudyShortcut(key({ key: "e", target }))).toBeNull();
    }
    const editable = field("div", { isContentEditable: true });
    expect(resolveStudyShortcut(key({ key: "q", target: editable }))).toBeNull();
    const nested = field("span", { closest: (selector) => (selector.includes("textarea") ? field("textarea") : null) });
    expect(resolveStudyShortcut(key({ key: "e", target: nested }))).toBeNull();
  });

  it("leaves space on buttons and links to those controls", () => {
    const button = field("button");
    expect(resolveStudyShortcut(key({ key: " ", target: button }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "q", target: button }))).toBe("left");
    expect(resolveStudyShortcut(key({ key: "e", target: button }))).toBe("right");

    const link = field("a");
    expect(resolveStudyShortcut(key({ key: " ", target: link }))).toBeNull();

    const roleButton = {
      tagName: "div",
      getAttribute: (name: string) => (name === "role" ? "button" : null),
    } as unknown as EventTarget;
    expect(resolveStudyShortcut(key({ key: " ", target: roleButton }))).toBeNull();

    const insideButton = field("span", {
      closest: (selector) => (selector.includes("button") ? field("button") : null),
    });
    expect(resolveStudyShortcut(key({ key: " ", target: insideButton }))).toBeNull();
    expect(resolveStudyShortcut(key({ key: "q", target: insideButton }))).toBe("left");
  });
});
