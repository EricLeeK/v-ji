import type { ChunkLocator, TextChunk } from "@/lib/ai/schemas";

const DEFAULT_MAX_CHARS = 1400;

export function estimateTokens(text: string) {
  const chars = text.trim().length;
  if (!chars) return 0;
  return Math.max(1, Math.ceil(chars / 2));
}

export function chunkText(
  text: string,
  options: { sourceId: string; page?: number; maxChars?: number },
): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: TextChunk[] = [];
  let buffer = "";
  let bufferOffset = 0;
  let cursor = 0;

  const flush = (offset: number) => {
    const value = buffer.trim();
    if (!value) return;
    chunks.push(makeChunk(value, options.sourceId, options.page, offset));
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    const start = normalized.indexOf(paragraph, cursor);
    cursor = start + paragraph.length;
    if (!buffer) bufferOffset = start;
    if (buffer && buffer.length + paragraph.length + 2 > maxChars) {
      flush(bufferOffset);
      bufferOffset = start;
    }
    if (paragraph.length > maxChars) {
      flush(bufferOffset);
      for (const piece of splitLong(paragraph, maxChars)) {
        const pieceStart = normalized.indexOf(piece, bufferOffset);
        chunks.push(makeChunk(piece, options.sourceId, options.page, pieceStart));
        bufferOffset = pieceStart + piece.length;
      }
      buffer = "";
      continue;
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }
  flush(bufferOffset);
  return chunks;
}

function splitLong(text: string, maxChars: number) {
  const pieces: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    pieces.push(text.slice(i, i + maxChars));
  }
  return pieces;
}

function makeChunk(text: string, sourceId: string, page: number | undefined, offset: number): TextChunk {
  const locator: ChunkLocator = { sourceId, offset, ...(page ? { page } : {}) };
  return {
    sourceId,
    text,
    locator,
    tokenEstimate: estimateTokens(text),
  };
}
