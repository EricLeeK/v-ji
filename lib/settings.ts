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
  const gesture = (value.gesture ?? {}) as Record<string, unknown>;
  const tts = (value.tts ?? {}) as Record<string, unknown>;
  const reminder = (value.reminder ?? {}) as Record<string, unknown>;
  return {
    gesture: {
      left: isGesture(gesture.left) ? gesture.left : DEFAULT_SETTINGS.gesture.left,
      right: isGesture(gesture.right)
        ? gesture.right
        : DEFAULT_SETTINGS.gesture.right,
    },
    tts: {
      lang: typeof tts.lang === "string" ? tts.lang : DEFAULT_SETTINGS.tts.lang,
      rate: typeof tts.rate === "number" ? tts.rate : DEFAULT_SETTINGS.tts.rate,
      voice: typeof tts.voice === "string" ? tts.voice : DEFAULT_SETTINGS.tts.voice,
    },
    reminder: {
      enabled:
        typeof reminder.enabled === "boolean"
          ? reminder.enabled
          : DEFAULT_SETTINGS.reminder.enabled,
      time:
        typeof reminder.time === "string"
          ? reminder.time
          : DEFAULT_SETTINGS.reminder.time,
    },
    requestRetention:
      typeof value.requestRetention === "number"
        ? value.requestRetention
        : DEFAULT_SETTINGS.requestRetention,
    newCardsPerDay:
      typeof value.newCardsPerDay === "number"
        ? value.newCardsPerDay
        : DEFAULT_SETTINGS.newCardsPerDay,
  };
}

function isGesture(value: unknown): value is GestureAction {
  return value === "again" || value === "hard" || value === "good" || value === "easy";
}
