import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { NoteEditor } from "@/components/cards/note-editor";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function NewCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const { data: deck } = await supabase
    .from("decks")
    .select("id, name")
    .eq("id", id)
    .eq("owner_id", uid)
    .maybeSingle();
  if (!deck) notFound();

  return (
    <div className="flex flex-1 flex-col px-5 pt-6 pb-8">
      <BackLink href={`/decks/${deck.id}`} label={deck.name} />
      <h1 className="mb-5 text-2xl font-semibold">添加卡片</h1>
      <NoteEditor deckId={deck.id} />
    </div>
  );
}
