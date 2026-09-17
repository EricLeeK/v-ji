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
  revalidatePath("/today");
  return { id: data };
}

export async function deleteNote(noteId: string, deckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId).eq("owner_id", uid);
  if (error) return { error: error.message };
  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/today");
  return {};
}

export async function toggleStar(cardId: string, starred: boolean) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ starred })
    .eq("id", cardId)
    .eq("owner_id", uid);
  if (error) return { error: error.message };
  return {};
}

export async function toggleNoteStar(noteId: string, starred: boolean, deckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ starred })
    .eq("note_id", noteId)
    .eq("owner_id", uid);
  if (error) return { error: error.message };
  revalidatePath(`/decks/${deckId}`);
  return {};
}

export async function moveNote(noteId: string, fromDeckId: string, toDeckId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error: noteError } = await supabase
    .from("notes")
    .update({ deck_id: toDeckId })
    .eq("id", noteId)
    .eq("owner_id", uid);
  if (noteError) return { error: noteError.message };
  const { error: cardError } = await supabase
    .from("cards")
    .update({ deck_id: toDeckId })
    .eq("note_id", noteId)
    .eq("owner_id", uid);
  if (cardError) return { error: cardError.message };
  revalidatePath(`/decks/${fromDeckId}`);
  revalidatePath(`/decks/${toDeckId}`);
  revalidatePath("/today");
  return {};
}

export async function suspendCard(cardId: string, suspended: boolean) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ suspended })
    .eq("id", cardId)
    .eq("owner_id", uid);
  if (error) return { error: error.message };
  return {};
}
