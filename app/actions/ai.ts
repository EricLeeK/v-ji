"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { createClient, getUserId } from "@/lib/supabase/server";
import { AI_LIMITS, dailyTokenQuota } from "@/lib/ai/limits";
import { getDeepseekApiKey, MISSING_DEEPSEEK_KEY } from "@/lib/ai/provider";
import { runGenerateCardsPipeline } from "@/lib/ai/pipeline";
import { DEFAULT_AI_SETTINGS, type AiGenerateSettings } from "@/lib/ai/schemas";
import { validateAiJobText, validateAiSourceInput, validateNewDeckName } from "@/lib/ai/input";
import type { Json } from "@/types/database";

export type AiSourceInput = {
  kind: "text" | "image" | "pdf";
  name: string;
  mime?: string;
  sizeBytes?: number;
  storagePath?: string;
  text?: string;
  pageRange?: { start: number; end: number };
};

export async function createAiJob(input: {
  deckId?: string;
  newDeckName?: string;
  instruction: string;
  settings?: Partial<AiGenerateSettings>;
  sources: AiSourceInput[];
}) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  if (!input || !Array.isArray(input.sources)) return { error: "资料格式无效" };
  if (!input.sources.length) return { error: "请先放入资料" };
  if (input.sources.length > AI_LIMITS.maxSourceFiles) {
    return { error: `一次最多 ${AI_LIMITS.maxSourceFiles} 份资料` };
  }

  const instruction = validateAiJobText(input.instruction, "根据资料生成考试复习卡，重点整理概念和易混点。");
  const sourceValidationError = input.sources
    .map((source) => validateAiSourceInput(source, uid))
    .find((error): error is string => Boolean(error));
  if (sourceValidationError) return { error: sourceValidationError };

  if (input.deckId) {
    const { data: deck } = await supabase
      .from("decks")
      .select("id")
      .eq("id", input.deckId)
      .eq("owner_id", uid)
      .maybeSingle();
    if (!deck) return { error: "卡片盒不存在" };
  }

  const keyError = await assertDeepseekKey(supabase, uid);
  if (keyError) return { error: keyError };

  const quotaError = await assertQuota(supabase, uid);
  if (quotaError) return { error: quotaError };

  const settings: AiGenerateSettings = { ...DEFAULT_AI_SETTINGS, ...input.settings };
  const { data: job, error } = await supabase
    .from("ai_jobs")
    .insert({
      owner_id: uid,
      deck_id: input.deckId || null,
      new_deck_name: input.deckId ? null : validateNewDeckName(input.newDeckName),
      instruction,
      settings: settings as unknown as Json,
      status: "queued",
      stage: { name: "queued", progress: 0, detail: "等待开始" },
    })
    .select("id")
    .single();
  if (error || !job) return { error: error?.message ?? "无法创建任务" };

  const rows = input.sources.map((source, index) => ({
    job_id: job.id,
    owner_id: uid,
    kind: source.kind,
    name: source.name,
    mime: source.mime ?? null,
    size_bytes: source.sizeBytes ?? null,
    storage_path: source.storagePath ?? null,
    page_range: source.pageRange ? (source.pageRange as unknown as Json) : null,
    meta: source.text ? ({ text: source.text } as Json) : ({} as Json),
    sort_order: index,
    status: "pending" as const,
  }));
  const { error: sourceError } = await supabase.from("ai_sources").insert(rows);
  if (sourceError) {
    await supabase.from("ai_jobs").delete().eq("id", job.id).eq("owner_id", uid);
    const uploadedPaths = rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path));
    if (uploadedPaths.length) await supabase.storage.from("ai-sources").remove(uploadedPaths);
    return { error: sourceError.message };
  }

  await cleanupOldJobs(supabase, uid);
  await enqueueJob(job.id, supabase);
  return { id: job.id };
}

export async function retryAiJob(jobId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("ai_jobs")
    .select("id, status")
    .eq("id", jobId)
    .eq("owner_id", uid)
    .maybeSingle();
  if (!job) return { error: "任务不存在" };
  if (job.status !== "failed") return { error: "当前状态不可重试" };
  const keyError = await assertDeepseekKey(supabase, uid);
  if (keyError) return { error: keyError };
  await supabase
    .from("ai_jobs")
    .update({ status: "queued", error: null, stage: { name: "queued", progress: 0, detail: "重新开始" } })
    .eq("id", jobId);
  await enqueueJob(jobId, supabase);
  return {};
}

