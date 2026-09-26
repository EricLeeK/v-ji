"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Json, NoteType } from "@/types/database";

export async function saveNote(input: {
  noteId?: string;
  deckId: string;
  type: NoteType;
  fields: Json;
  tags?: string[];
  layout?: string;
  source?: Json;
}) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_note", {
    p_note_id: input.noteId ?? null,
    p_deck_id: input.deckId,
    p_type: input.type,
    p_fields: input.fields,
    p_tags: input.tags ?? [],
    p_layout: input.layout,
    p_source: input.source,
  });
  if (error) return { error: error.message };

  revalidatePath(`/decks/${input.deckId}`);
  revalidatePath("/decks");
  revalidatePath("/today");
  return { id: data };
}

export async function deleteNote(noteId: string, deckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").delete().eq("id", noteId).eq("deck_id", deckId).eq("owner_id", uid).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "卡片已移动或删除，请刷新列表" };
  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/decks");
  revalidatePath("/today");
  return {};
}

export async function toggleStar(cardId: string, starred: boolean) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .update({ starred })
    .eq("id", cardId)
    .eq("owner_id", uid).select("deck_id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "卡片不存在或已被删除" };
  revalidatePath(`/decks/${data.deck_id}`);
  revalidatePath("/decks");
  return {};
}

export async function toggleNoteStar(noteId: string, starred: boolean, deckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .update({ starred })
    .eq("note_id", noteId)
    .eq("owner_id", uid).eq("deck_id", deckId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "卡片已移动或删除，请刷新列表" };
  revalidatePath(`/decks/${deckId}`);
  return {};
}

export async function moveNote(noteId: string, fromDeckId: string, toDeckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_note", {
    p_note_id: noteId,
    p_from_deck_id: fromDeckId,
    p_to_deck_id: toDeckId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/decks/${fromDeckId}`);
  revalidatePath(`/decks/${toDeckId}`);
  revalidatePath("/decks");
  revalidatePath("/today");
  return {};
}

export async function suspendCard(cardId: string, suspended: boolean) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .update({ suspended })
    .eq("id", cardId)
    .eq("owner_id", uid).select("deck_id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "卡片不存在或已被删除" };
  revalidatePath(`/decks/${data.deck_id}`);
  revalidatePath("/decks");
  revalidatePath("/today");
  return {};
}

export async function suspendNote(noteId: string, suspended: boolean, deckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").update({ suspended }).eq("note_id", noteId).eq("owner_id", uid).eq("deck_id", deckId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "卡片已移动或删除，请刷新列表" };
  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/today");
  revalidatePath("/decks");
  return {};
}
