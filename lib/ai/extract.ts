import { chunkText, estimateTokens } from "@/lib/ai/chunk";
import type { TextChunk } from "@/lib/ai/schemas";
import { AI_LIMITS } from "@/lib/ai/limits";
import type { Tables } from "@/types/database";

export type ExtractedSource = {
  chunks: TextChunk[];
  warnings: string[];
  pageCount?: number;
};

export async function extractSource(
  source: Tables<"ai_sources">,
  file?: Uint8Array,
): Promise<ExtractedSource> {
  if (source.kind === "text") {
    const text =
      (typeof source.meta === "object" && source.meta && !Array.isArray(source.meta)
        ? String((source.meta as Record<string, unknown>).text ?? "")
        : "") || (file ? new TextDecoder().decode(file) : "");
    return { chunks: chunkText(text, { sourceId: source.id }), warnings: [] };
  }

  if (source.kind === "image") {
    const caption = `图片资料：${source.name}。请结合图像中的文字、图表和标注制卡。`;
    return {
      chunks: [
        {
          sourceId: source.id,
          text: caption,
          locator: { sourceId: source.id, imageIndex: 0 },
          tokenEstimate: estimateTokens(caption),
        },
      ],
      warnings: [],
    };
  }

  if (source.kind === "pdf") {
    if (!file) return { chunks: [], warnings: [`无法读取 ${source.name}`] };
    return extractPdf(source, file);
  }

  return { chunks: [], warnings: [`暂不支持 ${source.kind}，请粘贴文字或上传 PDF/图片`] };
}

async function extractPdf(source: Tables<"ai_sources">, file: Uint8Array): Promise<ExtractedSource> {
  const { extractText } = await import("unpdf");
  const result = await extractText(file, { mergePages: false });
  const pages = Array.isArray(result.text) ? result.text : [result.text];
  const range = parsePageRange(source.page_range, pages.length);
  const warnings: string[] = [];
  const chunks: TextChunk[] = [];
  const selected = pages.slice(range.start - 1, range.end);
  if (selected.length > AI_LIMITS.maxPdfPages) {
    warnings.push(`PDF 超过 ${AI_LIMITS.maxPdfPages} 页，已截取前 ${AI_LIMITS.maxPdfPages} 页`);
  }
  selected.slice(0, AI_LIMITS.maxPdfPages).forEach((pageText, index) => {
    const page = range.start + index;
    const text = pageText.replace(/\s+\n/g, "\n").trim();
    if (text.length < 24) {
      warnings.push(`第 ${page} 页几乎没有文字，可能是扫描件，建议改用截图`);
      const placeholder = `第 ${page} 页为扫描或图片页，文字层不足。`;
      chunks.push({
        sourceId: source.id,
        text: placeholder,
        locator: { sourceId: source.id, page },
        tokenEstimate: estimateTokens(placeholder),
      });
      return;
    }
    chunks.push(...chunkText(text, { sourceId: source.id, page }));
  });
  return { chunks, warnings, pageCount: pages.length };
}

function parsePageRange(raw: Tables<"ai_sources">["page_range"], total: number) {
  const fallback = { start: 1, end: total };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;
  const start = clamp(Number(value.start) || 1, 1, total);
  const end = clamp(Number(value.end) || total, start, total);
  return { start, end };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
