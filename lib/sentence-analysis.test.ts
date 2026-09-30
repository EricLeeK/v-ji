import { describe, expect, it } from "vitest";
import {
  breakWidth,
  canBreakBefore,
  clauseChipLabel,
  isSentenceModifier,
  labeledRoles,
  sentenceExtraLabel,
  sentenceMark,
} from "@/lib/sentence-analysis";
import type { SentenceAnnotation } from "@/lib/templates";

function mark(partial: Partial<SentenceAnnotation> & Pick<SentenceAnnotation, "text" | "type">): SentenceAnnotation {
  return partial;
}

describe("sentence analysis marks", () => {
  it("gives each core role its own line and labels the clause", () => {
    expect(sentenceMark(mark({ text: "The committee", type: "subject" }))).toBe("underline");
    expect(sentenceMark(mark({ text: "has postponed", type: "predicate" }))).toBe("wavy");
    expect(sentenceMark(mark({ text: "the decision", type: "object" }))).toBe("double");
    expect(sentenceMark(mark({ text: "ready", type: "complement" }))).toBe("dotted");
    expect(sentenceMark(mark({ text: "until Friday", type: "adverbial" }))).toBe("dashed");
    expect(
      clauseChipLabel(mark({ text: "until Friday", type: "adverbial", form: "clause", sense: "time" })),
    ).toBe("时间状从");
    expect(isSentenceModifier(mark({ text: "until Friday", type: "adverbial" }))).toBe(true);
    expect(isSentenceModifier(mark({ text: "until Friday", type: "adverbial", form: "clause" }))).toBe(false);
  });

  it("shows the obstacle or the form under the role name", () => {
    expect(sentenceExtraLabel(mark({ text: "was made", type: "predicate", obstacle: "passive" }))).toBe("被动");
    expect(sentenceExtraLabel(mark({ text: "to leave", type: "object", form: "infinitive" }))).toBe("不定式");
    expect(sentenceExtraLabel(mark({ text: "The committee", type: "subject" }))).toBeNull();
  });

  it("breaks the sentence at constituent boundaries, and uses a wider mark before a clause", () => {
    const sentence = "The committee has postponed the decision until Friday.";
    expect(canBreakBefore(sentence, sentence.indexOf("has"))).toBe(true);
    expect(canBreakBefore(sentence, 0)).toBe(false);
    expect(canBreakBefore("Hello, world starts", "Hello, world starts".indexOf("world"))).toBe(false);
    expect(breakWidth(mark({ text: "that he left", type: "object", form: "clause" }))).toBe("wide");
    expect(breakWidth(mark({ text: "until Friday", type: "adverbial" }))).toBe("narrow");
  });

  it("lists only the core roles that actually appear", () => {
    expect(
      labeledRoles([
        mark({ text: "The committee", type: "subject" }),
        mark({ text: "has postponed", type: "predicate" }),
        mark({ text: "until Friday", type: "adverbial" }),
      ]),
    ).toEqual(["subject", "predicate"]);
  });
});
