"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";

export async function createDeck(input: { name: string; icon: string; description?: string }) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const name = input.name.trim();
  if (!name) return { error: "请填写卡片盒名称" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decks")
    .insert({ owner_id: uid, name, icon: input.icon || "book", description: input.description ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/decks");
  revalidatePath("/today");
  return { id: data.id };
}

export async function updateDeck(id: string, patch: { name?: string; icon?: string }) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase.from("decks").update(patch).eq("id", id).eq("owner_id", uid);
  if (error) return { error: error.message };
  revalidatePath("/decks");
  revalidatePath(`/decks/${id}`);
  return {};
}

export async function deleteDeck(id: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase.from("decks").delete().eq("id", id).eq("owner_id", uid);
  if (error) return { error: error.message };
  revalidatePath("/decks");
  revalidatePath("/today");
  return {};
}
