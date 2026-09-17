import { notFound, redirect } from "next/navigation";
import { AiJobView } from "@/components/ai/job-view";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function AiJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const [{ data: job }, { data: cards }, { data: sources }] = await Promise.all([
    supabase.from("ai_jobs").select("*").eq("id", jobId).eq("owner_id", uid).maybeSingle(),
    supabase.from("ai_cards").select("*").eq("job_id", jobId).order("ord"),
    supabase.from("ai_sources").select("*").eq("job_id", jobId).order("sort_order"),
  ]);
  if (!job) notFound();

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <h1 className="text-2xl font-semibold">生成结果</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">确认后再加入复习队列。</p>
      <AiJobView initial={{ job, cards: cards ?? [], sources: sources ?? [] }} />
    </div>
  );
}
