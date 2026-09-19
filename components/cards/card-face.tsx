"use client";

import { choiceOptionTone, parseFields } from "@/lib/templates";
import { clozeParts, stripCloze } from "@/lib/cloze";
import type { NoteType } from "@/types/database";
import type { Json } from "@/types/database";
import { cn } from "@/lib/utils";
import type { CardLayout, NoteSource } from "@/lib/ai/schemas";
import { protectCardImageUrl } from "@/lib/card-image-url";

export function CardFace({
  type,
  fields,
  ord,
  revealed,
  layout = "minimal",
  source,
  sourceImageUrl,
  selectedKey,
  onSelectOption,
}: {
  type: NoteType;
  fields: Json;
  ord: number;
  revealed: boolean;
  layout?: CardLayout | string;
  source?: Json | NoteSource | null;
  sourceImageUrl?: string;
  selectedKey?: string;
  onSelectOption?: (key: string) => void;
}) {
  const data = parseFields(fields);
  const imageSrc = protectCardImageUrl(sourceImageUrl || data.imageUrl);
  const illustrated = layout === "illustrated" && imageSrc;
  const image = imageSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt=""
      className={cn(
        "mb-3 w-full rounded-2xl object-cover",
        illustrated ? "max-h-56" : "max-h-40",
      )}
    />
  ) : null;
  const citation = sourceCaption(source);

  if (type === "vocab") {
    return (
      <div className="space-y-3 text-center">
        {image}
        <div className="text-3xl font-semibold tracking-tight">{data.word}</div>
        {data.phonetic ? <p className="text-sm text-muted-foreground">{data.phonetic}</p> : null}
        {revealed ? (
          <div className="space-y-2 text-left text-[15px] leading-7">
            <EmphasisText text={data.meaning} layout={layout} />
            {data.example ? <p className="text-muted-foreground">{data.example}</p> : null}
            <SourceLine text={citation} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">回忆释义与例句</p>
        )}
      </div>
    );
  }

  if (type === "poem") {
    return (
      <div className="space-y-3">
        {image}
        <div>
          <div className="text-xl font-semibold">{data.title}</div>
          {data.author ? <p className="mt-1 text-sm text-muted-foreground">{data.author}</p> : null}
        </div>
        <p className="whitespace-pre-wrap text-[17px] leading-8">{data.original}</p>
        {revealed && data.translation ? (
          <p className="text-sm leading-6 text-muted-foreground">{data.translation}</p>
        ) : null}
        {revealed ? <SourceLine text={citation} /> : null}
      </div>
    );
  }

  if (type === "cloze") {
    const parts = clozeParts(data.text ?? "", ord);
    return (
      <div className="space-y-3">
        {image}
        <p className="text-[17px] leading-8 whitespace-pre-wrap">
          {parts.map((part, index) =>
            part.type === "text" ? (
              <span key={index}>{part.value}</span>
            ) : (
              <span
                key={index}
                aria-label={revealed ? part.answer : "挖空"}
                className={cn(
                  "mx-0.5 inline-block rounded-md px-1.5 align-baseline font-medium",
                  revealed
                    ? "bg-primary/15 text-primary"
                    : "border-b-2 border-primary/30 bg-primary/10",
                )}
                style={{ minWidth: `${Math.max(2, part.answer.length)}em` }}
              >
                {revealed ? part.answer : "\u00a0"}
              </span>
            ),
          )}
        </p>
        {revealed ? <SourceLine text={citation} /> : null}
      </div>
    );
  }

  if (type === "choice") {
    const interactive = Boolean(onSelectOption) && !revealed;
    return (
      <div className="space-y-4">
        {image}
        <p className="text-[16px] leading-7 font-medium">{data.stem}</p>
        <ul className="space-y-2">
          {(data.options ?? []).map((option) => {
            const tone = choiceOptionTone(option.key, data.answer, selectedKey, revealed);
            const className = cn(
              "w-full rounded-2xl border px-3 py-2.5 text-left text-sm",
              tone === "correct" && "border-primary bg-primary/10 text-primary",
              tone === "wrong" && "border-destructive bg-destructive/10 text-destructive",
              tone === "picked" && "border-primary bg-primary/5",
              tone === "idle" && "border-border",
            );
            const body = (
              <>
                <span className="mr-2 font-semibold">{option.key}.</span>
                {option.text}
              </>
            );
            if (interactive) {
              return (
                <li key={option.key}>
                  <button
                    type="button"
                    className={className}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectOption?.(option.key);
                    }}
                  >
                    {body}
                  </button>
                </li>
              );
            }
            return (
              <li key={option.key} className={className}>
                {body}
              </li>
            );
          })}
        </ul>
        {revealed && selectedKey && selectedKey !== data.answer ? (
          <p className="text-sm text-destructive">
            你选了 {selectedKey}，正确答案是 {data.answer}
          </p>
        ) : null}
        {revealed && data.explain ? (
          <p className="text-sm leading-6 text-muted-foreground">{data.explain}</p>
        ) : null}
        {revealed ? <SourceLine text={citation} /> : null}
      </div>
    );
  }

  if (type === "note") {
    return (
      <div className="space-y-3">
        {image}
        <h2 className="text-xl font-semibold">{data.title}</h2>
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
          {revealed ? data.body : "点击卡片查看笔记正文"}
        </p>
        {revealed ? <SourceLine text={citation} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {image}
      <p className="text-[17px] leading-8 font-medium">{data.question}</p>
      {revealed ? (
        <div className="space-y-2">
          <EmphasisText text={data.answer} layout={layout} />
          <SourceLine text={citation} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">先在心里作答，再看答案</p>
      )}
    </div>
  );
}

function EmphasisText({ text, layout }: { text?: string; layout?: string }) {
  const value = text ?? "";
  if (layout !== "emphasis") {
    return <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">{value}</p>;
  }
  const lines = value.split(/\n+/).filter(Boolean);
  if (lines.length <= 1) {
    return <p className="whitespace-pre-wrap text-[15px] leading-7 font-medium">{value}</p>;
  }
  return (
    <ul className="space-y-1.5 text-[15px] leading-7">
      {lines.map((line) => (
        <li key={line} className="rounded-xl bg-primary/5 px-3 py-1.5 font-medium">
          {line}
        </li>
      ))}
    </ul>
  );
}

function SourceLine({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-[11px] leading-5 text-muted-foreground">{text}</p>;
}

function sourceCaption(source?: Json | NoteSource | null) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const value = source as NoteSource & { excerpt?: string; page?: number; file?: string };
  const first = value.citations?.[0];
  const page = first?.page ?? value.page;
  const name = first?.name ?? value.file;
  const excerpt = first?.excerpt ?? value.excerpt;
  const bits = [name, page ? `第 ${page} 页` : null, excerpt].filter(Boolean);
  return bits.length ? `来源：${bits.join(" · ")}` : undefined;
}

export function spokenText(type: NoteType, fields: Json, revealed: boolean) {
  const data = parseFields(fields);
  if (type === "vocab") return revealed ? `${data.word}。${data.meaning}` : data.word || "";
  if (type === "poem") return data.original || "";
  if (type === "cloze") return stripCloze(data.text ?? "");
  if (type === "choice") return data.stem || "";
  if (type === "note") return `${data.title ?? ""}。${revealed ? data.body ?? "" : ""}`;
  return revealed ? `${data.question}。${data.answer}` : data.question || "";
}
