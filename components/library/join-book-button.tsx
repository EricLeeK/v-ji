"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinBook } from "@/app/actions/library";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function JoinBookButton({ bookId, already }: { bookId: string; already: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (already) {
      router.push("/decks");
      return;
    }
    setPending(true);
    const result = await joinBook(bookId);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("已加入你的卡片盒");
    if (result.deckId) router.push(`/decks/${result.deckId}`);
    else router.push("/decks");
  }

  return (
    <Button className="h-12 w-full rounded-full" disabled={pending} onClick={onClick}>
      {already ? "前往卡片盒" : pending ? "加入中..." : "免费加入"}
    </Button>
  );
}
