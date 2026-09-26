import { expect, it } from "vitest";
import { reminderDue, reminderStorageKey } from "@/lib/reminder";

it("reminds once per local day, only after the saved time", () => {
  const settings = { enabled: true, time: "21:00" };
  expect(reminderDue(settings, new Date(2026, 8, 26, 20, 59), null)).toBe(false);
  expect(reminderDue(settings, new Date(2026, 8, 26, 21, 0), null)).toBe(true);
  expect(reminderDue(settings, new Date(2026, 8, 26, 21, 1), "2026-09-26")).toBe(false);
  expect(reminderDue(settings, new Date(2026, 8, 27, 21, 0), "2026-09-26")).toBe(true);
  expect(reminderDue({ ...settings, enabled: false }, new Date(2026, 8, 26, 23), null)).toBe(false);
});

it("isolates reminder history by account and ignores invalid times", () => {
  expect(reminderStorageKey("a")).not.toBe(reminderStorageKey("b"));
  expect(reminderDue({ enabled: true, time: "99:00" }, new Date(), null)).toBe(false);
});
