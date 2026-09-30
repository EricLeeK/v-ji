import { expect, it } from "vitest";
import { orderByIds, pickShuffledIds, shuffleItems } from "@/lib/shuffle";

it("returns a new permutation and leaves the source list alone", () => {
  const source = ["a", "b", "c", "d"];
  let step = 0;
  const rolls = [0, 0.9, 0.2];
  const shuffled = shuffleItems(source, () => rolls[step++] ?? 0);
  expect(source).toEqual(["a", "b", "c", "d"]);
  expect(shuffled).toEqual(["b", "d", "c", "a"]);
  expect([...shuffled].sort()).toEqual(["a", "b", "c", "d"]);
});

it("picks a shuffled subset without repeating ids", () => {
  let step = 0;
  const rolls = [0, 0, 0.5];
  expect(pickShuffledIds(["a", "b", "c", "d"], 2, () => rolls[step++] ?? 0)).toEqual(["c", "b"]);
});

it("restores rows in the shuffled id order", () => {
  const rows = [{ id: "b", name: "乙" }, { id: "a", name: "甲" }, { id: "c", name: "丙" }];
  expect(orderByIds(rows, ["c", "a", "missing"])).toEqual([
    { id: "c", name: "丙" },
    { id: "a", name: "甲" },
  ]);
});
