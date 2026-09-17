import { describe, expect, it } from "vitest";
import { dedupeCards, validateCard } from "@/lib/ai/validate";
import type { GeneratedCardInput } from "@/lib/ai/schemas";

describe("validateCard", () => {
  it("accepts a well-formed qa card", () => {
    const result = validateCard(
      {
        type: "qa",
        layout: "minimal",
        fields: { question: "什么是间隔重复？", answer: "根据遗忘曲线安排复习。" },
        sourceChunkIds: ["c1"],
      },
      ["qa", "cloze"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.card.fields.question).toContain("间隔重复");
  });

  it("rejects types the user did not allow", () => {
    const result = validateCard(
      {
        type: "poem",
        layout: "minimal",
        fields: { title: "静夜思", author: "李白", original: "床前明月光", translation: "月光" },
        sourceChunkIds: ["c1"],
      },
      ["qa"],
    );
    expect(result.ok).toBe(false);
  });

  it("rejects choice cards whose answer is not an option key", () => {
    const result = validateCard(
      {
        type: "choice",
        layout: "minimal",
        fields: {
          stem: "FSRS 属于？",
          options: [
            { key: "A", text: "间隔重复算法" },
            { key: "B", text: "笔记软件" },
          ],
          answer: "C",
          explain: "答错了",
        },
        sourceChunkIds: ["c1"],
      },
      ["choice"],
    );
    expect(result.ok).toBe(false);
  });

  it("rejects cloze cards without cloze syntax or with too many blanks", () => {
    const missing = validateCard(
      { type: "cloze", layout: "minimal", fields: { text: "没有挖空" }, sourceChunkIds: ["c1"] },
      ["cloze"],
    );
    expect(missing.ok).toBe(false);

    const tooMany = validateCard(
      {
        type: "cloze",
        layout: "minimal",
        fields: {
          text: "{{c1::一}} {{c2::二}} {{c3::三}} {{c4::四}}",
        },
        sourceChunkIds: ["c1"],
      },
      ["cloze"],
    );
    expect(tooMany.ok).toBe(false);
  });

  it("rejects empty qa, note, vocab and poem fields", () => {
    expect(
      validateCard(
        { type: "qa", layout: "minimal", fields: { question: " ", answer: "" }, sourceChunkIds: [] },
        ["qa"],
      ).ok,
    ).toBe(false);
    expect(
      validateCard(
        { type: "note", layout: "minimal", fields: { title: "", body: "内容" }, sourceChunkIds: ["c1"] },
        ["note"],
      ).ok,
    ).toBe(false);
    expect(
      validateCard(
        { type: "vocab", layout: "minimal", fields: { word: "card", meaning: "" }, sourceChunkIds: ["c1"] },
        ["vocab"],
      ).ok,
    ).toBe(false);
    expect(
      validateCard(
        { type: "poem", layout: "minimal", fields: { title: "诗", original: "", translation: "译" }, sourceChunkIds: ["c1"] },
        ["poem"],
      ).ok,
    ).toBe(false);
  });

  it("marks cards without sources as needs_review in source-only mode", () => {
    const result = validateCard(
      {
        type: "qa",
        layout: "minimal",
        fields: { question: "问题", answer: "答案" },
        sourceChunkIds: [],
        supplemented: true,
      },
      ["qa"],
      { grounding: "source_only" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.card.flags).toContain("needs_review");
  });
});

describe("dedupeCards", () => {
  it("drops near-duplicate questions and keeps the first", () => {
    const a: GeneratedCardInput = {
      type: "qa",
      layout: "minimal",
      fields: { question: "什么是间隔重复", answer: "A" },
      sourceChunkIds: ["c1"],
    };
    const b: GeneratedCardInput = {
      type: "qa",
      layout: "minimal",
      fields: { question: "什么是间隔重复？", answer: "B" },
      sourceChunkIds: ["c1"],
    };
    const first = validateCard(a, ["qa"]);
    const second = validateCard(b, ["qa"]);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const unique = dedupeCards([first.card, second.card]);
    expect(unique).toHaveLength(1);
    expect(unique[0].fields.answer).toBe("A");
  });
});
