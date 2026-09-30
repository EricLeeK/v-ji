import { cn } from "@/lib/utils";
import {
  isValidSentenceAnnotation,
  isValidWritingAnnotation,
  parseStructuredAnnotations,
  type SentenceAnnotation,
  type WritingAnnotation,
} from "@/lib/templates";

type Range<T> = { start: number; end: number; annotation: T };
type RangeNode<T> = Range<T> & { children: RangeNode<T>[] };

const ROLE_STYLES: Record<string, string> = {
  subject: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  predicate: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  object: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  complement: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  attributive: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  adverbial: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  appositive: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  connector: "bg-muted text-muted-foreground",
};

const ROLE_LABELS: Record<string, string> = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  complement: "补语",
  attributive: "定语",
  adverbial: "状语",
  appositive: "同位语",
  connector: "连接词",
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
  const annotations =
    parseStructuredAnnotations<SentenceAnnotation>(rawAnnotations, isValidSentenceAnnotation) ?? [];
  const restores = [...new Set(annotations.map((item) => item.restore).filter(Boolean))];
  const chips = annotations.filter((item) => item.obstacle || item.note || item.form || item.sense);

  return (
    <div className="space-y-4">
      <p className="whitespace-pre-wrap text-[17px] leading-8">
        <RangeText<SentenceAnnotation>
          source={sentence ?? ""}
          start={0}
          end={(sentence ?? "").length}
          nodes={resolveRanges(sentence ?? "", annotations)}
          render={(node, children) => (
            <span
              className={cn(
                "rounded px-1",
                ROLE_STYLES[node.annotation.type],
                node.annotation.obstacle &&
                  "underline decoration-wavy decoration-amber-500 underline-offset-4",
              )}
              title={[ROLE_LABELS[node.annotation.type], node.annotation.form, node.annotation.sense, node.annotation.obstacle, node.annotation.note]
                .filter(Boolean)
                .join(" · ")}
            >
              {children}
            </span>
          )}
        />
      </p>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((item, index) => (
            <span key={`${item.text}-${index}`} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-5">
              {[ROLE_LABELS[item.type], item.form, item.sense, item.obstacle, item.note]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ))}
        </div>
      ) : null}
      {restores.length ? (
        <div className="rounded-2xl bg-secondary/60 px-3 py-2 text-sm leading-6">
          <p className="mb-1 text-xs font-medium text-muted-foreground">还原</p>
          {restores.map((restore) => (
            <p key={restore}>{restore}</p>
          ))}
        </div>
      ) : null}
      {translation ? <p className="text-sm leading-7 text-muted-foreground">{translation}</p> : null}
      {citation ? <p className="text-[11px] leading-5 text-muted-foreground">{citation}</p> : null}
    </div>
  );
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
