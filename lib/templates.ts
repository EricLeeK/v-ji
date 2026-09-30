import { clozeIds } from "@/lib/cloze";
import type { Json, NoteType } from "@/types/database";

export type ChoiceOption = { key: string; text: string };

export type SentenceRole =
  | "subject"
  | "predicate"
  | "object"
  | "complement"
  | "attributive"
  | "adverbial"
  | "appositive"
  | "connector";

export type SentenceAnnotation = {
  text: string;
  type: SentenceRole;
  form?: string;
  sense?: string;
  head?: string;
  obstacle?: string;
  restore?: string;
  note?: string;
  occurrence?: number;
};

export type WritingIssueType =
  | "spelling"
  | "grammar"
  | "punctuation"
  | "word-choice"
  | "logic"
  | "unnatural"
  | "register"
  | "clarity"
  | "good";

export type WritingAnnotation = {
  text: string;
  fix?: string;
  type: WritingIssueType;
  tag?: string;
  note?: string;
  occurrence?: number;
};

export type NoteFields = {
  title?: string;
  body?: string;
  question?: string;
  answer?: string;
  stem?: string;
  options?: ChoiceOption[];
  explain?: string;
  text?: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  term?: string;
  partOfSpeech?: string;
  context?: string;
  contextTerm?: string;
  contextTranslation?: string;
  difficulty?: string;
  definition?: string;
  sentence?: string;
  annotations?: string;
  setting?: string;
  improved?: string;
  summary?: string;
  translation?: string;
  original?: string;
  author?: string;
  imageUrl?: string;
};

export const CHOICE_KEYS = ["A", "B", "C", "D", "E", "F"] as const;
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 6;

export type ChoiceOptionTone = "idle" | "picked" | "correct" | "wrong";

export const TEMPLATES: {
  type: NoteType;
  label: string;
  description: string;
}[] = [
  { type: "qa", label: "问答题", description: "一面问题，一面答案" },
  { type: "choice", label: "选择题", description: "题干、选项，点选正确答案" },
  { type: "cloze", label: "挖空", description: "选中关键词生成填空" },
  { type: "vocab", label: "英语单词", description: "单词、音标、释义、例句" },
  { type: "poem", label: "古诗文", description: "原文、译文与作者" },
  { type: "note", label: "笔记卡", description: "标题与正文，适合概念整理" },
  { type: "dict", label: "词典卡", description: "词条、词性、语境与难度" },
  { type: "sentence", label: "长难句卡", description: "成分、从句、难点与译文" },
  { type: "writing", label: "写作批改卡", description: "原文标记、修改与总评" },
];

export function emptyFields(type: NoteType): NoteFields {
  switch (type) {
    case "choice":
      return {
        stem: "",
        options: [
          { key: "A", text: "" },
          { key: "B", text: "" },
          { key: "C", text: "" },
          { key: "D", text: "" },
        ],
        answer: "A",
        explain: "",
      };
    case "vocab":
      return { word: "", phonetic: "", meaning: "", example: "" };
    case "poem":
      return { title: "", author: "", original: "", translation: "" };
    case "cloze":
      return { text: "" };
    case "note":
      return { title: "", body: "" };
    case "dict":
      return { term: "", phonetic: "", partOfSpeech: "", definition: "", context: "", contextTerm: "", contextTranslation: "", difficulty: "" };
    case "sentence":
      return { sentence: "", annotations: "[]", translation: "" };
    case "writing":
      return { original: "", annotations: "[]", improved: "", summary: "", setting: "" };
    default:
      return { question: "", answer: "" };
  }
}

export function parseFields(raw: Json | null | undefined): NoteFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as NoteFields;
}

type ChoiceFields = {
  options?: ChoiceOption[];
  answer?: string;
};

function rekeyChoiceOptions(options: ChoiceOption[], answer?: string): Required<ChoiceFields> {
  const answerIndex = options.findIndex((option) => option.key === answer);
  const next = options.map((option, index) => ({
    key: CHOICE_KEYS[index] ?? String.fromCharCode(65 + index),
    text: option.text,
  }));
  return {
    options: next,
    answer: next[answerIndex >= 0 ? answerIndex : 0]?.key ?? "A",
  };
}

export function addChoiceOption(fields: ChoiceFields): Required<ChoiceFields> {
  const options = [...(fields.options ?? [])];
  if (options.length >= MAX_CHOICE_OPTIONS) {
    return rekeyChoiceOptions(options, fields.answer);
  }
  options.push({ key: CHOICE_KEYS[options.length] ?? "A", text: "" });
  return rekeyChoiceOptions(options, fields.answer);
}

export function removeChoiceOption(fields: ChoiceFields, key: string): Required<ChoiceFields> {
  const options = fields.options ?? [];
  if (options.length <= MIN_CHOICE_OPTIONS) {
    return { options, answer: fields.answer ?? "A" };
  }
  return rekeyChoiceOptions(
    options.filter((option) => option.key !== key),
    fields.answer,
  );
}

