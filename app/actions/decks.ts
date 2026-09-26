"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";

export async function createDeck(input: { name: string; icon: string; description?: string }) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const name = input.name.trim();
  if (!name || name.length > 80) return { error: "卡片盒名称需为 1–80 个字" };
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
  if (patch.name !== undefined && (!patch.name.trim() || patch.name.trim().length > 80)) return { error: "卡片盒名称需为 1–80 个字" };
  const { data, error } = await supabase.from("decks").update({ ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) }).eq("id", id).eq("owner_id", uid).select("id").maybeSingle();
  if (!error && !data) return { error: "卡片盒不存在或已被删除" };
  if (error) return { error: error.message };
  revalidatePath("/decks");
  revalidatePath(`/decks/${id}`);
  revalidatePath("/today");
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
  revalidatePath("/library", "layout");
  return {};
}
