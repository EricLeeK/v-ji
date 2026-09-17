import { describe, expect, it } from "vitest";
import { buildHeatmap, heatLevel, sumSince } from "@/lib/heatmap";

describe("heatmap", () => {
  it("fills a full 16-week grid and maps reviews onto the right day", () => {
    const days = buildHeatmap([{ date: "2026-09-14", reviews: 3 }], "2026-09-14", 16);
    expect(days).toHaveLength(112);
    expect(days.find((day) => day.date === "2026-09-14")?.count).toBe(3);
    expect(days[0]?.date <= "2026-09-14").toBe(true);
  });

  it("buckets intensity by review count", () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(6)).toBe(2);
    expect(heatLevel(12)).toBe(3);
  });

  it("sums stats from a start date", () => {
    const result = sumSince(
      [
        { date: "2026-09-01", reviews: 4, study_seconds: 120 },
        { date: "2026-09-10", reviews: 2, study_seconds: 60 },
      ],
      "2026-09-08",
    );
    expect(result).toEqual({ reviews: 2, seconds: 60 });
  });
});
