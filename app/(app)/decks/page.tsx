import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { DeckList } from "@/components/decks/deck-list";
import { EmptyState } from "@/components/empty-state";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function DecksPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const [{ data: decks }, { data: cards }] = await Promise.all([
    supabase.from("decks").select("*").eq("owner_id", uid).order("created_at", { ascending: false }),
    supabase.from("cards").select("id, deck_id, due, state, suspended").eq("owner_id", uid),
  ]);
  const now = Date.now();
  const items = (decks ?? []).map((deck) => {
    const deckCards = (cards ?? []).filter((card) => card.deck_id === deck.id && !card.suspended);
    const due = deckCards.filter((card) => new Date(card.due).getTime() <= now || card.state === 0).length;
    return { id: deck.id, name: deck.name, icon: deck.icon, total: deckCards.length, due };
  });

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">卡片盒</h1>
        <div className="flex items-center gap-2">
          <Link href="/ai/new" className="rounded-full border border-border px-3 py-1.5 text-sm font-medium">
            AI 制卡
          </Link>
          <Link
            href="/decks/new"
            aria-label="新建卡片盒"
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="size-4" />
          </Link>
        </div>
      </header>
      {items.length === 0 ? (
        <EmptyState
          title="还没有卡片盒"
          description="新建一个科目卡片盒，或从社区加入现成卡册。"
          actionHref="/decks/new"
          actionLabel="新建卡片盒"
        />
      ) : (
        <DeckList decks={items} />
      )}
    </div>
  );
}
