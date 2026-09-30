import { describe, expect, it } from "vitest";
import { deckTone, isDeckColor, resolveDeckColor } from "@/lib/deck-tone";

describe("deck colors", () => {
  it("keeps an unset deck on its stable color", () => {
    expect(resolveDeckColor(null, "deck-1")).toBe(deckTone("deck-1"));
    expect(resolveDeckColor("not-a-color", "deck-1")).toBe(deckTone("deck-1"));
  });

  it("uses the color the user saved", () => {
    expect(isDeckColor("rose")).toBe(true);
    expect(resolveDeckColor("rose", "deck-1")).toBe("rose");
  });
});