export function setChoiceOptionText(options: ChoiceOption[], key: string, text: string) {
  return options.map((option) => (option.key === key ? { ...option, text } : option));
}

export function sanitizeChoiceFields(fields: ChoiceFields): Required<ChoiceFields> | null {
  const filled = (fields.options ?? []).filter((option) => option.text.trim());
  if (filled.length < MIN_CHOICE_OPTIONS) return null;
  return rekeyChoiceOptions(filled, fields.answer);
}

export function choiceOptionTone(
  key: string,
  answer: string | undefined,
  picked: string | undefined,
  revealed: boolean,
): ChoiceOptionTone {
  if (revealed) {
    if (key === answer) return "correct";
    if (picked && key === picked) return "wrong";
    return "idle";
  }
  return picked === key ? "picked" : "idle";
}

export function validateNoteFields(type: NoteType, fields: NoteFields): string | null {
  switch (type) {
    case "qa":
      if (!fields.question?.trim() || !fields.answer?.trim()) return "请填写问题和答案";
      return null;
    case "choice":
      if (!fields.stem?.trim()) return "请填写题干";
      if (!sanitizeChoiceFields(fields)) return "选择题至少需要 2 个已填写的选项";
      return null;
    case "cloze":
      if (!fields.text?.trim()) return "请填写挖空正文";
      if (clozeIds(fields.text).length === 0) return "请至少挖空一处";
      return null;
    case "vocab":
      if (!fields.word?.trim() || !fields.meaning?.trim()) return "请填写单词和释义";
      return null;
    case "poem":
      if (!fields.original?.trim()) return "请填写原文";
      return null;
    case "note":
      if (!fields.title?.trim() && !fields.body?.trim()) return "请填写标题或正文";
      return null;
    case "dict":
      if (!fields.term?.trim() || !fields.definition?.trim()) return "请填写词条和释义";
      return null;
    case "sentence":
      if (!fields.sentence?.trim()) return "请填写要分析的句子";
      if (!parseStructuredAnnotations<SentenceAnnotation>(fields.annotations, isValidSentenceAnnotation)) return "标注须为包含 text 和有效 type 的 JSON 数组";
      return null;
    case "writing":
      if (!fields.original?.trim()) return "请填写待批改原文";
      if (!parseStructuredAnnotations<WritingAnnotation>(fields.annotations, isValidWritingAnnotation)) return "标注须为包含 text 和有效 type 的 JSON 数组";
      return null;
    default:
      return null;
  }
}

export function notePreview(type: NoteType, fields: NoteFields) {
  switch (type) {
    case "vocab":
      return fields.word || "未命名单词";
    case "poem":
      return fields.title || fields.original?.slice(0, 18) || "古诗文";
    case "cloze":
      return fields.text?.replace(/\{\{c\d+::(.*?)}}/g, "$1").slice(0, 24) || "挖空卡片";
    case "choice":
      return fields.stem || "选择题";
    case "note":
      return fields.title || fields.body?.slice(0, 18) || "笔记";
    case "dict":
      return fields.term || "词典卡";
    case "sentence":
      return fields.sentence?.slice(0, 24) || "长难句";
    case "writing":
      return fields.original?.slice(0, 24) || "写作批改";
    default:
      return fields.question || "问答题";
  }
}

export function parseStructuredAnnotations<T>(
  value: string | undefined,
  isValid: (item: unknown) => item is T,
): T[] | null {
  if (!value?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => isValid(item))) return null;
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isValidOccurrence(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value) && value >= 1)
  );
}

const SENTENCE_ROLES = new Set<SentenceRole>([
  "subject", "predicate", "object", "complement", "attributive", "adverbial", "appositive", "connector",
]);

export function isValidSentenceAnnotation(value: unknown): value is SentenceAnnotation {
  if (!isRecord(value) || !isNonemptyString(value.text)) return false;
  if (typeof value.type !== "string" || !SENTENCE_ROLES.has(value.type as SentenceRole)) return false;
  return (
    isOptionalString(value.form) &&
    isOptionalString(value.sense) &&
    isOptionalString(value.head) &&
    isOptionalString(value.obstacle) &&
    isOptionalString(value.restore) &&
    isOptionalString(value.note) &&
    isValidOccurrence(value.occurrence)
  );
}

const WRITING_ISSUE_TYPES = new Set<WritingIssueType>([
  "spelling", "grammar", "punctuation", "word-choice", "logic", "unnatural", "register", "clarity", "good",
]);

export function isValidWritingAnnotation(value: unknown): value is WritingAnnotation {
  if (!isRecord(value) || !isNonemptyString(value.text)) return false;
  if (typeof value.type !== "string" || !WRITING_ISSUE_TYPES.has(value.type as WritingIssueType)) return false;
  return (
    isOptionalString(value.fix) &&
    isOptionalString(value.tag) &&
    isOptionalString(value.note) &&
    isValidOccurrence(value.occurrence)
  );
}
