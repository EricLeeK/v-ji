import { clozeIds } from "@/lib/cloze";
import { notePreview, parseFields, type NoteFields } from "@/lib/templates";
import type { NoteType } from "@/types/database";
import {
  generatedCardInputSchema,
  type AiGrounding,
  type CardLayout,
  type GeneratedCardInput,
  type ValidatedCard,
} from "@/lib/ai/schemas";

const CHOICE_KEYS = /^[A-F]$/;

export function validateCard(
  input: unknown,
  allowedTypes: NoteType[],
  options: { grounding?: AiGrounding } = {},
): { ok: true; card: ValidatedCard } | { ok: false; errors: string[] } {
  const parsed = generatedCardInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const data = parsed.data;
  if (!allowedTypes.includes(data.type)) {
    return { ok: false, errors: [`不允许的题型：${data.type}`] };
  }
  const fields = parseFields(data.fields as NoteFields);
  const errors = fieldErrors(data.type, fields);
  if (errors.length) return { ok: false, errors };

  const flags: string[] = [];
  if (data.supplemented) flags.push("ai_supplemented");
  if (options.grounding === "source_only" && data.sourceChunkIds.length === 0) {
    flags.push("needs_review");
  }
  if (options.grounding === "allow_supplement" && data.supplemented) {
    if (!flags.includes("ai_supplemented")) flags.push("ai_supplemented");
  }

  return {
    ok: true,
    card: {
      type: data.type,
      layout: (data.layout ?? "minimal") as CardLayout,
      fields,
      sourceChunkIds: data.sourceChunkIds,
      flags,
    },
  };
}

export function dedupeCards(cards: ValidatedCard[]): ValidatedCard[] {
  const kept: ValidatedCard[] = [];
  for (const card of cards) {
    const preview = normalize(notePreview(card.type, card.fields));
    const duplicate = kept.some((item) => similar(preview, normalize(notePreview(item.type, item.fields))));
    if (!duplicate) kept.push(card);
  }
  return kept;
}

function fieldErrors(type: NoteType, fields: NoteFields): string[] {
  switch (type) {
    case "qa":
      return required(fields, [
        ["question", "问题"],
        ["answer", "答案"],
      ]);
    case "note":
      return required(fields, [
        ["title", "标题"],
        ["body", "正文"],
      ]);
    case "vocab":
      return required(fields, [
        ["word", "单词"],
        ["meaning", "释义"],
      ]);
    case "poem":
      return required(fields, [
        ["title", "标题"],
        ["original", "原文"],
        ["translation", "译文"],
      ]);
    case "cloze": {
      const text = fields.text?.trim() ?? "";
      if (!text) return ["挖空正文不能为空"];
      const ids = clozeIds(text);
      if (ids.length === 0) return ["挖空卡必须包含 {{cN::...}} 语法"];
      if (ids.length > 3) return ["单张挖空卡最多 3 个空"];
      return [];
    }
    case "choice": {
      const options = fields.options ?? [];
      if (options.length < 2 || options.length > 6) return ["选择题需要 2–6 个选项"];
      if (options.some((option) => !option.key.trim() || !option.text.trim() || !CHOICE_KEYS.test(option.key))) {
        return ["选项必须包含 A–F 的 key 和非空文本"];
      }
      const keys = new Set(options.map((option) => option.key));
      if (!fields.answer || !keys.has(fields.answer)) return ["正确答案必须是已有选项"];
      if (!fields.stem?.trim()) return ["题干不能为空"];
      return [];
    }
    default:
      return ["未知题型"];
  }
}

function required(fields: NoteFields, pairs: Array<[keyof NoteFields, string]>) {
  return pairs.flatMap(([key, label]) => {
    const value = fields[key];
    return typeof value === "string" && value.trim() ? [] : [`${label}不能为空`];
  });
}

function normalize(value: string) {
  return value.replace(/[？?。.!！\s]/g, "").toLowerCase();
}

function similar(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const ch of setA) if (setB.has(ch)) overlap += 1;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 && overlap / union >= 0.82;
}

export type { GeneratedCardInput };
