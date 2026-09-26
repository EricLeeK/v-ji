import { redirect } from "next/navigation";
import { DeckBrowser } from "@/components/decks/deck-browser";
import { summarizeDeck } from "@/lib/deck-summary";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function DecksPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const [{ data: decks }, { data: cards }] = await Promise.all([
    supabase.from("decks").select("*").eq("owner_id", uid).order("created_at", { ascending: false }),
    supabase
      .from("cards")
      .select("id, deck_id, due, state, stability, starred, suspended")
      .eq("owner_id", uid),
  ]);
  // The due count is intentionally evaluated against the request time on the server.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const cardsByDeck = new Map<string, NonNullable<typeof cards>>();
  for (const card of cards ?? []) {
    const group = cardsByDeck.get(card.deck_id);
    if (group) group.push(card); else cardsByDeck.set(card.deck_id, [card]);
  }
  const items = (decks ?? []).map((deck) => {
    const deckCards = cardsByDeck.get(deck.id) ?? [];
    const summary = summarizeDeck(deckCards, new Date(now));
    return {
      id: deck.id,
      name: deck.name,
      icon: deck.icon,
      ...summary,
    };
  });
  return <DeckBrowser items={items} />;
}
