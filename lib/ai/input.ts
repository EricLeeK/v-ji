import { AI_LIMITS } from "@/lib/ai/limits";

const SUPPORTED_SOURCE_KINDS = new Set(["text", "image", "pdf"]);
const MAX_SOURCE_NAME_LENGTH = 200;
const MAX_INSTRUCTION_LENGTH = 4_000;
const MAX_NEW_DECK_NAME_LENGTH = 120;

export type AiSourceInputLike = {
  kind?: unknown;
  name?: unknown;
  storagePath?: unknown;
  text?: unknown;
  sizeBytes?: unknown;
  pageRange?: { start?: unknown; end?: unknown } | unknown;
};

export function validateAiSourceInput(source: AiSourceInputLike, uid: string): string | null {
  if (!source || typeof source !== "object") return "资料格式无效";
  if (typeof source.kind !== "string" || !SUPPORTED_SOURCE_KINDS.has(source.kind)) {
    return "暂不支持该资料格式";
  }
  if (typeof source.name !== "string" || !source.name.trim() || source.name.length > MAX_SOURCE_NAME_LENGTH) {
    return "资料名称无效";
  }
  if (source.sizeBytes !== undefined && (!Number.isInteger(source.sizeBytes) || Number(source.sizeBytes) < 0)) {
    return "资料大小无效";
  }
  if (Number(source.sizeBytes) > 50 * 1024 * 1024) return "资料不能超过 50 MB";

  if (source.kind === "text") {
    if (source.storagePath !== undefined) return "文字资料不应包含存储文件";
    if (source.text !== undefined && typeof source.text !== "string") return "文字资料无效";
    if (typeof source.text === "string" && source.text.length > AI_LIMITS.maxTextTokens * 4) {
      return "资料文本过长，请缩小范围";
    }
  } else {
    if (typeof source.storagePath !== "string" || !isOwnStoragePath(source.storagePath, uid)) {
      return source.storagePath ? "资料存储路径无效" : "资料文件未上传";
    }
    if (source.text !== undefined) return "文件资料不应包含文字内容";
  }

  if (source.pageRange !== undefined) {
    if (!source.pageRange || typeof source.pageRange !== "object" || Array.isArray(source.pageRange)) {
      return "页码范围无效";
    }
    const range = source.pageRange as { start?: unknown; end?: unknown };
    if (
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.end) ||
      Number(range.start) < 1 ||
      Number(range.end) < Number(range.start) ||
      Number(range.end) > AI_LIMITS.maxPdfPages
    ) {
      return "页码范围无效";
    }
  }
  return null;
}

export function validateAiJobText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, MAX_INSTRUCTION_LENGTH);
}

export function validateNewDeckName(value: unknown, fallback = "AI 制卡") {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, MAX_NEW_DECK_NAME_LENGTH) || fallback;
}

export function isOwnStoragePath(path: string, uid: string) {
  const prefix = `${uid}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..") && !path.startsWith("/");
}
