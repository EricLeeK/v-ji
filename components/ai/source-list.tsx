"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PendingSource } from "@/components/ai/source-input";

export function SourceList({
  sources,
  onRemove,
  onChangeRange,
}: {
  sources: PendingSource[];
  onRemove: (id: string) => void;
  onChangeRange: (id: string, pageRange: { start: number; end: number }) => void;
}) {
  if (!sources.length) return null;
  return (
    <ul className="space-y-2">
      {sources.map((source, index) => (
        <li key={source.id} className="rounded-2xl border border-border bg-card px-3 py-2.5">
          <div className="flex items-start gap-2">
            <GripVertical className="mt-1 size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {index + 1}. {source.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {labelOf(source.kind)}
                {source.sizeBytes ? ` · ${Math.ceil(source.sizeBytes / 1024)} KB` : ""}
              </p>
              {source.kind === "pdf" ? (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">页码</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16"
                    value={source.pageRange?.start ?? 1}
                    onChange={(event) =>
                      onChangeRange(source.id, {
                        start: Number(event.target.value) || 1,
                        end: source.pageRange?.end ?? (Number(event.target.value) || 1),
                      })
                    }
                  />
                  <span>-</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16"
                    value={source.pageRange?.end ?? 60}
                    onChange={(event) =>
                      onChangeRange(source.id, {
                        start: source.pageRange?.start ?? 1,
                        end: Number(event.target.value) || 1,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => onRemove(source.id)} aria-label="删除资料">
              <Trash2 className="size-4 text-muted-foreground" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function labelOf(kind: PendingSource["kind"]) {
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "图片";
  return "文字";
}
