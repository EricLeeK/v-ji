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
]);

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
