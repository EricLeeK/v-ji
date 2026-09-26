"use client";

import { AppIcon } from "@/components/app-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { deleteNote, moveNote, toggleNoteStar, suspendNote } from "@/app/actions/notes";
import { MoreHorizontal } from "lucide-react";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TEMPLATES } from "@/lib/templates";
import { buildNoteIndex, filterNoteIndex, type IndexedNote, type NoteRow, type NoteCardRow as CardRow, type NoteFilter as FilterKey } from "@/lib/note-list-index";
import { toast } from "sonner";

type DeckOption = { id: string; name: string };

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

  const { pending, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [cardPatches, setCardPatches] = useState<Record<string, Partial<Pick<CardRow, "starred" | "suspended">>>>({});
  const [serverRows, setServerRows] = useState({ notes, cards });
  // Keep immediate feedback until refreshed server rows arrive. Do not mask a
  // later edit or a note moved back into this deck during client navigation.
  if (serverRows.notes !== notes || serverRows.cards !== cards) {
    setServerRows({ notes, cards });
    setHiddenIds([]);
    setCardPatches({});
  }
  const visibleNotes = useMemo(() => notes.filter(note => !hiddenIds.includes(note.id)), [notes, hiddenIds]);
  const displayedCards = useMemo(() => cards.map(card => cardPatches[card.note_id] ? { ...card, ...cardPatches[card.note_id] } : card), [cards, cardPatches]);
  const longPressed = useRef(false);
  const related = displayedCards.filter(card => card.note_id === active?.id);
  const starred = related.some(card => card.starred);
  const paused = related.some(card => card.suspended);
  const activate = (note: NoteRow | null) => { setActive(note); setConfirmDelete(false); };
  const changed = (message: string, patch?: Partial<Pick<CardRow, "starred" | "suspended">>, hide = false) => {
    if (active && hide) setHiddenIds(ids => [...ids, active.id]);
    if (active && patch) setCardPatches(patches => ({ ...patches, [active.id]: { ...patches[active.id], ...patch } }));
    toast.success(message); activate(null); router.refresh();
  };

  const deferredQuery = useDeferredValue(query);
  const index = useMemo(() => buildNoteIndex(visibleNotes, displayedCards, now), [visibleNotes, displayedCards, now]);
  const items = useMemo(() => filterNoteIndex(index, deferredQuery, filter), [index, deferredQuery, filter]);

  function armLongPress(note: NoteRow, target: HTMLElement) {
    longPressed.current = false;
    const timer = window.setTimeout(() => { longPressed.current = true; activate(note); }, 520);
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
        aria-label="搜索卡片"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              filter === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <NoteResults key={`${filter}:${deferredQuery}`} items={items} deckId={deckId} onActivate={activate} onLongPress={armLongPress} suppressClick={() => { const prevent = longPressed.current; longPressed.current = false; return prevent; }} />
      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">没有符合条件的卡片</p>
      ) : null}

      <Sheet open={!!active} onOpenChange={(open) => !open && !pending && activate(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-[430px] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>卡片操作</SheetTitle>
            <SheetDescription>收藏、暂停或管理这张卡片。</SheetDescription>
          </SheetHeader>
          <fieldset disabled={pending} aria-busy={pending} className="space-y-2 px-4 pb-6 disabled:opacity-70">
            {active ? <Button disabled={pending} variant="outline" className="h-11 w-full rounded-2xl" onClick={() => router.push(`/decks/${deckId}/cards/${active.id}`)}>编辑卡片</Button> : null}
            <ActionButton onClick={() => active && void run(() => toggleNoteStar(active.id, !starred, deckId), () => changed(starred ? "已取消收藏" : "已收藏", { starred: !starred }))}>
              {starred ? "取消收藏" : "收藏卡片"}
            </ActionButton>
            <ActionButton onClick={() => active && void run(() => suspendNote(active.id, !paused, deckId), () => changed(paused ? "已恢复学习" : "已暂停学习", { suspended: !paused }))}>
              {paused ? "恢复学习" : "暂停学习"}
            </ActionButton>
            {otherDecks.length > 0 ? <div className="rounded-2xl bg-muted/70 p-3">
              <label className="mb-2 block text-sm" htmlFor="move-deck">移动到其他卡片盒</label>
              <select id="move-deck" className="mb-2 w-full rounded-xl border bg-background px-2 py-2 text-base" value={moveTo} onChange={event => setMoveTo(event.target.value)}>
                {otherDecks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
              </select>
              <ActionButton onClick={() => active && moveTo && void run(() => moveNote(active.id, deckId, moveTo), () => changed("已移动", undefined, true))}>确认移动</ActionButton>
            </div> : null}
            {confirmDelete ? <div className="space-y-2 rounded-2xl bg-destructive/5 p-3">
              <p className="text-sm">确定删除这张卡片及其复习记录？此操作无法撤销。</p>
              <ActionButton danger onClick={() => active && void run(() => deleteNote(active.id, deckId), () => changed("已删除", undefined, true))}>确认删除</ActionButton>
              <ActionButton onClick={() => setConfirmDelete(false)}>取消</ActionButton>
            </div> : <ActionButton danger onClick={() => setConfirmDelete(true)}>删除卡片</ActionButton>}
            {pending ? <p role="status" className="text-center text-xs text-muted-foreground">正在处理…</p> : null}
          </fieldset>
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

/** Keep the first render bounded; keyboard users can also load the next batch. */
function NoteResults({ items, deckId, onActivate, onLongPress, suppressClick }: {
  suppressClick: () => boolean;
  items: IndexedNote[];
  deckId: string;
  onActivate: (note: NoteRow) => void;
  onLongPress: (note: NoteRow, target: HTMLElement) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(60);
  const more = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const target = more.current;
    if (!target || visibleCount >= items.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(count => Math.min(count + 60, items.length));
    }, { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);
  return <>
      <ul className="mt-3 space-y-2">
        {items.slice(0, visibleCount).map(({ note, preview, cardCount, starred }) => (
          <li key={note.id} className="relative rounded-2xl bg-white [content-visibility:auto] [contain-intrinsic-size:auto_84px]">
            <Link
              href={`/decks/${deckId}/cards/${note.id}`}
              onContextMenu={(event) => {
                event.preventDefault();
                onActivate(note);
              }}
              onPointerDown={(event) => onLongPress(note, event.currentTarget)}
              onClick={(event) => { if (suppressClick()) event.preventDefault(); }}
              className="block rounded-2xl py-3 pl-4 pr-14 active:scale-[0.99] [overflow-wrap:anywhere]"
            >
              <p className="font-medium">
                {starred ? <AppIcon name="star" className="mr-1 inline size-3" /> : null}
                {preview}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {TEMPLATES.find((item) => item.type === note.type)?.label ?? note.type} · {cardCount} 张学习卡
              </p>
            </Link>
            <button type="button" aria-label={`更多操作：${preview}`} onClick={() => onActivate(note)} className="absolute right-1.5 top-2 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-5" /></button>
          </li>
        ))}
      </ul>
    {visibleCount < items.length ? (
      <button ref={more} type="button" onClick={() => setVisibleCount(count => count + 60)}
        className="mt-4 h-11 w-full rounded-2xl bg-muted text-sm text-muted-foreground">
        加载更多（已显示 {visibleCount} / {items.length}）
      </button>
    ) : null}
  </>;
}
