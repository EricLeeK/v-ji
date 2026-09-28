/** Desktop keys for the study card. Q/E are swipe directions; space only flips. */

export type StudyShortcut = "flip" | "left" | "right";

export type StudyShortcutEvent = {
  key: string;
  repeat?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target: EventTarget | null;
};

type ShortcutTarget = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

const TYPING_TAGS = new Set(["input", "textarea", "select"]);

function asTarget(target: EventTarget | null): ShortcutTarget | null {
  if (!target || typeof target !== "object") return null;
  if (!("tagName" in target) && !("isContentEditable" in target) && !("closest" in target)) {
    return null;
  }
  return target as ShortcutTarget;
}

function tagName(target: ShortcutTarget) {
  return target.tagName?.toLowerCase() ?? "";
}

/** Focus is in a field where typed characters must not trigger study shortcuts. */
export function isStudyTypingTarget(target: EventTarget | null) {
  const element = asTarget(target);
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (TYPING_TAGS.has(tagName(element))) return true;
  return Boolean(element.closest?.("input, textarea, select"));
}

/** Space still activates focused buttons and links. */
export function isStudyActivationTarget(target: EventTarget | null) {
  const element = asTarget(target);
  if (!element) return false;
  const tag = tagName(element);
  if (tag === "button" || tag === "summary" || tag === "a") return true;
  const role = element.getAttribute?.("role");
  if (role === "button" || role === "link") return true;
  return Boolean(element.closest?.("button, summary, a[href], [role='button'], [role='link']"));
}

/**
 * Map a keydown onto the study card.
 * `left` and `right` are the existing swipe directions.
 * `flip` only reveals the back and is never a grade.
 */
export function resolveStudyShortcut(
  event: StudyShortcutEvent,
  options?: { blocked?: boolean },
): StudyShortcut | null {
  if (options?.blocked) return null;
  if (
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.isComposing ||
    event.defaultPrevented
  ) {
    return null;
  }
  if (isStudyTypingTarget(event.target)) return null;

  const flip = event.key === " " || event.key === "Spacebar";
  const left = event.key === "q" || event.key === "Q";
  const right = event.key === "e" || event.key === "E";
  if (!flip && !left && !right) return null;
  if (flip && isStudyActivationTarget(event.target)) return null;
  if (flip) return "flip";
  if (left) return "left";
  return "right";
}
