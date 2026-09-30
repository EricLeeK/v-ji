import { z } from "zod";

const longText = z.string().max(500_000);
const requiredText = longText.refine((value) => value.trim().length > 0);
const choiceOptionText = z.string().max(20_000).refine((value) => value.trim().length > 0);

const noteFields = z.object({
  title: longText.optional(),
  body: longText.optional(),
}).strict().refine((fields) => Boolean(fields.title?.trim() || fields.body?.trim()));

const qaFields = z.object({
  question: requiredText,
  answer: requiredText,
}).strict();

const choiceFields = z.object({
  stem: requiredText,
  options: z.array(z.object({ key: z.enum(["A", "B", "C", "D", "E", "F"]), text: choiceOptionText }).strict()).min(2).max(6),
  answer: z.enum(["A", "B", "C", "D", "E", "F"]),
  explain: longText.optional(),
}).strict().superRefine((fields, context) => {
  const keys = fields.options.map((option) => option.key);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", message: "选择题选项键不能重复", path: ["options"] });
  }
  if (!keys.includes(fields.answer)) {
    context.addIssue({ code: "custom", message: "答案必须对应一个选项", path: ["answer"] });
  }
});

const clozeFields = z.object({ text: requiredText }).strict().refine(({ text }) => {
  const starts = [...text.matchAll(/\{\{c\d+::/g)];
  const valid = [...text.matchAll(/\{\{c([1-9]\d*)::([^{}]+?)(?:::[^{}]*?)?\}\}/g)];
  if (!starts.length || starts.length !== valid.length) return false;
  const ids = valid.map((match) => Number(match[1]));
  return ids.every((id) => id <= 100) && new Set(ids).size > 0;
});

const poemFields = z.object({
  title: longText.optional(),
  author: longText.optional(),
  original: requiredText,
  translation: longText.optional(),
}).strict();

const vocabFields = z.object({
  word: requiredText,
  phonetic: longText.optional(),
  meaning: requiredText,
  example: longText.optional(),
}).strict();

const dictFields = z
  .object({
    term: requiredText,
    phonetic: longText.optional(),
    partOfSpeech: longText.optional(),
    definition: requiredText,
    context: longText.optional(),
    contextTerm: longText.optional(),
    contextTranslation: longText.optional(),
    difficulty: longText.optional(),
  })
  .strict()
  .superRefine((fields, context) => {
    if (!fields.contextTerm?.trim()) return;
    try {
      const parsed: unknown = JSON.parse(fields.contextTerm);
      const valid =
        Array.isArray(parsed) &&
        parsed.every(
          (item) =>
            Boolean(item) &&
            typeof item === "object" &&
            Object.keys(item as Record<string, unknown>).length === 1 &&
            typeof (item as { text?: unknown }).text === "string",
        );
      if (!valid) context.addIssue({ code: "custom", message: "词典语境词条必须是 {text} JSON 数组", path: ["contextTerm"] });
    } catch {
      context.addIssue({ code: "custom", message: "词典语境词条必须是 {text} JSON 数组", path: ["contextTerm"] });
    }
  });

const sentenceFields = z
  .object({
    sentence: requiredText,
    annotations: requiredText,
    translation: longText.optional(),
  })
  .strict()
  .superRefine((fields, context) => {
    if (!annotationList(fields.annotations, [
      "subject", "predicate", "object", "complement", "attributive", "adverbial", "appositive", "connector",
    ], ["text", "type", "form", "sense", "head", "obstacle", "restore", "note", "occurrence"])) {
      context.addIssue({ code: "custom", message: "长难句标注必须是有效的 JSON 数组", path: ["annotations"] });
    }
  });

const writingFields = z
  .object({
    original: requiredText,
    annotations: requiredText,
    improved: longText.optional(),
    summary: longText.optional(),
    setting: longText.optional(),
  })
  .strict()
  .superRefine((fields, context) => {
    if (!annotationList(fields.annotations, [
      "spelling", "grammar", "punctuation", "word-choice", "logic", "unnatural", "register", "clarity", "good",
    ], ["text", "fix", "type", "tag", "note", "occurrence"])) {
      context.addIssue({ code: "custom", message: "写作批改标注必须是有效的 JSON 数组", path: ["annotations"] });
    }
  });

const base = {
  external_id: z.string().min(1).max(300).refine((value) => value.trim().length > 0),
  version: z.number().int().min(1).max(2_147_483_647),
  tags: z.array(z.string().min(1).max(100).refine((value) => value.trim().length > 0)).max(50),
  source: z.string().min(1).max(8_192),
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
};

const itemSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("note"), fields: noteFields }).strict(),
  z.object({ ...base, type: z.literal("qa"), fields: qaFields }).strict(),
  z.object({ ...base, type: z.literal("choice"), fields: choiceFields }).strict(),
  z.object({ ...base, type: z.literal("cloze"), fields: clozeFields }).strict(),
  z.object({ ...base, type: z.literal("poem"), fields: poemFields }).strict(),
  z.object({ ...base, type: z.literal("vocab"), fields: vocabFields }).strict(),
  z.object({ ...base, type: z.literal("dict"), fields: dictFields }).strict(),
  z.object({ ...base, type: z.literal("sentence"), fields: sentenceFields }).strict(),
  z.object({ ...base, type: z.literal("writing"), fields: writingFields }).strict(),
]);

function annotationList(value: string, types: string[], keys: string[]): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    return parsed.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      return (
        Object.keys(record).every((key) => keys.includes(key)) &&
        typeof record.text === "string" &&
        record.text.trim().length > 0 &&
        typeof record.type === "string" &&
        types.includes(record.type) &&
        Object.entries(record).every(([key, itemValue]) =>
          key === "occurrence"
            ? itemValue === undefined ||
              (typeof itemValue === "number" &&
                Number.isInteger(itemValue) &&
                itemValue >= 1)
            : itemValue === undefined || typeof itemValue === "string",
        )
      );
    });
  } catch {
    return false;
  }
}

const batchSchema = z.array(itemSchema).min(1).max(50).superRefine((items, context) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.external_id)) {
      context.addIssue({ code: "custom", message: "external_id 不能重复", path: [index, "external_id"] });
    }
    seen.add(item.external_id);
  });
  const payloadBytes = new TextEncoder().encode(JSON.stringify(items)).byteLength;
  if (payloadBytes > 2 * 1024 * 1024) {
    context.addIssue({ code: "custom", message: "批次内容不能超过 2 MiB" });
  }
});

export type LearningHubNote = z.infer<typeof itemSchema>;

export function parseLearningHubBatch(input: unknown) {
  return batchSchema.safeParse(input);
}
