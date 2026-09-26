"use client";

import { useAction } from "@/lib/hooks/use-action";
import { useRouter } from "next/navigation";
import { joinBook } from "@/app/actions/library";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function JoinBookButton({ bookId, deckId }: { bookId: string; deckId?: string | null }) {
  const router = useRouter();
  const { pending, run } = useAction();

  async function onClick() {
    if (deckId) {
      router.push(`/decks/${deckId}`);
      return;
    }
    await run(() => joinBook(bookId), result => {
      toast.success("已加入你的卡片盒");
      router.push(result.deckId ? `/decks/${result.deckId}` : "/decks");
    });
  }

  return (
    <Button className="h-12 w-full rounded-full" disabled={pending} onClick={onClick}>
      {deckId ? "前往卡片盒" : pending ? "加入中..." : "免费加入"}
    </Button>
  );
}
