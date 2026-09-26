import { expect, it } from "vitest";
import { spokenText } from "@/components/cards/card-face";

it("does not read hidden cloze answers before the card is revealed", () => {
  const fields = { text: "{{c1::北京}}是中国首都，{{c2::巴黎}}是法国首都。" };
  expect(spokenText("cloze", fields, false, 0)).toBe("空白是中国首都，巴黎是法国首都。");
  expect(spokenText("cloze", fields, false, 1)).toBe("北京是中国首都，空白是法国首都。");
  expect(spokenText("cloze", fields, true, 0)).toBe("北京是中国首都，巴黎是法国首都。");
});
