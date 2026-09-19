"use client";

import { AppIcon } from "@/components/app-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteNote, moveNote, toggleNoteStar } from "@/app/actions/notes";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notePreview, parseFields, TEMPLATES } from "@/lib/templates";
import type { Json, NoteType } from "@/types/database";
import { toast } from "sonner";

type NoteRow = {
  id: string;
  type: NoteType;
  fields: Json;
};

type CardRow = {
  note_id: string;
  state: number;
  suspended: boolean;
  starred: boolean;
  due: string;
};

type DeckOption = { id: string; name: string };

type FilterKey = "all" | "new" | "review" | "starred" | "suspended";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "new", label: "新卡" },
  { key: "review", label: "复习" },
  { key: "starred", label: "收藏" },
  { key: "suspended", label: "暂停" },
];

export function NoteList({
  deckId,
  notes,
  cards,
  otherDecks,
}: {
  deckId: string;
  notes: NoteRow[];
  cards: CardRow[];
  otherDecks: DeckOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [active, setActive] = useState<NoteRow | null>(null);
  const [moveTo, setMoveTo] = useState(otherDecks[0]?.id ?? "");
  const [now] = useState(() => Date.now());

  const items = useMemo(() => {
    return notes
      .map((note) => {
        const related = cards.filter((card) => card.note_id === note.id);
        const preview = notePreview(note.type, parseFields(note.fields));
        const starred = related.some((card) => card.starred);
        const suspended = related.length > 0 && related.every((card) => card.suspended);
        const isNew = related.some((card) => card.state === 0);
        const isReview = related.some(
          (card) => card.state !== 0 && !card.suspended && new Date(card.due).getTime() <= now,
        );
        return { note, preview, related, starred, suspended, isNew, isReview };
      })
      .filter((item) => {
        if (query.trim() && !item.preview.toLowerCase().includes(query.trim().toLowerCase())) {
          return false;
        }
        if (filter === "new") return item.isNew;
        if (filter === "review") return item.isReview;
        if (filter === "starred") return item.starred;
        if (filter === "suspended") return item.suspended;
        return true;
      });
  }, [cards, filter, notes, query, now]);

  function armLongPress(note: NoteRow, target: HTMLElement) {
    const timer = window.setTimeout(() => setActive(note), 520);
    const clear = () => window.clearTimeout(timer);
    target.addEventListener("pointerup", clear, { once: true });
    target.addEventListener("pointerleave", clear, { once: true });
    target.addEventListener("pointercancel", clear, { once: true });
  }

  return (
    <div className="mt-5 pb-8">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索卡片"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              filter === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map(({ note, preview, related, starred }) => (
          <li key={note.id}>
            <Link
              href={`/decks/${deckId}/cards/${note.id}`}
              onContextMenu={(event) => {
                event.preventDefault();
                setActive(note);
              }}
              onPointerDown={(event) => armLongPress(note, event.currentTarget)}
              className="block rounded-2xl bg-white px-4 py-3 active:scale-[0.99]"
            >
              <p className="font-medium">
                {starred ? <AppIcon name="star" className="mr-1 inline size-3" /> : null}
                {preview}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {TEMPLATES.find((item) => item.type === note.type)?.label ?? note.type} · {related.length} 张学习卡
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">没有符合条件的卡片</p>
      ) : null}

      <Sheet open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>卡片操作</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-6">
            <ActionButton
              onClick={async () => {
                if (!active) return;
                const related = cards.filter((card) => card.note_id === active.id);
                const starred = related.some((card) => card.starred);
                const result = await toggleNoteStar(active.id, !starred, deckId);
                if (result.error) toast.error(result.error);
                else {
                  toast.success(starred ? "已取消收藏" : "已收藏");
                  router.refresh();
                }
                setActive(null);
              }}
            >
              收藏 / 取消收藏
            </ActionButton>
            {otherDecks.length > 0 ? (
              <div className="rounded-2xl bg-muted/70 p-3">
                <p className="mb-2 text-sm">移动到其他卡片盒</p>
                <select
                  className="mb-2 w-full rounded-xl border bg-background px-2 py-2 text-sm"
                  value={moveTo}
                  onChange={(event) => setMoveTo(event.target.value)}
                >
                  {otherDecks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
                <ActionButton
                  onClick={async () => {
                    if (!active || !moveTo) return;
                    const result = await moveNote(active.id, deckId, moveTo);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("已移动");
                      router.refresh();
                    }
                    setActive(null);
                  }}
                >
                  确认移动
                </ActionButton>
              </div>
            ) : null}
            <ActionButton
              danger
              onClick={async () => {
                if (!active) return;
                const result = await deleteNote(active.id, deckId);
                if (result.error) toast.error(result.error);
                else {
                  toast.success("已删除");
                  router.refresh();
                }
                setActive(null);
              }}
            >
              删除卡片
            </ActionButton>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 w-full rounded-2xl text-sm ${
        danger ? "bg-destructive/10 text-destructive" : "bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
