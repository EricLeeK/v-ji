"use client";

import { DeckIcon } from "@/components/app-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { deleteDeck, updateDeck } from "@/app/actions/decks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAction } from "@/lib/hooks/use-action";
import { Input } from "@/components/ui/input";
import { DECK_ICONS, DECK_ICON_LABELS, resolveDeckIcon } from "@/lib/deck-icons";
import { deckTone } from "@/lib/deck-tone";
import type { DeckSummary } from "@/lib/deck-summary";
import { toast } from "sonner";

export type DeckItem = {
  id: string;
  name: string;
  icon: string;
} & DeckSummary;

export function DeckList({ decks }: { decks: DeckItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<DeckItem | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("book");
  const [removing, setRemoving] = useState<DeckItem | null>(null);

  const { pending, run } = useAction();
  const longPressed = useRef(false);

  const openEditor = (deck: DeckItem) => {
    setEditing(deck);
    setName(deck.name);
    setIcon(resolveDeckIcon(deck.icon));
  };

  return (
    <>
      <ul className="space-y-3">
        {decks.map((deck) => (
          <li key={deck.id} data-tone={deckTone(deck.id)} className="app-card app-card-interactive deck-tile grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[24px] p-3.5 active:scale-[0.99]">
            <Link
              href={`/decks/${deck.id}`}
              onContextMenu={(event) => {
                event.preventDefault();
                openEditor(deck);
              }}
              onPointerDown={(event) => {
                longPressed.current = false;
                const timer = window.setTimeout(() => {
                  longPressed.current = true;
                  openEditor(deck);
                }, 520);
                const clear = () => window.clearTimeout(timer);
                event.currentTarget.addEventListener("pointerup", clear, { once: true });
                event.currentTarget.addEventListener("pointerleave", clear, { once: true });
                event.currentTarget.addEventListener("pointercancel", clear, { once: true });
              }}
              onClick={event => { if (longPressed.current) { event.preventDefault(); longPressed.current = false; } }}
              className="row-span-2 flex min-w-0 items-start gap-3"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl tone-icon">
                <DeckIcon name={deck.icon} className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-[1.5] text-balance [overflow-wrap:anywhere]">{deck.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] leading-4 text-muted-foreground">
                  <span className="whitespace-nowrap">剩余 {deck.remaining} 张</span>
                  <span className="whitespace-nowrap">{deck.due > 0 ? `可学习 ${deck.due} 张` : deck.total > 0 ? "暂无到期卡片" : "还没有卡片"}</span>
                </span>
                <span
                  className="mt-2 block h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--tone-surface)]"
                  role="progressbar"
                  aria-label={`${deck.name} 已掌握进度`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={deck.progressPercent}
                >
                  <span className="block h-full rounded-full bg-[var(--tone-ink)]" style={{ width: `${deck.progressPercent}%` }} />
                </span>
              </span>
            </Link>
            <Link
              href={`/study?deckId=${deck.id}`}
              className="col-start-2 row-start-2 inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              学习
            </Link>
            <button
              type="button"
              aria-label={`更多操作：${deck.name}`}
              title="更多操作"
              onClick={() => openEditor(deck)}
              className="col-start-2 row-start-1 flex size-8 shrink-0 items-center justify-self-end justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <MoreVertical className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!editing} onOpenChange={(open) => !open && !pending && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>编辑卡片盒</AlertDialogTitle>
          </AlertDialogHeader>
          <Input aria-label="卡片盒名称" maxLength={80} disabled={pending} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-5 gap-2">
            {DECK_ICONS.map((item) => (
              <button
                key={item}
                aria-label={DECK_ICON_LABELS[item]}
                title={DECK_ICON_LABELS[item]}
                aria-pressed={resolveDeckIcon(icon) === item}
                type="button"
                disabled={pending}
                onClick={() => setIcon(item)}
                className={`flex size-11 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary ${
                  icon === item ? "bg-primary/15 ring-2 ring-primary" : "bg-muted"
                }`}
              >
                <DeckIcon name={item} className="size-6" />
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !name.trim()}
              onClick={event => {
                event.preventDefault();
                if (!editing) return;
                void run(() => updateDeck(editing.id, { name, icon }), () => { toast.success("已更新"); setEditing(null); router.refresh(); });
              }}
            >
              {pending ? "保存中…" : "保存"}
            </AlertDialogAction>
            <ButtonDanger
              disabled={pending}
              onClick={() => {
                setRemoving(editing);
                setEditing(null);
              }}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && !pending && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{removing?.name}」？</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">卡片和复习记录会一并删除。</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={event => {
                event.preventDefault();
                if (!removing) return;
                void run(() => deleteDeck(removing.id), () => { toast.success("已删除"); setRemoving(null); router.refresh(); });
              }}
            >
              {pending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ButtonDanger({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button disabled={disabled} type="button" className="min-h-10 text-sm text-destructive" onClick={onClick}>
      删除
    </button>
  );
}
