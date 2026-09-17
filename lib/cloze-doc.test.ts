import { describe, expect, it } from "vitest";
import { clozeTextToDoc, docToClozeText } from "@/lib/cloze-doc";

describe("cloze document serialization", () => {
  it("round-trips Anki-style cloze tokens through the Tiptap JSON", () => {
    const source = "Scientists {{c1::hypothesize}} that species will {{c2::adapt}}.";
    const doc = clozeTextToDoc(source);
    expect(docToClozeText(doc)).toBe(source);
  });

  it("keeps plain text without cloze marks", () => {
    expect(docToClozeText(clozeTextToDoc("海内存知己"))).toBe("海内存知己");
  });
});
