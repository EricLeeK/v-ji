import { createClient, getUserId } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/dates";
import { parseSettings } from "@/lib/settings";
import type { QueueCard } from "@/lib/srs/queue";
import type { Tables } from "@/types/database";

type CardRow = Tables<"cards"> & {
  notes: Tables<"notes"> | null;
  decks: { name: string } | null;
};

export async function getProfile() {
  const uid = await getUserId();
  if (!uid) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return data;
}

export async function getStudyQueue(deckId?: string): Promise<{
  queue: QueueCard[];
  settings: ReturnType<typeof parseSettings>;
} | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const supabase = await createClient();
  const now = new Date().toISOString();
  // Keep the join narrow — study only needs note content fields, not every note column forever.
  const cardSelect =
    "id, note_id, deck_id, owner_id, ord, state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review, starred, suspended, created_at, notes(id, deck_id, owner_id, type, fields, tags, layout, source, created_at, updated_at), decks(name)";

  let reviewsQuery = supabase
    .from("cards")
    .select(cardSelect)
    .eq("owner_id", uid)
    .eq("suspended", false)
    .neq("state", 0)
    .lte("due", now)
    .order("due")
    .limit(80);
  let newsQuery = supabase
    .from("cards")
    .select(cardSelect)
    .eq("owner_id", uid)
    .eq("suspended", false)
    .eq("state", 0)
    .order("created_at")
    .limit(80);
  if (deckId) {
    reviewsQuery = reviewsQuery.eq("deck_id", deckId);
    newsQuery = newsQuery.eq("deck_id", deckId);
  }

  // Fetch reviews/news in parallel with settings — avoid the old profile→cards waterfall.
  const [{ data: profile }, { data: todayStats }, { data: reviewRows }, { data: newsRows }] =
    await Promise.all([
      supabase.from("profiles").select("settings").eq("id", uid).maybeSingle(),
      supabase
        .from("daily_stats")
        .select("new_cards")
        .eq("owner_id", uid)
        .eq("date", localDateKey())
        .maybeSingle(),
      reviewsQuery,
      newsQuery,
    ]);

  const settings = parseSettings(profile?.settings);
  const remainingNew = Math.max(0, settings.newCardsPerDay - (todayStats?.new_cards ?? 0));
  // Deck "学习" is intentional study: allow new cards even if the daily new-card quota is used up.
  const newsCap = deckId ? 80 : remainingNew;
  const news = toQueueCards(newsRows as CardRow[] | null).slice(0, newsCap);
  const queue = [...toQueueCards(reviewRows as CardRow[] | null), ...news];
  return { queue, settings };
}

function toQueueCards(rows: CardRow[] | null | undefined): QueueCard[] {
  return ((rows ?? []) as CardRow[])
    .filter((card) => card.notes)
    .map((card) => ({
      ...card,
      note: card.notes!,
      deckName: card.decks?.name ?? "卡片盒",
    }));
}
