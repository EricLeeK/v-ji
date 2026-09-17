"use client";

import { DeckIcon } from "@/components/app-icon";
import { BackLink } from "@/components/back-link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDeck } from "@/app/actions/decks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DECK_ICONS, DECK_ICON_LABELS, resolveDeckIcon } from "@/lib/deck-icons";
import { toast } from "sonner";

const ICONS = DECK_ICONS;

export default function NewDeckPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("book");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await createDeck({ name, icon });
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.id) router.push(`/decks/${result.id}`);
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <BackLink href="/decks" label="卡片盒" />
      <h1 className="text-2xl font-semibold">新建卡片盒</h1>
      <p className="mt-2 text-sm text-muted-foreground">用卡片盒区分科目或考试目标。</p>
      <div className="mt-6 space-y-4">
        <Input placeholder="例如：考研英语" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-5 gap-2">
          {ICONS.map((item) => (
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
        <Button className="h-11 w-full rounded-full" disabled={pending || !name.trim()} onClick={submit}>
          创建
        </Button>
      </div>
    </div>
  );
}
