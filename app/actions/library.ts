"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";

export async function joinBook(bookId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_book", { p_book_id: bookId });
  if (error) return { error: error.message };
  revalidatePath("/decks");
  revalidatePath("/library");
  revalidatePath(`/library/${bookId}`);
  revalidatePath("/today");
  return { deckId: data };
}
