import { describe, expect, it } from "vitest";
import { parseLearningHubBatch } from "./payload";

const hash = "a".repeat(64);

function item(overrides: Record<string, unknown> = {}) {
  return {
    external_id: "lesson:42",
    version: 1,
    type: "qa",
    fields: { question: "What is a closure?", answer: "A lexical scope." },
    tags: ["javascript"],
    source: "lesson-42.md",
    content_hash: hash,
    ...overrides,
  };
}

describe("parseLearningHubBatch", () => {
  it("accepts the documented six card types and preserves their payload", () => {
    const examples = [
      item(),
      item({ external_id: "note", type: "note", fields: { title: "Title", body: "Body" } }),
      item({ external_id: "choice", type: "choice", fields: { stem: "Pick", options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }], answer: "B" } }),
      item({ external_id: "cloze", type: "cloze", fields: { text: "{{c1::Paris}} is in France." } }),
      item({ external_id: "poem", type: "poem", fields: { original: "床前明月光" } }),
      item({ external_id: "vocab", type: "vocab", fields: { word: "lucid", meaning: "清晰的" } }),
    ];

    const result = parseLearningHubBatch(examples);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(examples);
  });

  it("rejects empty batches, batches over 50, and duplicate external IDs", () => {
    expect(parseLearningHubBatch([]).success).toBe(false);
    expect(parseLearningHubBatch(Array.from({ length: 51 }, (_, i) => item({ external_id: `id-${i}` }))).success).toBe(false);
    expect(parseLearningHubBatch([item(), item()]).success).toBe(false);
  });

  it("accepts Hub's largest supported source, note fields, and tag collection", () => {
    const longNote = item({
      type: "note",
      fields: { title: "T".repeat(1_000), body: "B".repeat(25_000) },
      tags: Array.from({ length: 50 }, () => "t".repeat(100)),
      source: "s".repeat(8_192),
    });

    const result = parseLearningHubBatch([longNote]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].fields).toEqual(longNote.fields);
      expect(result.data[0].tags).toHaveLength(50);
      expect(result.data[0].source).toHaveLength(8_192);
    }
  });

  it("accepts 500,000-character card fields and rejects oversized fields or batches", () => {
    const maximumField = item({ type: "note", fields: { body: "B".repeat(500_000) } });
    const oversizedField = item({ type: "note", fields: { body: "B".repeat(500_001) } });
    const oversizedBatch = Array.from({ length: 5 }, (_, index) => item({
      external_id: `large-${index}`,
      type: "note",
      fields: { body: "B".repeat(500_000) },
    }));

    expect(parseLearningHubBatch([maximumField]).success).toBe(true);
    expect(parseLearningHubBatch([oversizedField]).success).toBe(false);
    expect(parseLearningHubBatch(oversizedBatch).success).toBe(false);
  });

  it("rejects invalid versions, IDs, hashes, tags, and source values", () => {
    for (const invalid of [
      item({ external_id: " " }),
      item({ version: 0 }),
      item({ version: 1.5 }),
      item({ content_hash: "not-a-sha256" }),
      item({ tags: ["ok", 42] }),
      item({ source: { path: "lesson.md" } }),
    ]) {
      expect(parseLearningHubBatch([invalid]).success).toBe(false);
    }
  });

  it("rejects type-specific fields that cannot create a usable card", () => {
    for (const invalid of [
      item({ type: "qa", fields: { question: "Q", answer: " " } }),
      item({ type: "choice", fields: { stem: "Q", options: [{ key: "A", text: "Only one" }], answer: "A" } }),
      item({ type: "choice", fields: { stem: "Q", options: [{ key: "A", text: "One" }, { key: "A", text: "Two" }], answer: "A" } }),
      item({ type: "cloze", fields: { text: "No blank here" } }),
      item({ type: "vocab", fields: { word: "word", meaning: "" } }),
      item({ type: "poem", fields: { original: " " } }),
      item({ type: "note", fields: { title: "", body: "" } }),
      item({ type: "qa", fields: { question: "Q", answer: "A", extra: "unexpected" } }),
    ]) {
      expect(parseLearningHubBatch([invalid]).success).toBe(false);
    }
  });

  it("accepts Read Frog dictionary, sentence-analysis and writing cards", () => {
    const examples = [
      item({
        external_id: "dict",
        type: "dict",
        fields: {
          term: "retrieval",
          definition: "提取",
          context: "Information retrieval is useful.",
        },
      }),
      item({
        external_id: "sentence",
        type: "sentence",
        fields: {
          sentence: "The committee has postponed the decision.",
          annotations: JSON.stringify([
            { text: "The committee", type: "subject" },
            { text: "has postponed", type: "predicate" },
          ]),
          translation: "委员会推迟了决定。",
        },
      }),
      item({
        external_id: "writing",
        type: "writing",
        fields: {
          original: "I want to know.",
          annotations: JSON.stringify([
            { text: "I want to know", fix: "I was wondering", type: "register" },
          ]),
          improved: "I was wondering.",
        },
      }),
    ];

    const result = parseLearningHubBatch(examples);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(examples);
  });
});
