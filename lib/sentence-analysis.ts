import type { SentenceAnnotation, SentenceRole } from "@/lib/templates";

export const SENTENCE_ROLE_LABELS: Record<SentenceRole, string> = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  complement: "补语",
  attributive: "定语",
  adverbial: "状语",
  appositive: "同位语",
  connector: "连接词",
};

const CLAUSE_LABELS: Record<SentenceRole, string> = {
  subject: "主语从句",
  predicate: "从句",
  object: "宾语从句",
  complement: "表语从句",
  attributive: "定语从句",
  adverbial: "状语从句",
  appositive: "同位语从句",
  connector: "从句",
};

const ADVERBIAL_CLAUSE_LABELS: Record<string, string> = {
  time: "时间状从",
  place: "地点状从",
  cause: "原因状从",
  condition: "条件状从",
  concession: "让步状从",
  purpose: "目的状从",
  result: "结果状从",
  manner: "方式状从",
  comparison: "比较状从",
};

export const SENTENCE_FORM_LABELS: Record<string, string> = {
  infinitive: "不定式",
  gerund: "动名词",
  "present-participle": "现在分词",
  "past-participle": "过去分词",
  clause: "从句",
};

export const SENTENCE_SENSE_LABELS: Record<string, string> = {
  time: "时间",
  place: "地点",
  cause: "原因",
  condition: "条件",
  concession: "让步",
  purpose: "目的",
  result: "结果",
  manner: "方式",
  comparison: "比较",
};

export const SENTENCE_OBSTACLE_LABELS: Record<string, string> = {
  inversion: "倒装",
  fronting: "前置",
  ellipsis: "省略",
  passive: "被动",
  subjunctive: "虚拟",
  parenthesis: "插入",
  "dummy-it": "形式主语",
  "postponed-subject": "真主语",
  cleft: "强调句",
  comparison: "比较",
  negation: "否定",
  split: "拆分",
  idiom: "习语",
};

const BREAK_PUNCTUATION = new Set(".,;:!?)]}\"'…，。；：！？、）」』》");

export type SentenceMark = "underline" | "wavy" | "double" | "dotted" | "dashed";

const CORE_ROLES = new Set<SentenceRole>(["subject", "predicate", "object", "complement"]);

export function isSentenceClause(annotation: SentenceAnnotation) {
  return annotation.form === "clause";
}

export function isSentenceModifier(annotation: SentenceAnnotation) {
  return (
    !isSentenceClause(annotation) &&
    (annotation.type === "attributive" || annotation.type === "adverbial" || annotation.type === "appositive")
  );
}

export function isCoreRole(role: SentenceRole) {
  return CORE_ROLES.has(role);
}

export function sentenceMark(annotation: SentenceAnnotation): SentenceMark | null {
  if (isSentenceClause(annotation) || annotation.type === "connector" || annotation.type === "attributive" || annotation.type === "appositive") {
    return null;
  }
  if (annotation.type === "subject") return "underline";
  if (annotation.type === "predicate") return "wavy";
  if (annotation.type === "object") return "double";
  if (annotation.type === "complement") return "dotted";
  if (annotation.type === "adverbial") return "dashed";
  return null;
}

export function clauseChipLabel(annotation: SentenceAnnotation) {
  if (!isSentenceClause(annotation)) return null;
  if (annotation.type === "adverbial" && annotation.sense && ADVERBIAL_CLAUSE_LABELS[annotation.sense]) {
    return ADVERBIAL_CLAUSE_LABELS[annotation.sense];
  }
  return CLAUSE_LABELS[annotation.type];
}

export function sentenceExtraLabel(annotation: SentenceAnnotation) {
  if (annotation.obstacle && SENTENCE_OBSTACLE_LABELS[annotation.obstacle]) {
    return SENTENCE_OBSTACLE_LABELS[annotation.obstacle];
  }
  if (annotation.form && annotation.form !== "clause" && SENTENCE_FORM_LABELS[annotation.form]) {
    if (annotation.type === "adverbial" && annotation.sense && SENTENCE_SENSE_LABELS[annotation.sense]) {
      return SENTENCE_SENSE_LABELS[annotation.sense];
    }
    return SENTENCE_FORM_LABELS[annotation.form];
  }
  if (isSentenceModifier(annotation) && annotation.sense && SENTENCE_SENSE_LABELS[annotation.sense]) {
    return SENTENCE_SENSE_LABELS[annotation.sense];
  }
  return null;
}

export function labeledRoles(annotations: SentenceAnnotation[]) {
  const used = new Set(annotations.filter((item) => !isSentenceClause(item)).map((item) => item.type));
  return (["subject", "predicate", "object", "complement"] as const).filter((role) => used.has(role));
}

export function canBreakBefore(source: string, index: number) {
  const before = source.slice(0, index).trimEnd();
  if (!before) return false;
  const last = before.at(-1);
  if (!last || BREAK_PUNCTUATION.has(last)) return false;
  const words = before.split(/\s+/).filter(Boolean);
  return words.length >= 2 || /[\u3400-\u9fff]/.test(before);
}

export function breakWidth(annotation: SentenceAnnotation): "wide" | "narrow" {
  return isSentenceClause(annotation) ? "wide" : "narrow";
}
