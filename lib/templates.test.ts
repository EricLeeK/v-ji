import { describe, expect, it } from "vitest";
import {
  MAX_CHOICE_OPTIONS,
  TEMPLATES,
  addChoiceOption,
  choiceOptionTone,
  emptyFields,
  removeChoiceOption,
  sanitizeChoiceFields,
  setChoiceOptionText,
  validateNoteFields,
} from "@/lib/templates";

describe("choice templates", () => {
  it("exposes a 选择题 preset among the card templates", () => {
    expect(TEMPLATES.some((item) => item.type === "choice" && item.label === "选择题")).toBe(true);
  });

  it("starts a choice card with four blank A–D options", () => {
    const fields = emptyFields("choice");
    expect(fields.options?.map((option) => option.key)).toEqual(["A", "B", "C", "D"]);
    expect(fields.answer).toBe("A");
  });

  it("adds the next lettered option up to six", () => {
    const fields = emptyFields("choice");
    const next = addChoiceOption(fields);
    expect(next.options.map((option) => option.key)).toEqual(["A", "B", "C", "D", "E"]);
    expect(next.answer).toBe("A");

    let capped = next;
    while (capped.options.length < MAX_CHOICE_OPTIONS) {
      capped = addChoiceOption(capped);
    }
    const stillCapped = addChoiceOption(capped);
    expect(stillCapped.options).toHaveLength(6);
  });

  it("rekeys remaining options and keeps the correct answer after a deletion", () => {
    const fields = {
      options: [
        { key: "A", text: "苹果" },
        { key: "B", text: "香蕉" },
        { key: "C", text: "梨" },
      ],
      answer: "C",
    };
    const removedB = removeChoiceOption(fields, "B");
    expect(removedB.options).toEqual([
      { key: "A", text: "苹果" },
      { key: "B", text: "梨" },
    ]);
    expect(removedB.answer).toBe("B");

    const removedCorrect = removeChoiceOption(fields, "C");
    expect(removedCorrect.options.map((option) => option.text)).toEqual(["苹果", "香蕉"]);
    expect(removedCorrect.answer).toBe("A");
  });

  it("does not drop below two options", () => {
    const fields = {
      options: [
        { key: "A", text: "对" },
        { key: "B", text: "错" },
      ],
      answer: "B",
    };
    expect(removeChoiceOption(fields, "A")).toEqual(fields);
  });

  it("updates option text by key", () => {
    const options = setChoiceOptionText(emptyFields("choice").options ?? [], "C", "光合作用");
    expect(options[2]).toEqual({ key: "C", text: "光合作用" });
  });

  it("marks picked, correct and wrong options after answering", () => {
    expect(choiceOptionTone("B", "C", undefined, false)).toBe("idle");
    expect(choiceOptionTone("C", "C", "C", true)).toBe("correct");
    expect(choiceOptionTone("A", "C", "A", true)).toBe("wrong");
    expect(choiceOptionTone("B", "C", "A", true)).toBe("idle");
    expect(choiceOptionTone("A", "C", "A", false)).toBe("picked");
  });

  it("drops blank options and keeps the correct answer before save", () => {
    expect(
      sanitizeChoiceFields({
        options: [
          { key: "A", text: "FSRS" },
          { key: "B", text: " " },
          { key: "C", text: "Git" },
        ],
        answer: "C",
      }),
    ).toEqual({
      options: [
        { key: "A", text: "FSRS" },
        { key: "B", text: "Git" },
      ],
      answer: "B",
    });
    expect(sanitizeChoiceFields({ options: [{ key: "A", text: "只填了一个" }], answer: "A" })).toBeNull();
  });
});

describe("validateNoteFields", () => {
  it("rejects empty study-ready fields for each template", () => {
    expect(validateNoteFields("qa", emptyFields("qa"))).toMatch(/问题|答案/);
    expect(validateNoteFields("choice", emptyFields("choice"))).toMatch(/题干|选项/);
    expect(validateNoteFields("cloze", { text: "没有挖空的句子" })).toMatch(/挖空/);
    expect(validateNoteFields("vocab", emptyFields("vocab"))).toMatch(/单词|释义/);
    expect(validateNoteFields("poem", emptyFields("poem"))).toMatch(/原文/);
    expect(validateNoteFields("note", emptyFields("note"))).toMatch(/标题|正文/);
  });

  it("accepts filled cards", () => {
    expect(validateNoteFields("qa", { question: "2+2", answer: "4" })).toBeNull();
    expect(
      validateNoteFields("choice", {
        stem: "1+1",
        options: [
          { key: "A", text: "1" },
          { key: "B", text: "2" },
        ],
        answer: "B",
      }),
    ).toBeNull();
    expect(validateNoteFields("cloze", { text: "海内存知己，{{c1::天涯若比邻}}。" })).toBeNull();
  });
});
