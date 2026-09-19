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
  expected: {
    due: string;
    state: number;
    reps: number;
  };
}) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_card_id: input.cardId,
    p_rating: input.rating,
    p_next: input.next,
    p_duration_ms: input.durationMs,
    p_date: localDateKey(),
    p_expected_due: input.expected.due,
    p_expected_state: input.expected.state,
    p_expected_reps: input.expected.reps,
  });
  if (error) return { error: error.message };

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
