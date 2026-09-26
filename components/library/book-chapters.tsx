import { ChevronDown } from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { clozeIds } from "@/lib/cloze";
import { parseFields } from "@/lib/templates";
import { CardFace } from "@/components/cards/card-face";
import type { Tables } from "@/types/database";

const MARK: Record<string, string> = { star: "star", diamond: "diamond", hollow: "star", normal: "dot" };

export function BookChapters({ notes, toc }: { notes: Tables<"book_notes">[]; toc: Array<{ title?: string; importance?: string; count?: number }> }) {
  const chapters: typeof toc = toc.length ? toc : [...new Set(notes.map(note => note.chapter ?? "未分类"))].map(title => ({ title }));
  return <ul className="space-y-2">
    {chapters.map((item, index) => {
      const examples = notes.filter(note => (note.chapter ?? "未分类") === item.title);
      const cardCount = examples.reduce((total, note) => total + (note.type === "cloze" ? Math.max(1, clozeIds(parseFields(note.fields).text ?? "").length) : 1), 0);
      return <li key={`${item.title}-${index}`}>
        <details className="app-card group rounded-2xl">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
            <AppIcon name={MARK[item.importance ?? "normal"] ?? "dot"} className="size-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.title ?? "章节"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{cardCount} 张</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-border/70 p-3">
            {examples.length ? <>
              <p className="text-xs text-muted-foreground">本章预览 · 前 {Math.min(3, examples.length)} 条笔记</p>
              {examples.slice(0, 3).map(note => <div key={note.id} className="rounded-xl bg-primary/5 p-3"><CardFace type={note.type} fields={note.fields} ord={0} revealed /></div>)}
            </> : <p className="text-xs leading-5 text-muted-foreground">本章暂无内容。</p>}
          </div>
        </details>
      </li>;
    })}
  </ul>;
}
