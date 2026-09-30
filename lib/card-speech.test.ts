import { expect, it } from "vitest";
import { spokenText } from "@/components/cards/card-face";

it("does not read hidden cloze answers before the card is revealed", () => {
  const fields = { text: "{{c1::北京}}是中国首都，{{c2::巴黎}}是法国首都。" };
  expect(spokenText("cloze", fields, false, 0)).toBe("空白是中国首都，巴黎是法国首都。");
  expect(spokenText("cloze", fields, false, 1)).toBe("北京是中国首都，空白是法国首都。");
  expect(spokenText("cloze", fields, true, 0)).toBe("北京是中国首都，巴黎是法国首都。");
});

it("speaks the source sentence for Read Frog structured cards", () => {
  expect(spokenText("dict", { term: "retrieval" }, false)).toBe("retrieval");
  expect(
    spokenText("sentence", { sentence: "The committee met." }, false),
  ).toBe("The committee met.");
  expect(
    spokenText("writing", { original: "Please explain me." }, false),
  ).toBe("Please explain me.");
});
