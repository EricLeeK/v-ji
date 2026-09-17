"use client";

import { useState } from "react";
import { CardFace } from "@/components/cards/card-face";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourcePopover } from "@/components/ai/source-popover";
import { DraftEditor } from "@/components/ai/draft-editor";
import type { Json, NoteType } from "@/types/database";
import type { CardLayout } from "@/lib/ai/schemas";
import { TEMPLATES } from "@/lib/templates";

export function DraftCard({
  card,
  selected,
  onSelect,
  onReject,
  onSave,
  sourceImageUrl,
}: {
  card: {
    id: string;
    type: NoteType;
    fields: Json;
    layout: string;
    sources: Json;
    flags: string[];
    status: string;
  };
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onReject: () => void;
  onSave: (patch: { type: NoteType; fields: Json; layout: string }) => Promise<void>;
  sourceImageUrl?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const label = TEMPLATES.find((item) => item.type === card.type)?.label ?? card.type;
  return (
    <article className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            disabled={card.status === "rejected" || card.status === "imported"}
          />
          {label}
        </label>
        <div className="flex flex-wrap gap-1">
          {card.flags.includes("needs_review") ? <Badge variant="outline">待核对</Badge> : null}
          {card.flags.includes("ai_supplemented") ? <Badge variant="secondary">AI 补充</Badge> : null}
          {card.status === "imported" ? <Badge>已导入</Badge> : null}
        </div>
      </div>
      <button type="button" className="w-full text-left" onClick={() => setRevealed((value) => !value)}>
        <CardFace
          type={card.type}
          fields={card.fields}
          ord={0}
          revealed={revealed}
          layout={card.layout as CardLayout}
          source={{ citations: Array.isArray(card.sources) ? card.sources : [] }}
          sourceImageUrl={sourceImageUrl}
        />
      </button>
      <p className="mt-2 text-[11px] text-muted-foreground">{revealed ? "点击收起答案" : "点击翻面预览"}</p>
      <SourcePopover sources={card.sources} />
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(true)}>
          编辑
        </Button>
        {card.status !== "imported" ? (
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onReject}>
            删除
          </Button>
        ) : null}
      </div>
      {editing ? (
        <DraftEditor
          type={card.type}
          fields={card.fields}
          layout={card.layout}
          onCancel={() => setEditing(false)}
          onSave={async (patch) => {
            await onSave(patch);
            setEditing(false);
          }}
        />
      ) : null}
    </article>
  );
}
