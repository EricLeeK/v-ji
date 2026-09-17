"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localDateKey } from "@/lib/dates";
import { type Grade, type FsrsCardPatch } from "@/lib/srs/scheduler";
import { createClient, getUserId } from "@/lib/supabase/server";

export async function submitReview(input: {
  cardId: string;
  rating: Grade;
  next: FsrsCardPatch;
  durationMs: number;
  isNew: boolean;
}) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error: cardError } = await supabase
    .from("cards")
    .update(input.next)
    .eq("id", input.cardId)
    .eq("owner_id", uid);
  if (cardError) return { error: cardError.message };

  const { error: logError } = await supabase.from("review_logs").insert({
    card_id: input.cardId,
    owner_id: uid,
    rating: input.rating,
    state: input.next.state,
    due: input.next.due,
    stability: input.next.stability,
    difficulty: input.next.difficulty,
    elapsed_days: input.next.elapsed_days,
    scheduled_days: input.next.scheduled_days,
    duration_ms: input.durationMs,
  });
  if (logError) return { error: logError.message };

  const date = localDateKey();
  const { data: existing } = await supabase
    .from("daily_stats")
    .select("reviews, new_cards, study_seconds")
    .eq("owner_id", uid)
    .eq("date", date)
    .maybeSingle();

  const { error: statsError } = await supabase.from("daily_stats").upsert({
    owner_id: uid,
    date,
    reviews: (existing?.reviews ?? 0) + 1,
    new_cards: (existing?.new_cards ?? 0) + (input.isNew ? 1 : 0),
    study_seconds: (existing?.study_seconds ?? 0) + Math.round(input.durationMs / 1000),
  });
  if (statsError) return { error: statsError.message };

  revalidatePath("/today");
  revalidatePath("/decks");
  revalidatePath("/me");
  revalidatePath("/me/stats");
  return {};
}

export async function exitStudy(next: "/today" | "/me/stats" | "/decks" = "/today") {
  revalidatePath("/today");
  revalidatePath("/me/stats");
  redirect(next);
}
