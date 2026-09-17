import { z } from "zod";
import type { NoteType } from "@/types/database";
import type { NoteFields } from "@/lib/templates";

export const NOTE_TYPES = ["qa", "cloze", "choice", "vocab", "poem", "note"] as const satisfies readonly NoteType[];

export const CARD_LAYOUTS = ["minimal", "emphasis", "illustrated"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export const AI_COVERAGES = ["core", "full"] as const;
export const AI_DETAILS = ["brief", "standard", "detailed"] as const;
export const AI_GROUNDINGS = ["source_only", "allow_supplement"] as const;

export type AiCoverage = (typeof AI_COVERAGES)[number];
export type AiDetail = (typeof AI_DETAILS)[number];
export type AiGrounding = (typeof AI_GROUNDINGS)[number];

export type AiGenerateSettings = {
  types: NoteType[] | "auto";
  coverage: AiCoverage;
  cardLimit: number | "auto";
  detail: AiDetail;
  grounding: AiGrounding;
  layout: CardLayout | "auto";
};

export const DEFAULT_AI_SETTINGS: AiGenerateSettings = {
  types: "auto",
  coverage: "core",
  cardLimit: "auto",
  detail: "brief",
  grounding: "source_only",
  layout: "auto",
};

export type ChunkLocator = {
  sourceId: string;
  page?: number;
  offset?: number;
  imageIndex?: number;
  timeMs?: number;
};

export type TextChunk = {
  sourceId: string;
  text: string;
  locator: ChunkLocator;
  tokenEstimate: number;
};

export const choiceOptionSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
});

export const generatedCardInputSchema = z.object({
  type: z.enum(NOTE_TYPES),
  layout: z.enum(CARD_LAYOUTS).optional().default("minimal"),
  fields: z.record(z.string(), z.unknown()),
  sourceChunkIds: z.array(z.string()).default([]),
  supplemented: z.boolean().optional().default(false),
});

export type GeneratedCardInput = z.input<typeof generatedCardInputSchema>;

export const outlineItemSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  chunkIds: z.array(z.string()).default([]),
  suggestedType: z.enum(NOTE_TYPES),
});

export const outlineResponseSchema = z.object({
  points: z.array(outlineItemSchema).min(1),
});

export const cardsResponseSchema = z.object({
  cards: z.array(generatedCardInputSchema),
});

export type ValidatedCard = {
  type: NoteType;
  layout: CardLayout;
  fields: NoteFields;
  sourceChunkIds: string[];
  flags: string[];
};

export type CardCitation = {
  sourceId: string;
  name?: string;
  page?: number;
  excerpt?: string;
  imagePath?: string;
};

export type NoteSource = {
  jobId?: string;
  citations?: CardCitation[];
};
