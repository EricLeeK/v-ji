"use client";

import { useState } from "react";
import type { Json } from "@/types/database";
import type { CardCitation } from "@/lib/ai/schemas";

export function SourcePopover({ sources }: { sources: Json }) {
  const [open, setOpen] = useState(false);
  const citations = Array.isArray(sources) ? (sources as CardCitation[]) : [];
  if (!citations.length) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-xs text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "收起来源" : "展开来源"}
      </button>
      {open ? (
        <ul className="mt-2 space-y-2 rounded-2xl bg-muted/60 p-3 text-xs leading-5">
          {citations.map((item, index) => (
            <li key={`${item.sourceId}-${index}`}>
              <p className="font-medium">
                {item.name ?? "资料"}
                {item.page ? ` · 第 ${item.page} 页` : ""}
              </p>
              {item.excerpt ? <p className="mt-1 text-muted-foreground">{item.excerpt}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
