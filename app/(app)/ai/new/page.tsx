import { redirect } from "next/navigation";
import { AiNewForm } from "@/components/ai/new-form";
import { getDeepseekApiKey } from "@/lib/ai/provider";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function AiNewPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const { deckId } = await searchParams;
  const supabase = await createClient();
  const [{ data: decks }, { data: profile }] = await Promise.all([
    supabase.from("decks").select("id, name").eq("owner_id", uid).order("created_at", { ascending: false }),
    supabase.from("profiles").select("settings").eq("id", uid).maybeSingle(),
  ]);

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <h1 className="text-2xl font-semibold">AI 制卡</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">放入资料，生成草稿后再加入卡片盒。</p>
      <AiNewForm
        decks={decks ?? []}
        initialDeckId={deckId}
        configured={Boolean(getDeepseekApiKey(profile?.settings))}
      />
    </div>
  );
}
