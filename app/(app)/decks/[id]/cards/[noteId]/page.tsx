import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { NoteEditor } from "@/components/cards/note-editor";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("deck_id", id)
    .eq("owner_id", uid)
    .maybeSingle();
  if (!note) notFound();

  return (
    <div className="flex flex-1 flex-col px-5 pt-6 pb-8">
      <BackLink href={`/decks/${id}`} />
      <h1 className="text-2xl font-semibold">编辑卡片</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">修改内容会保留原有复习进度。</p>
      <NoteEditor deckId={id} noteId={note.id} initialType={note.type} initialFields={note.fields} />
    </div>
  );
}
