import type { Json } from "@/types/database";

export type GestureAction = "again" | "hard" | "good" | "easy";

export type UserSettings = {
  gesture: { left: GestureAction; right: GestureAction };
  tts: { lang: string; rate: number; voice: string };
  reminder: { enabled: boolean; time: string };
  requestRetention: number;
  newCardsPerDay: number;
};

export const DEFAULT_SETTINGS: UserSettings = {
  gesture: { left: "again", right: "good" },
  tts: { lang: "zh-CN", rate: 1, voice: "" },
  reminder: { enabled: false, time: "21:00" },
  requestRetention: 0.9,
  newCardsPerDay: 20,
};

export function parseSettings(raw: Json | null | undefined): UserSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_SETTINGS;
  }
  const value = raw as Record<string, unknown>;
  const gesture = record(value.gesture);
  const tts = record(value.tts);
  const reminder = record(value.reminder);
  return {
    gesture: {
      left: isGesture(gesture.left) ? gesture.left : DEFAULT_SETTINGS.gesture.left,
      right: isGesture(gesture.right)
        ? gesture.right
        : DEFAULT_SETTINGS.gesture.right,
    },
    tts: {
      lang: validLanguage(tts.lang) ? tts.lang as string : DEFAULT_SETTINGS.tts.lang,
      rate: inRange(tts.rate, 0.6, 1.4) ? tts.rate as number : DEFAULT_SETTINGS.tts.rate,
      voice: typeof tts.voice === "string" ? tts.voice : DEFAULT_SETTINGS.tts.voice,
    },
    reminder: {
      enabled:
        typeof reminder.enabled === "boolean"
          ? reminder.enabled
          : DEFAULT_SETTINGS.reminder.enabled,
      time:
        validTime(reminder.time)
          ? reminder.time as string
          : DEFAULT_SETTINGS.reminder.time,
    },
    requestRetention:
      inRange(value.requestRetention, 0.8, 0.97)
        ? value.requestRetention as number
        : DEFAULT_SETTINGS.requestRetention,
    newCardsPerDay:
      inRange(value.newCardsPerDay, 0, 200) && Number.isInteger(value.newCardsPerDay)
        ? value.newCardsPerDay as number
        : DEFAULT_SETTINGS.newCardsPerDay,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function inRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validLanguage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
}

export function validateSettings(raw: unknown): Record<string, string> {
  const value = record(raw), tts = record(value.tts), gesture = record(value.gesture), reminder = record(value.reminder);
  const errors: Record<string, string> = {};
  if (!inRange(value.newCardsPerDay, 0, 200) || !Number.isInteger(value.newCardsPerDay)) errors.newCardsPerDay = "每日新卡上限须为 0–200 的整数";
  if (!inRange(value.requestRetention, 0.8, 0.97)) errors.requestRetention = "目标记忆率须为 80%–97%";
  if (!validLanguage(tts.lang)) errors.lang = "请输入有效语言代码，例如 zh-CN 或 en-US";
  if (!inRange(tts.rate, 0.6, 1.4)) errors.rate = "语速须为 0.6–1.4";
  if (typeof tts.voice !== "string" || tts.voice.length > 200) errors.voice = "请选择有效音色";
  if (!isGesture(gesture.left) || !isGesture(gesture.right)) errors.gesture = "请选择有效的滑动操作";
  if (typeof reminder.enabled !== "boolean" || !validTime(reminder.time)) errors.time = "请选择有效的提醒时间";
  return errors;
}

function isGesture(value: unknown): value is GestureAction {
  return value === "again" || value === "hard" || value === "good" || value === "easy";
}
