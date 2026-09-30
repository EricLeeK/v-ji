"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  SENTENCE_FORM_LABELS,
  SENTENCE_OBSTACLE_LABELS,
  SENTENCE_ROLE_LABELS,
  SENTENCE_SENSE_LABELS,
  breakWidth,
  canBreakBefore,
  clauseChipLabel,
  isCoreRole,
  isSentenceClause,
  isSentenceModifier,
  labeledRoles,
  sentenceExtraLabel,
  sentenceMark,
  type SentenceMark,
} from "@/lib/sentence-analysis";
import {
  isValidSentenceAnnotation,
  isValidWritingAnnotation,
  parseStructuredAnnotations,
  type SentenceAnnotation,
  type SentenceRole,
  type WritingAnnotation,
} from "@/lib/templates";

type Range<T> = { start: number; end: number; annotation: T };
type RangeNode<T> = Range<T> & { children: RangeNode<T>[] };

const MARK_CLASS: Record<SentenceMark, string> = {
  underline: "underline decoration-solid decoration-[1px] decoration-[#64748b] underline-offset-[3px]",
  wavy: "underline decoration-wavy decoration-[1.5px] decoration-[#4f78dc] underline-offset-[3px]",
  double: "underline decoration-double decoration-[3px] decoration-[#64748b] underline-offset-[2px]",
  dotted: "underline decoration-dotted decoration-[1.5px] decoration-[#64748b] underline-offset-[4px]",
  dashed: "underline decoration-dashed decoration-[1px] decoration-[#8c94a3] underline-offset-[3px]",
};

export function DictionaryFace({
  term,
  phonetic,
  partOfSpeech,
  definition,
  context,
  contextTerm,
  contextTranslation,
  difficulty,
  image,
  citation,
}: {
  term?: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  context?: string;
  contextTerm?: string;
  contextTranslation?: string;
  difficulty?: string;
  image?: React.ReactNode;
  citation?: string;
}) {
  return (
    <div className="space-y-3 text-center">
      {image}
      <div className="text-3xl font-semibold tracking-tight">{term}</div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        {phonetic ? <span>{phonetic}</span> : null}
        {partOfSpeech ? <span className="rounded-full bg-primary/10 px-2 py-0.5">{partOfSpeech}</span> : null}
        {difficulty ? <span className="rounded-full bg-secondary px-2 py-0.5">{difficulty}</span> : null}
      </div>
      {definition ? <p className="text-left text-[15px] leading-7">{definition}</p> : null}
      {context ? (
        <div className="rounded-2xl bg-secondary/60 px-3 py-2 text-left">
          <ContextSentence sentence={context} terms={parseContextTerms(contextTerm)} />
          {contextTranslation ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{contextTranslation}</p>
          ) : null}
        </div>
      ) : null}
      {citation ? <p className="text-left text-[11px] leading-5 text-muted-foreground">{citation}</p> : null}
    </div>
  );
}

