import { extractSource } from "@/lib/ai/extract";
import { AI_LIMITS } from "@/lib/ai/limits";
import { createLlmClient, recordUsage, RetryableLlmError, parseSettings, type LlmClient, type LlmImage } from "@/lib/ai/llm";
import { getDeepseekApiKey, MISSING_DEEPSEEK_KEY } from "@/lib/ai/provider";
import { allowedTypes, cardsUserPrompt, outlineUserPrompt, systemPrompt, wrapSourceMaterial } from "@/lib/ai/prompts";
import { cardsResponseSchema, outlineResponseSchema, type CardCitation, type ValidatedCard } from "@/lib/ai/schemas";
import { dedupeCards, validateCard } from "@/lib/ai/validate";
import type { AiDb } from "@/lib/supabase/admin";
import type { Json, NoteType } from "@/types/database";

type StageName = "reading" | "organizing" | "generating" | "checking";

export async function runGenerateCardsPipeline(jobId: string, client: AiDb) {
  const { data: job, error } = await client.from("ai_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new Error(error?.message ?? "任务不存在");

  try {
    await setStage(client, jobId, "reading", 5, "开始读取资料");
    const chunks = await readSources(client, jobId, job.owner_id);
    if (!chunks.length) throw new FatalPipelineError("没有可解析的资料内容");

    const llm = await llmForOwner(client, job.owner_id);
    const settings = parseSettings(job.settings);
    const types = allowedTypes(settings);
    await setStage(client, jobId, "organizing", 30, "正在整理知识点");
    const outline = await organizePoints(client, job, chunks, settings, types, llm);

    await client
      .from("ai_jobs")
      .update({ outline: outline as unknown as Json })
      .eq("id", jobId);

    await setStage(client, jobId, "generating", 55, "正在生成卡片草稿");
    const generated = await generateCards(client, job, chunks, outline, settings, types, llm);

    await setStage(client, jobId, "checking", 85, "正在检查结构与重复");
    const unique = dedupeCards(generated).slice(0, cap(settings.cardLimit));
    await client.from("ai_cards").delete().eq("job_id", jobId).eq("status", "draft");
    if (unique.length) {
      await client.from("ai_cards").insert(
        unique.map((card, index) => ({
          job_id: jobId,
          owner_id: job.owner_id,
          ord: index,
          type: card.type,
          fields: card.fields as unknown as Json,
          layout: card.layout,
          sources: citationsFor(card, chunks) as unknown as Json,
          flags: card.flags,
          status: "draft" as const,
        })),
      );
    }

    await client
      .from("ai_jobs")
      .update({
        status: "ready",
        stage: { name: "ready", progress: 100, detail: `已生成 ${unique.length} 张草稿` },
        error: null,
      })
      .eq("id", jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    await client
      .from("ai_jobs")
      .update({ status: "failed", error: message, stage: { name: "failed", progress: 0, detail: message } })
      .eq("id", jobId);
    throw error;
  }
}

class FatalPipelineError extends Error {}

async function readSources(client: AiDb, jobId: string, ownerId: string) {
  const { data: sources } = await client
    .from("ai_sources")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order");
  await client.from("ai_chunks").delete().eq("job_id", jobId);

  const inserted: Array<{
    id: string;
    sourceId: string;
    text: string;
    locator: Record<string, unknown>;
    imagePath: string | null;
    name: string;
  }> = [];

  let imageCount = 0;
  let pdfPages = 0;
  let textTokens = 0;
  let ord = 0;

  for (const source of sources ?? []) {
    const file = source.storage_path ? await downloadSource(client, source.storage_path) : undefined;
    const extracted = await extractSource(source, file);
    pdfPages += extracted.pageCount ?? 0;
    if (source.kind === "image") imageCount += 1;
    textTokens += extracted.chunks.reduce((sum, chunk) => sum + chunk.tokenEstimate, 0);
    if (imageCount > AI_LIMITS.maxImages) throw new FatalPipelineError(`图片不能超过 ${AI_LIMITS.maxImages} 张`);
    if (pdfPages > AI_LIMITS.maxPdfPages) throw new FatalPipelineError(`PDF 不能超过 ${AI_LIMITS.maxPdfPages} 页`);
    if (textTokens > AI_LIMITS.maxTextTokens) throw new FatalPipelineError("资料文本过长，请缩小范围");

    const rows = extracted.chunks.map((chunk, index) => ({
      job_id: jobId,
      source_id: source.id,
      ord: ord + index,
      locator: chunk.locator as unknown as Json,
      text: chunk.text,
      image_path: source.kind === "image" ? source.storage_path : null,
      token_estimate: chunk.tokenEstimate,
    }));
    ord += rows.length;
    if (!rows.length) continue;
    const { data, error } = await client.from("ai_chunks").insert(rows).select("id, source_id, text, locator, image_path");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      inserted.push({
        id: row.id,
        sourceId: row.source_id,
        text: row.text,
        locator: (row.locator ?? {}) as Record<string, unknown>,
        imagePath: row.image_path,
        name: source.name,
      });
    }
    await client
      .from("ai_sources")
      .update({
        status: extracted.warnings.length && !extracted.chunks.length ? "failed" : "ready",
        meta: {
          ...asRecord(source.meta),
          warnings: extracted.warnings,
          pageCount: extracted.pageCount ?? null,
        } as Json,
      })
      .eq("id", source.id)
      .eq("owner_id", ownerId);
  }
  return inserted;
}

async function llmForOwner(client: AiDb, ownerId: string) {
  const { data } = await client.from("profiles").select("settings").eq("id", ownerId).maybeSingle();
  const apiKey = getDeepseekApiKey(data?.settings);
  if (!apiKey) throw new FatalPipelineError(MISSING_DEEPSEEK_KEY);
  return createLlmClient(apiKey);
}

async function organizePoints(
  client: AiDb,
  job: { id: string; owner_id: string; instruction: string },
  chunks: Array<{ id: string; text: string; locator: Record<string, unknown>; imagePath?: string | null }>,
  settings: ReturnType<typeof parseSettings>,
  types: NoteType[],
  llm: LlmClient,
) {
  const summaries = chunks
    .map((chunk) => `[id=${chunk.id}] ${formatLocator(chunk.locator)} | ${chunk.text.slice(0, 180)}`)
    .join("\n");
  const result = await completeValidated(llm, {
    system: systemPrompt(settings),
    user: wrapSourceMaterial(outlineUserPrompt(job.instruction, summaries)),
    kind: "outline",
    thinking: true,
    images: await collectImages(client, chunks),
    schema: outlineResponseSchema,
  });
  await recordUsage(client, job.owner_id, job.id, result.usage);
  return result.data.points.filter((point) => types.includes(point.suggestedType));
}

async function generateCards(
  client: AiDb,
  job: { id: string; owner_id: string; instruction: string },
  chunks: Array<{ id: string; sourceId: string; text: string; locator: Record<string, unknown>; imagePath: string | null; name: string }>,
  outline: Array<{ title: string; summary: string; chunkIds: string[]; suggestedType: NoteType }>,
  settings: ReturnType<typeof parseSettings>,
  types: NoteType[],
  llm: LlmClient,
) {
  const limit = cap(settings.cardLimit);
  const batches = split(outline.length ? outline : fallbackOutline(chunks, types), 6);
  const cards: ValidatedCard[] = [];

  for (const [index, batch] of batches.entries()) {
    const remaining = Math.max(0, limit - cards.length);
    if (!remaining) break;
    await setStage(client, job.id, "generating", 55 + Math.round((index / batches.length) * 25), `正在生成第 ${index + 1}/${batches.length} 批`);
    const relatedIds = new Set(batch.flatMap((item) => item.chunkIds));
    const related = chunks.filter((chunk) => relatedIds.has(chunk.id)).concat(chunks.slice(0, 4));
    const uniqueChunks = [...new Map(related.map((chunk) => [chunk.id, chunk])).values()];
    const result = await completeValidated(llm, {
      system: systemPrompt(settings),
      user: wrapSourceMaterial(
        cardsUserPrompt(
          job.instruction,
          batch.map((item) => `${item.title}：${item.summary}（${item.suggestedType}） chunk=${item.chunkIds.join(",")}`).join("\n"),
          uniqueChunks.map((chunk) => `[id=${chunk.id}] ${formatLocator(chunk.locator)}\n${chunk.text.slice(0, 1200)}`).join("\n\n"),
          Math.min(10, remaining),
        ),
      ),
      kind: "cards",
      thinking: false,
      images: await collectImages(client, uniqueChunks),
      schema: cardsResponseSchema,
    });
    await recordUsage(client, job.owner_id, job.id, result.usage);
    for (const item of result.data.cards) {
      const validated = validateCard(item, types, { grounding: settings.grounding });
      if (validated.ok) cards.push(validated.card);
    }
  }
  return cards;
}

async function completeValidated<T>(
  llm: LlmClient,
  input: {
    system: string;
    user: string;
    kind: "outline" | "cards";
    thinking?: boolean;
    images?: LlmImage[];
    schema: { parse(data: unknown): T; safeParse(data: unknown): { success: boolean; data?: T; error?: { issues: Array<{ message: string }> } } };
  },
) {
  let user = input.user;
  let lastError = "输出不符合结构";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await llm.completeJson({
        system: input.system,
        user,
        kind: input.kind,
        thinking: input.thinking,
        images: input.images,
      });
      const parsed = input.schema.safeParse(result.data);
      if (parsed.success && parsed.data) return { data: parsed.data, usage: result.usage };
      lastError = parsed.error?.issues.map((issue) => issue.message).join("；") ?? lastError;
    } catch (error) {
      if (error instanceof RetryableLlmError) throw error;
      lastError = error instanceof Error ? error.message : lastError;
    }
    user = `${input.user}\n\n上次输出校验失败：${lastError}。请只输出修正后的 JSON。`;
  }
  throw new FatalPipelineError(lastError);
}

