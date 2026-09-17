"use client";

import { DeckIcon } from "@/components/app-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { toast } from "sonner";

type DeckItem = {
  id: string;
  name: string;
  icon: string;
  total: number;
  due: number;
};

export function DeckList({ decks }: { decks: DeckItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<DeckItem | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("book");
  const [removing, setRemoving] = useState<DeckItem | null>(null);

  return (
    <>
      <ul className="space-y-3 pb-24">
        {decks.map((deck) => (
          <li key={deck.id} className="flex items-center gap-3 rounded-3xl bg-white p-4">
            <Link
              href={`/decks/${deck.id}`}
              onContextMenu={(event) => {
                event.preventDefault();
                setEditing(deck);
                setName(deck.name);
                setIcon(resolveDeckIcon(deck.icon));
              }}
              onPointerDown={(event) => {
                const timer = window.setTimeout(() => {
                  setEditing(deck);
                  setName(deck.name);
                  setIcon(resolveDeckIcon(deck.icon));
                }, 520);
                const clear = () => window.clearTimeout(timer);
                event.currentTarget.addEventListener("pointerup", clear, { once: true });
                event.currentTarget.addEventListener("pointerleave", clear, { once: true });
              }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-2xl">
                <DeckIcon name={deck.icon} className="size-7 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{deck.name}</span>
                <span className="text-xs text-muted-foreground">
                  {deck.total} 张 · 今日 {deck.due} 张
                </span>
              </span>
            </Link>
            <Link
              href={`/study?deckId=${deck.id}`}
              className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
            >
              学习
            </Link>
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