export function SentenceFace({
  sentence,
  annotations: rawAnnotations,
  translation,
  citation,
}: {
  sentence?: string;
  annotations?: string;
  translation?: string;
  citation?: string;
}) {
  const source = sentence ?? "";
  const annotations =
    parseStructuredAnnotations<SentenceAnnotation>(rawAnnotations, isValidSentenceAnnotation) ?? [];
  const nodes = resolveRanges(source, annotations);
  const [trunk, setTrunk] = useState(false);
  const [slashes, setSlashes] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = findAnnotation(nodes, activeKey);
  const roles = labeledRoles(annotations);

  return (
    <div className="space-y-3" onPointerDown={(event) => event.stopPropagation()}>
      <p dir="auto" className="m-0 text-[15px] leading-normal">
        <SentenceRuns
          source={source}
          start={0}
          end={source.length}
          nodes={nodes}
          trunk={trunk}
          slashes={slashes}
          quiet={false}
          activeKey={activeKey}
          linkedText={active?.head}
          onSelect={(key) => setActiveKey((current) => (current === key ? null : key))}
        />
      </p>
      {active ? <SentenceDetail annotation={active} /> : null}
      {annotations.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <AnalysisToggle pressed={trunk} label="只看主干" onClick={() => setTrunk((value) => !value)} />
          <AnalysisToggle pressed={slashes} label="断句" onClick={() => setSlashes((value) => !value)} />
          {roles.length ? (
            <span className="ml-auto flex flex-wrap gap-x-2.5 text-xs leading-[22px]">
              {roles.map((role) => (
                <RoleSample key={role} role={role} />
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      {translation ? (
        <p dir="auto" className="mt-1 border-l-2 border-border pl-2.5 text-sm leading-[22px]">
          {translation}
        </p>
      ) : null}
      {citation ? <p className="text-[11px] leading-5 text-muted-foreground">{citation}</p> : null}
    </div>
  );
}

function AnalysisToggle({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-md border bg-transparent px-2 py-0.5 text-xs leading-4",
        pressed ? "border-[#2a57c4] bg-[#2a57c4]/10 text-[#2a57c4]" : "border-border text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function RoleSample({ role }: { role: SentenceRole }) {
  const mark = sentenceMark({ text: role, type: role });
  return (
    <span className={cn("font-medium", role === "predicate" && "text-[#2a57c4]", mark && MARK_CLASS[mark])}>
      {SENTENCE_ROLE_LABELS[role]}
    </span>
  );
}

function SentenceDetail({ annotation }: { annotation: SentenceAnnotation }) {
  const clause = clauseChipLabel(annotation);
  const role = SENTENCE_ROLE_LABELS[annotation.type];
  const form = annotation.form && annotation.form !== "clause" ? SENTENCE_FORM_LABELS[annotation.form] : null;
  const sense = !clause && annotation.sense ? SENTENCE_SENSE_LABELS[annotation.sense] : null;
  const obstacle = annotation.obstacle ? SENTENCE_OBSTACLE_LABELS[annotation.obstacle] ?? annotation.obstacle : null;
  return (
    <div className="rounded-xl bg-secondary/70 px-3 py-2 text-sm leading-6">
      <p>
        <b className={cn(annotation.type === "predicate" && "text-[#2a57c4]", (clause || annotation.type === "connector") && "text-[#177a53]")}>
          {clause ?? role}
        </b>
        {form ? <span className="text-muted-foreground"> · {form}</span> : null}
        {sense ? <span className="text-muted-foreground"> · {sense}</span> : null}
        {obstacle ? <span className="ml-1.5 font-semibold text-[#c43d27]">★ {obstacle}</span> : null}
      </p>
      {annotation.head ? <p>→ {annotation.head}</p> : null}
      {annotation.restore ? (
        <p>
          <span className="text-muted-foreground">还原：</span>
          {annotation.restore}
        </p>
      ) : null}
      {annotation.note ? <p>{annotation.note}</p> : null}
    </div>
  );
}

function SentenceRuns({
  source,
  start,
  end,
  nodes,
  trunk,
  slashes,
  quiet,
  activeKey,
  linkedText,
  onSelect,
}: {
  source: string;
  start: number;
  end: number;
  nodes: RangeNode<SentenceAnnotation>[];
  trunk: boolean;
  slashes: boolean;
  quiet: boolean;
  activeKey: string | null;
  linkedText?: string;
  onSelect: (key: string) => void;
}) {
  const output: React.ReactNode[] = [];
  let cursor = start;
  for (const node of nodes) {
    if (node.start < cursor || node.start < start || node.end > end) continue;
    if (node.start > cursor) output.push(source.slice(cursor, node.start));
    const showBreak = slashes && canBreakBefore(source, node.start);
    output.push(
      <span key={`${node.start}:${node.end}`} className="inline-flex items-baseline">
        {showBreak ? <BreakMark wide={breakWidth(node.annotation) === "wide"} /> : null}
        <SentenceMark
          node={node}
          source={source}
          trunk={trunk}
          slashes={slashes}
          quiet={quiet}
          activeKey={activeKey}
          linkedText={linkedText}
          onSelect={onSelect}
        />
      </span>,
    );
    cursor = Math.max(cursor, node.end);
  }
  if (cursor < end) output.push(source.slice(cursor, end));
  return <>{output}</>;
}

function SentenceMark({
  node,
  source,
  trunk,
  slashes,
  quiet,
  activeKey,
  linkedText,
  onSelect,
}: {
  node: RangeNode<SentenceAnnotation>;
  source: string;
  trunk: boolean;
  slashes: boolean;
  quiet: boolean;
  activeKey: string | null;
  linkedText?: string;
  onSelect: (key: string) => void;
}) {
  const annotation = node.annotation;
  const key = annotationKey(annotation, node.start);
  const clause = isSentenceClause(annotation);
  const modifier = isSentenceModifier(annotation);
  const chip = clauseChipLabel(annotation);
  const active = activeKey === key;
  const mark = sentenceMark(annotation);
  const extra = sentenceExtraLabel(annotation);
  const role = SENTENCE_ROLE_LABELS[annotation.type];
  const faded = quiet || modifier;
  const children = (
    <SentenceRuns
      source={source}
      start={node.start}
      end={node.end}
      nodes={node.children}
      trunk={trunk}
      slashes={slashes}
      quiet={quiet || clause || modifier}
      activeKey={activeKey}
      linkedText={linkedText}
      onSelect={onSelect}
    />
  );

  if (trunk && clause) {
    return (
      <span
        role="button"
        tabIndex={0}
        data-sentence-mark
        data-active={active ? "" : undefined}
        aria-pressed={active}
        aria-label={chip ?? role}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(key);
        }}
        onKeyDown={(event) => activateOnKey(event, () => onSelect(key))}
        className="inline rounded-[5px] bg-[rgb(23_122_83/0.08)] px-0.5"
      >
        <ClauseChip label={chip ?? "从句"} hard={Boolean(annotation.obstacle)} active={active} />
        <span className="text-[#8c94a3]"> …</span>
      </span>
    );
  }

  if (trunk && modifier) {
    return <span className="text-[#8c94a3]">…</span>;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      data-sentence-mark
      data-active={active ? "" : undefined}
      aria-pressed={active}
      aria-label={[chip ?? role, extra].filter(Boolean).join(" ")}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(key);
      }}
      onKeyDown={(event) => activateOnKey(event, () => onSelect(key))}
      className={cn(
        "mx-px mb-1 inline-flex max-w-full flex-col items-start align-baseline rounded-[5px]",
        clause && "bg-[rgb(23_122_83/0.08)] px-0.5",
        active && "bg-[#fde047]/50",
        !active && linkedText && annotation.text === linkedText && "bg-[#177a53]/20 font-bold",
      )}
    >
      <span
        className={cn(
          "min-w-0 max-w-full [box-decoration-break:clone]",
          mark && MARK_CLASS[mark],
          isCoreRole(annotation.type) && !faded && "font-semibold",
          annotation.type === "predicate" && "text-[#2a57c4]",
          annotation.type === "connector" && "font-semibold text-[#177a53]",
          annotation.type === "connector" && annotation.text.length <= 18 && "mx-[0.1em] rounded-full px-[0.3em] outline outline-[1.6px] outline-[#177a53]",
          faded && annotation.type !== "predicate" && annotation.type !== "connector" && "text-[#8c94a3]",
          modifier && !clause && wordCount(annotation.text) >= 3 && "underline decoration-[#177a53] underline-offset-[3px]",
        )}
      >
        {clause ? <ClauseChip label={chip ?? "从句"} hard={Boolean(annotation.obstacle)} active={active} /> : null}
        {annotation.type === "appositive" && !clause ? <span className="mr-[0.35em] text-[#8c94a3]">〈</span> : null}
        {children}
        {annotation.type === "appositive" && !clause ? <span className="ml-[0.35em] text-[#8c94a3]">〉</span> : null}
        {annotation.obstacle ? <span className="ml-0.5 text-[0.7em] text-[#c43d27]">★</span> : null}
      </span>
      {clause ? null : (
        <span
          className={cn(
            "mt-0.5 text-[10.5px] leading-none font-medium tracking-wide whitespace-nowrap",
            annotation.type === "predicate" ? "text-[#2a57c4]" : "text-[#8c94a3]",
          )}
        >
          {role}
          {extra ? (
            <b className={cn("ml-0.5 font-semibold", annotation.obstacle ? "text-[#c43d27]" : "text-[#177a53]")}>{extra}</b>
          ) : null}
        </span>
      )}
    </span>
  );
}

function ClauseChip({ label, hard, active }: { label: string; hard: boolean; active: boolean }) {
  return (
    <span
      className={cn(
        "mx-px mr-[3px] inline-block rounded border px-[3px] py-px align-[2px] text-[10px] leading-none font-semibold whitespace-nowrap",
        active ? "border-[#177a53] bg-[#177a53] text-white" : "border-[#177a53]/45 bg-white text-[#177a53]",
      )}
    >
      {label}
      {hard ? <b className={cn("ml-0.5", active ? "text-white" : "text-[#c43d27]")}>★</b> : null}
    </span>
  );
}

function BreakMark({ wide }: { wide: boolean }) {
  return (
    <span aria-hidden className={cn("mx-[0.12em] inline-block select-none font-light text-[#8c94a3]", wide && "tracking-[-0.12em]")}>
      {wide ? "//" : "/"}
    </span>
  );
}

function annotationKey(annotation: SentenceAnnotation, index: number) {
  return `${index}:${annotation.type}:${annotation.text}`;
}

function findAnnotation(nodes: RangeNode<SentenceAnnotation>[], key: string | null): SentenceAnnotation | null {
  if (!key) return null;
  for (const node of nodes) {
    if (annotationKey(node.annotation, node.start) === key) return node.annotation;
    const nested = findAnnotation(node.children, key);
    if (nested) return nested;
  }
  return null;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function activateOnKey(event: React.KeyboardEvent, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

export function WritingFace({
  original,
  annotations: rawAnnotations,
  improved,
  summary,
  citation,
}: {
  original?: string;
  annotations?: string;
  improved?: string;
  summary?: string;
  citation?: string;
}) {
  const annotations =
    parseStructuredAnnotations<WritingAnnotation>(rawAnnotations, isValidWritingAnnotation) ?? [];

  return (
    <div className="space-y-4">
      <p className="whitespace-pre-wrap text-[15px] leading-7">
        <RangeText<WritingAnnotation>
          source={original ?? ""}
          start={0}
          end={(original ?? "").length}
          nodes={resolveRanges(original ?? "", annotations)}
          render={(node, children) => (
            <span
              className={cn("rounded px-1", node.annotation.type === "good" ? "bg-emerald-500/10" : "bg-destructive/10")}
              title={[node.annotation.type, node.annotation.tag, node.annotation.note].filter(Boolean).join(" · ")}
            >
              {node.annotation.fix === "" ? <del className="opacity-70">{children}</del> : children}
              {node.annotation.fix ? <ins className="ml-1 text-primary no-underline">{node.annotation.fix}</ins> : null}
            </span>
          )}
        />
      </p>
      {improved ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">修改后</p>
          <p className="whitespace-pre-wrap rounded-2xl bg-primary/10 px-3 py-2 text-[15px] leading-7">{improved}</p>
        </div>
      ) : null}
      {annotations.some((item) => item.note) ? (
        <div className="space-y-1">
          {annotations
            .filter((item) => item.note)
            .map((item, index) => (
              <p key={`${item.text}-${index}`} className="text-xs leading-5 text-muted-foreground">
                {item.tag ? `${item.tag}：` : ""}
                {item.note}
              </p>
            ))}
        </div>
      ) : null}
      {summary ? <p className="text-sm leading-6 text-muted-foreground">{summary}</p> : null}
      {citation ? <p className="text-[11px] leading-5 text-muted-foreground">{citation}</p> : null}
    </div>
  );
}

function parseContextTerms(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) =>
      item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
        ? [(item as { text: string }).text]
        : [],
    );
  } catch {
    return [];
  }
}

function ContextSentence({ sentence, terms }: { sentence: string; terms: string[] }) {
  if (!terms.length) return <p className="whitespace-pre-wrap">{sentence}</p>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "g");
  return (
    <p className="whitespace-pre-wrap">
      {sentence.split(pattern).map((part, index) =>
        terms.includes(part) ? (
          <mark key={index} className="rounded bg-primary/20 px-1 text-primary">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveRanges<T extends SentenceAnnotation | WritingAnnotation>(
  source: string,
  annotations: T[],
): RangeNode<T>[] {
  const ranges: RangeNode<T>[] = [];
  for (const annotation of annotations) {
    const wanted = annotation.occurrence ?? 1;
    let cursor = 0;
    let end = -1;
    for (let found = 0; found < wanted; found += 1) {
      const index = source.indexOf(annotation.text, cursor);
      if (index < 0) {
        end = -1;
        break;
      }
      end = index + annotation.text.length;
      cursor = end;
    }
    if (end > 0) ranges.push({ start: end - annotation.text.length, end, annotation, children: [] });
  }

  ranges.sort((left, right) => left.start - right.start || right.end - left.start);
  const roots: RangeNode<T>[] = [];
  const stack: RangeNode<T>[] = [];
  for (const range of ranges) {
    while (stack.length && stack.at(-1)!.end < range.start) stack.pop();
    const parent = stack.at(-1);
    if (parent && range.end <= parent.end) {
      parent.children.push(range);
      stack.push(range);
      continue;
    }
    roots.push(range);
    stack.push(range);
  }
  return roots;
}

function RangeText<T extends SentenceAnnotation | WritingAnnotation>({
  source,
  start,
  end,
  nodes,
  render,
}: {
  source: string;
  start: number;
  end: number;
  nodes: RangeNode<T>[];
  render: (node: RangeNode<T>, children: React.ReactNode) => React.ReactNode;
}) {
  const output: React.ReactNode[] = [];
  let cursor = start;
  for (const node of nodes) {
    if (node.start < cursor) continue;
    if (node.start > cursor) output.push(source.slice(cursor, node.start));
    output.push(
      render(
        node,
        <RangeText source={source} start={node.start} end={node.end} nodes={node.children} render={render} />,
      ) ?? null,
    );
    cursor = Math.max(cursor, node.end);
  }
  if (cursor < end) output.push(source.slice(cursor, end));
  return <>{output}</>;
}