export async function getAiJob(jobId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const [{ data: job }, { data: sources }, { data: cards }, { data: chunks }] = await Promise.all([
    supabase.from("ai_jobs").select("*").eq("id", jobId).eq("owner_id", uid).maybeSingle(),
    supabase.from("ai_sources").select("*").eq("job_id", jobId).order("sort_order"),
    supabase.from("ai_cards").select("*").eq("job_id", jobId).order("ord"),
    supabase.from("ai_chunks").select("*").eq("job_id", jobId).order("ord"),
  ]);
  if (!job) return { error: "任务不存在" };
  return { job, sources: sources ?? [], cards: cards ?? [], chunks: chunks ?? [] };
}

export async function updateAiCard(
  cardId: string,
  patch: { type?: string; fields?: Json; layout?: string },
) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_cards")
    .update({ ...patch, edited: true, type: patch.type as never })
    .eq("id", cardId)
    .eq("owner_id", uid);
  if (error) return { error: error.message };
  return {};
}

export async function setAiCardStatus(cardId: string, status: "draft" | "rejected") {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_cards").update({ status }).eq("id", cardId).eq("owner_id", uid);
  if (error) return { error: error.message };
  return {};
}

export async function importAiCards(jobId: string, cardIds: string[]) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  if (!cardIds.length) return { error: "请勾选要导入的卡片" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_ai_cards", {
    p_job_id: jobId,
    p_card_ids: cardIds,
  });
  if (error) return { error: error.message };
  const deckId = data;
  revalidatePath("/decks");
  revalidatePath("/today");
  if (deckId) revalidatePath(`/decks/${deckId}`);
  return { deckId };
}

export async function getDailyAiUsage() {
  const uid = await getUserId();
  if (!uid) return { used: 0, quota: dailyTokenQuota(false) };
  const supabase = await createClient();
  const anonymous = await isAnonymous(supabase);
  const { data } = await supabase
    .from("ai_usage")
    .select("prompt_tokens, completion_tokens")
    .eq("owner_id", uid)
    .gte("created_at", startOfDay(new Date()).toISOString());
  const used = (data ?? []).reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0);
  return { used, quota: dailyTokenQuota(anonymous) };
}

async function enqueueJob(jobId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  if (process.env.SUPABASE_SECRET_KEY) {
    try {
      const { start } = await import("workflow/api");
      const { generateCardsWorkflow } = await import("@/lib/ai/workflows/generate-cards");
      const run = await start(generateCardsWorkflow, [jobId]);
      await supabase.from("ai_jobs").update({ workflow_run_id: run.runId }).eq("id", jobId);
      return;
    } catch (error) {
      console.error("workflow start failed, fallback in-process", error);
    }
  }
  after(async () => {
    try {
      await runGenerateCardsPipeline(jobId, supabase);
    } catch (error) {
      console.error("ai pipeline failed", error);
    }
  });
}

async function assertDeepseekKey(supabase: Awaited<ReturnType<typeof createClient>>, uid: string) {
  const { data } = await supabase.from("profiles").select("settings").eq("id", uid).maybeSingle();
  if (!getDeepseekApiKey(data?.settings)) return MISSING_DEEPSEEK_KEY;
  return null;
}

async function assertQuota(supabase: Awaited<ReturnType<typeof createClient>>, uid: string) {
  const anonymous = await isAnonymous(supabase);
  const quota = dailyTokenQuota(anonymous);
  const { data } = await supabase
    .from("ai_usage")
    .select("prompt_tokens, completion_tokens")
    .eq("owner_id", uid)
    .gte("created_at", startOfDay(new Date()).toISOString());
  const used = (data ?? []).reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0);
  if (used >= quota) return "今日 AI 额度已用完";
  return null;
}

async function isAnonymous(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user?.is_anonymous);
}

async function cleanupOldJobs(supabase: Awaited<ReturnType<typeof createClient>>, uid: string) {
  const cutoff = new Date(Date.now() - AI_LIMITS.sourceRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("ai_jobs").delete().eq("owner_id", uid).lt("created_at", cutoff);
}
