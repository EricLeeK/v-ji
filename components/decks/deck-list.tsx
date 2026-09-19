"use client";

import { DeckIcon } from "@/components/app-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { DECK_ICONS, DECK_ICON_LABELS, resolveDeckIcon } from "@/lib/deck-icons";
import type { DeckSummary } from "@/lib/deck-summary";
import { toast } from "sonner";

type DeckItem = {
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

  const openEditor = (deck: DeckItem) => {
    setEditing(deck);
    setName(deck.name);
    setIcon(resolveDeckIcon(deck.icon));
  };

  return (
    <>
      <ul className="space-y-3">
        {decks.map((deck) => (
          <li key={deck.id} className="app-card app-card-interactive flex items-center gap-3 rounded-[28px] p-4 active:scale-[0.99]">
            <Link
              href={`/decks/${deck.id}`}
              onContextMenu={(event) => {
                event.preventDefault();
                openEditor(deck);
              }}
              onPointerDown={(event) => {
                const timer = window.setTimeout(() => {
                  openEditor(deck);
                }, 520);
                const clear = () => window.clearTimeout(timer);
                event.currentTarget.addEventListener("pointerup", clear, { once: true });
                event.currentTarget.addEventListener("pointerleave", clear, { once: true });
              }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                <DeckIcon name={deck.icon} className="size-7 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{deck.name}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>剩余 {deck.remaining} 张</span>
                  <span aria-hidden>·</span>
                  <span>{deck.due > 0 ? `今日复习 ${deck.due} 张` : "今日已完成"}</span>
                </span>
                <span
                  className="mt-2 block h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-primary/10"
                  role="progressbar"
                  aria-label={`${deck.name} 已掌握进度`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={deck.progressPercent}
                >
                  <span className="block h-full rounded-full bg-primary/60" style={{ width: `${deck.progressPercent}%` }} />
                </span>
              </span>
            </Link>
            <Link
              href={`/study?deckId=${deck.id}`}
              className="shrink-0 rounded-full border border-primary/10 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              学习
            </Link>
            <button
              type="button"
              aria-label={`更多操作：${deck.name}`}
              title="更多操作"
              onClick={() => openEditor(deck)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <MoreVertical className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>编辑卡片盒</AlertDialogTitle>
          </AlertDialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-5 gap-2">
            {DECK_ICONS.map((item) => (
              <button
                key={item}
                aria-label={DECK_ICON_LABELS[item]}
                title={DECK_ICON_LABELS[item]}
                aria-pressed={resolveDeckIcon(icon) === item}
                type="button"
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
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!editing) return;
                const result = await updateDeck(editing.id, { name, icon });
                if (result.error) toast.error(result.error);
                else {
                  toast.success("已更新");
                  router.refresh();
                }
              }}
            >
              保存
            </AlertDialogAction>
            <ButtonDanger
              onClick={() => {
                setRemoving(editing);
                setEditing(null);
              }}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{removing?.name}」？</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">卡片和复习记录会一并删除。</p>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removing) return;
                const result = await deleteDeck(removing.id);
                if (result.error) toast.error(result.error);
                else router.refresh();
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ButtonDanger({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="text-sm text-destructive" onClick={onClick}>
      删除
    </button>
  );
}