async function collectImages(
  client: AiDb,
  chunks: Array<{ imagePath?: string | null }>,
) {
  const paths = [...new Set(chunks.map((chunk) => chunk.imagePath).filter(Boolean))] as string[];
  const images: LlmImage[] = [];
  for (const path of paths.slice(0, 8)) {
    const file = await downloadSource(client, path);
    if (!file) continue;
    images.push({ mime: mimeFromPath(path), data: Buffer.from(file).toString("base64") });
  }
  return images;
}

async function downloadSource(client: AiDb, path: string) {
  const { data, error } = await client.storage.from("ai-sources").download(path);
  if (error || !data) return undefined;
  return new Uint8Array(await data.arrayBuffer());
}

async function setStage(client: AiDb, jobId: string, name: StageName, progress: number, detail: string) {
  await client
    .from("ai_jobs")
    .update({ status: name, stage: { name, progress, detail } })
    .eq("id", jobId);
}

function citationsFor(
  card: ValidatedCard,
  chunks: Array<{ id: string; sourceId: string; text: string; locator: Record<string, unknown>; imagePath: string | null; name: string }>,
): CardCitation[] {
  return card.sourceChunkIds
    .map((id) => chunks.find((chunk) => chunk.id === id))
    .filter(Boolean)
    .map((chunk) => ({
      sourceId: chunk!.sourceId,
      name: chunk!.name,
      page: typeof chunk!.locator.page === "number" ? chunk!.locator.page : undefined,
      excerpt: chunk!.text.slice(0, 160),
      imagePath: chunk!.imagePath ?? undefined,
    }));
}

function fallbackOutline(
  chunks: Array<{ id: string }>,
  types: NoteType[],
) {
  const type = types.includes("qa") ? "qa" : types[0]!;
  return [
    {
      title: "资料要点",
      summary: "根据资料整理关键概念",
      chunkIds: chunks.slice(0, 3).map((chunk) => chunk.id),
      suggestedType: type,
    },
  ];
}

function formatLocator(locator: Record<string, unknown>) {
  if (typeof locator.page === "number") return `p.${locator.page}`;
  if (typeof locator.imageIndex === "number") return `图${locator.imageIndex + 1}`;
  return "正文";
}

function split<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

function cap(limit: number | "auto") {
  if (limit === "auto") return 30;
  return Math.min(AI_LIMITS.maxCards, Math.max(1, limit));
}

function asRecord(value: Json | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mimeFromPath(path: string) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
