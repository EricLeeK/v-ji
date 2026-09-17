import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens } from "@/lib/ai/chunk";

describe("estimateTokens", () => {
  it("estimates more tokens for longer Chinese text", () => {
    expect(estimateTokens("间隔重复")).toBeGreaterThan(0);
    expect(estimateTokens("间隔重复可以根据遗忘曲线安排复习时间")).toBeGreaterThan(
      estimateTokens("间隔重复"),
    );
  });
});

describe("chunkText", () => {
  it("splits long text by paragraphs and keeps offsets", () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => `第${i + 1}段。${"知识点内容。".repeat(40)}`);
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text, { sourceId: "src-1", maxChars: 400 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.locator.sourceId).toBe("src-1");
    expect(chunks[0]?.locator.offset).toBe(0);
    expect(chunks.at(-1)?.locator.offset).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.text.length <= 400)).toBe(true);
  });

  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("只有一段很短的内容。", { sourceId: "s" });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("很短");
  });
});
