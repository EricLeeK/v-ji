import type { Json } from "@/types/database";
import { parseSettings, type UserSettings } from "@/lib/settings";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_CHAT_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;
export const DEEPSEEK_MODEL = "deepseek-flash";
export const MISSING_DEEPSEEK_KEY = "尚未配置 DeepSeek API Key，请到设置中填写";

export function asSettingsRecord(raw: Json | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

export type DeepseekKeyStatus = {
  configured: boolean;
  masked: string | null;
};

export function normalizeDeepseekApiKey(
  raw: string,
): { ok: true; key: string } | { ok: false; error: string } {
  const key = raw.trim();
  if (!key) return { ok: false, error: "请填写 DeepSeek API Key" };
  if (!key.startsWith("sk-") || key.length < 20) {
    return { ok: false, error: "DeepSeek API Key 格式不正确" };
  }
  return { ok: true, key };
}

export function getDeepseekApiKey(raw: Json | null | undefined): string | null {
  const value = asSettingsRecord(raw).deepseekApiKey;
  if (typeof value !== "string") return null;
  const parsed = normalizeDeepseekApiKey(value);
  return parsed.ok ? parsed.key : null;
}

export function deepseekKeyStatus(raw: Json | null | undefined): DeepseekKeyStatus {
  const key = getDeepseekApiKey(raw);
  return key ? { configured: true, masked: maskSecret(key) } : { configured: false, masked: null };
}

export function maskSecret(value: string) {
  const key = value.trim();
  if (key.length < 8) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function overlayUserSettings(raw: Json | null | undefined, patch: UserSettings): Json {
  return {
    ...asSettingsRecord(raw),
    ...parseSettings(patch as unknown as Json),
  } as Json;
}

export function withDeepseekApiKey(raw: Json | null | undefined, apiKey: string | null): Json {
  const next = asSettingsRecord(raw);
  if (apiKey) next.deepseekApiKey = apiKey;
  else delete next.deepseekApiKey;
  return next as Json;
}
