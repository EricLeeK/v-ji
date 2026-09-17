import { describe, expect, it } from "vitest";
import { studyDoneTitle, studyProgress, studySessionPhase } from "@/lib/study-progress";

describe("studyProgress", () => {
  it("tracks cleared cards from remaining queue length, never past 100%", () => {
    expect(studyProgress(37, 37)).toEqual({ cleared: 0, remaining: 37, total: 37, percent: 0 });
    expect(studyProgress(37, 36)).toMatchObject({ cleared: 1, remaining: 36, total: 37 });
    expect(studyProgress(37, 36).percent).toBeCloseTo(100 / 37, 5);
    expect(studyProgress(3, 0)).toEqual({ cleared: 3, remaining: 0, total: 3, percent: 100 });
  });

  it("does not jump to 100% while Again cards are still in the queue", () => {
    expect(studyProgress(3, 3).percent).toBe(0);
    expect(studyProgress(3, 1).cleared).toBe(2);
    expect(studyProgress(3, 1).percent).toBeCloseTo(200 / 3, 5);
    expect(studyProgress(3, 1).percent).toBeLessThan(100);
  });

  it("clamps remaining that exceeds total", () => {
    expect(studyProgress(0, 0).percent).toBe(0);
    expect(studyProgress(5, 8)).toEqual({ cleared: 0, remaining: 5, total: 5, percent: 0 });
  });

  it("uses session-scoped copy so a single deck is not called 今日已完成", () => {
    expect(studyDoneTitle("today")).toBe("今日已完成");
    expect(studyDoneTitle("deck")).toBe("本轮已完成");
  });

  it("does not treat an empty queue as a finished study session", () => {
    expect(studySessionPhase(0, 0)).toBe("empty");
    expect(studySessionPhase(4, 0)).toBe("done");
    expect(studySessionPhase(4, 2)).toBe("active");
  });
});
