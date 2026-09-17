import { DeckIcon } from "@/components/app-icon";
import { BackLink } from "@/components/back-link";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { NoteList } from "@/components/cards/note-list";
import { createClient, getUserId } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const { data: deck } = await supabase
    .from("decks")
    .select("*")
    .eq("id", id)
    .eq("owner_id", uid)
    .maybeSingle();
  if (!deck) notFound();

  const [{ data: notes }, { data: cards }, { data: otherDecks }] = await Promise.all([
    supabase.from("notes").select("*").eq("deck_id", id).order("created_at", { ascending: false }),
    supabase.from("cards").select("id, note_id, state, suspended, starred, due").eq("deck_id", id),
    supabase.from("decks").select("id, name").eq("owner_id", uid).neq("id", id),
  ]);

  const mastered = (cards ?? []).filter((card) => card.state === 2 && !card.suspended).length;

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <BackLink href="/decks" label="卡片盒" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-3xl"><DeckIcon name={deck.icon} className="size-9 text-primary" /></div>
          <h1 className="mt-2 text-2xl font-semibold">{deck.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {notes?.length ?? 0} 张笔记 · {mastered} 张进入复习
          </p>
        </div>
        <Button asChild className="rounded-full">
          <Link href={`/study?deckId=${deck.id}`}>学习</Link>
        </Button>
      </div>

      <div className="mt-5 flex gap-2">
        <Button asChild variant="outline" className="flex-1 rounded-full">
          <Link href={`/decks/${deck.id}/cards/new`}>
            <Plus className="mr-1 size-4" />
            添加卡片
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1 rounded-full">
          <Link href={`/ai/new?deckId=${deck.id}`}>AI 制卡</Link>
        </Button>
      </div>

      <NoteList
        deckId={deck.id}
        notes={notes ?? []}
        cards={cards ?? []}
        otherDecks={otherDecks ?? []}
      />
    </div>
  );
}
