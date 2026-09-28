import { notePreview, sanitizeChoiceFields, validateNoteFields, type NoteFields } from "@/lib/templates";
import type { Json, NoteType } from "@/types/database";
import { CARD_LAYOUTS, type CardLayout } from "@/lib/ai/schemas";

const NOTE_TYPES = ["note", "qa", "choice", "cloze", "poem", "vocab"] as const satisfies readonly NoteType[];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE = 100;
const DEFAULT_PAGE = 50;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_FIELDS_CHARS = 20_000;

export type AgentCard = {
  id: string;
  deckId: string;
  deckName: string;
  type: NoteType;
  fields: NoteFields;
  tags: string[];
  layout: CardLayout;
  source: Json | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicCard = AgentCard & { preview: string };

export type SaveCardInput = {
  id: string | null;
  deckId: string;
  type: NoteType;
  fields: NoteFields;
  tags: string[];
  layout: CardLayout;
  source: Json | null;
};

export type ListQuery = {
  deckId?: string;
  limit: number;
  cursorUpdated: string | null;
  cursorId: string | null;
};

export type CardStore = {
  list(query: ListQuery): Promise<AgentCard[]>;
  get(id: string): Promise<AgentCard | null>;
  save(input: SaveCardInput): Promise<AgentCard>;
};

export class CardStoreError extends Error {
  constructor(
    readonly code: "unauthorized" | "not_found" | "deck_not_found" | "invalid_cursor" | "invalid_request",
    message: string,
  ) {
    super(message);
  }
}

export type CardCommand =
  | { op: "list"; deckId?: string; limit: number; cursor: { updatedAt: string; id: string } | null }
  | { op: "get"; id: string }
  | { op: "create"; body: unknown }
  | { op: "update"; id: string; body: unknown };

export type CardCommandResult =
  | { ok: true; status: 200 | 201; body: { card: PublicCard } | { cards: PublicCard[]; nextCursor: string | null } }
  | { ok: false; status: 400 | 401 | 404; error: { code: string; message: string } };

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function clampPageLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return DEFAULT_PAGE;
  const limit = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) return null;
  return limit;
}

export function encodeCursor(card: { updatedAt: string; id: string }) {
  return Buffer.from(`${card.updatedAt}|${card.id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): { updatedAt: string; id: string } | null {
  let raw = "";
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const split = raw.lastIndexOf("|");
  if (split <= 0) return null;
  const updatedAt = raw.slice(0, split);
  const id = raw.slice(split + 1);
  if (!isUuid(id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) {
    return null;
  }
  return { updatedAt, id };
}

export function presentCard(card: AgentCard): PublicCard {
  return { ...card, preview: notePreview(card.type, card.fields) };
}

export function applyListQuery(cards: readonly AgentCard[], query: ListQuery): AgentCard[] {
  const filtered = cards.filter((card) => !query.deckId || card.deckId === query.deckId);
  const sorted = [...filtered].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? 1 : -1;
    return left.id < right.id ? 1 : -1;
  });
  const cursored =
    query.cursorUpdated && query.cursorId
      ? sorted.filter(
          (card) =>
            card.updatedAt < query.cursorUpdated! ||
            (card.updatedAt === query.cursorUpdated && card.id < query.cursorId!),
        )
      : sorted;
  return cursored.slice(0, query.limit);
}

export function parseStoredCard(value: unknown): (AgentCard & { ownerId: string }) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.owner_id !== "string" || typeof row.deck_id !== "string") return null;
  if (typeof row.deck_name !== "string") return null;
  if (typeof row.type !== "string" || !NOTE_TYPES.includes(row.type as NoteType)) return null;
  if (typeof row.layout !== "string" || !CARD_LAYOUTS.includes(row.layout as CardLayout)) return null;
  if (!row.fields || typeof row.fields !== "object" || Array.isArray(row.fields)) return null;
  if (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string")) return null;
  if (typeof row.created_at !== "string" || typeof row.updated_at !== "string") return null;
  const source = row.source === undefined ? null : row.source;
  if (!isJson(source)) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    deckId: row.deck_id,
    deckName: row.deck_name,
    type: row.type as NoteType,
    fields: row.fields as NoteFields,
    tags: row.tags as string[],
    layout: row.layout as CardLayout,
    source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseStoredCards(value: unknown): Array<AgentCard & { ownerId: string }> | null {
  if (!Array.isArray(value)) return null;
  const cards: Array<AgentCard & { ownerId: string }> = [];
  for (const item of value) {
    const card = parseStoredCard(item);
    if (!card) return null;
    cards.push(card);
  }
  return cards;
}

export function ownedCards(rows: Array<AgentCard & { ownerId: string }>, ownerId: string): AgentCard[] | null {
  if (rows.some((row) => row.ownerId !== ownerId)) return null;
  return rows.map(stripOwner);
}

export function stripOwner(card: AgentCard & { ownerId: string }): AgentCard {
  return {
    id: card.id,
    deckId: card.deckId,
    deckName: card.deckName,
    type: card.type,
    fields: card.fields,
    tags: card.tags,
    layout: card.layout,
    source: card.source,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

export async function executeCardCommand(store: CardStore, command: CardCommand): Promise<CardCommandResult> {
  try {
    if (command.op === "list") {
      const rows = await store.list({
        deckId: command.deckId,
        limit: command.limit + 1,
        cursorUpdated: command.cursor?.updatedAt ?? null,
        cursorId: command.cursor?.id ?? null,
      });
      const page = rows.slice(0, command.limit);
      const last = page.at(-1);
      return {
        ok: true,
        status: 200,
        body: {
          cards: page.map(presentCard),
          nextCursor: rows.length > command.limit && last ? encodeCursor(last) : null,
        },
      };
    }

    if (command.op === "get") {
      if (!isUuid(command.id)) return failure(400, "invalid_request", "卡片 ID 无效");
      const card = await store.get(command.id);
      if (!card) return failure(404, "not_found", "卡片不存在");
      return { ok: true, status: 200, body: { card: presentCard(card) } };
    }

    if (command.op === "create") {
      const parsed = parseCreateBody(command.body);
      if (!parsed.ok) return parsed.result;
      const card = await store.save(parsed.input);
      return { ok: true, status: 201, body: { card: presentCard(card) } };
    }

    if (!isUuid(command.id)) return failure(400, "invalid_request", "卡片 ID 无效");
    const existing = await store.get(command.id);
    if (!existing) return failure(404, "not_found", "卡片不存在");
    const parsed = parseUpdateBody(command.body, existing);
    if (!parsed.ok) return parsed.result;
    const card = await store.save(parsed.input);
    return { ok: true, status: 200, body: { card: presentCard(card) } };
  } catch (error) {
    if (error instanceof CardStoreError) {
      const status = error.code === "unauthorized" ? 401 : error.code === "invalid_cursor" || error.code === "invalid_request" ? 400 : 404;
      return failure(status, error.code, error.message);
    }
    throw error;
  }
}

function parseCreateBody(body: unknown): { ok: true; input: SaveCardInput } | { ok: false; result: CardCommandResult } {
  const record = asRecord(body);
  if (!record) return { ok: false, result: failure(400, "invalid_request", "请求体须为 JSON 对象") };
  if (typeof record.deckId !== "string" || !isUuid(record.deckId)) {
    return { ok: false, result: failure(400, "invalid_request", "deckId 须为卡片盒 ID") };
  }
  const type = parseType(record.type);
  if (!type) return { ok: false, result: failure(400, "invalid_request", "type 须为 qa、choice、cloze、vocab、poem 或 note") };
  const fields = asFields(record.fields);
  if (!fields) return { ok: false, result: failure(400, "invalid_request", "fields 须为对象") };
  const tags = record.tags === undefined ? [] : parseTags(record.tags);
  if (!tags) return { ok: false, result: failure(400, "invalid_request", "tags 须为不超过 20 个、每项不超过 40 字的字符串数组") };
  const layout = record.layout === undefined ? "minimal" : parseLayout(record.layout);
  if (!layout) return { ok: false, result: failure(400, "invalid_request", "layout 须为 minimal、emphasis 或 illustrated") };
  const source = parseSource(record.source);
  if (source === "invalid") return { ok: false, result: failure(400, "invalid_request", "source 须为 JSON 值") };
  const prepared = prepareFields(type, fields);
  if (!prepared.ok) return { ok: false, result: failure(400, "invalid_request", prepared.message) };
  return { ok: true, input: { id: null, deckId: record.deckId, type, fields: prepared.fields, tags, layout, source } };
}

function parseUpdateBody(
  body: unknown,
  existing: AgentCard,
): { ok: true; input: SaveCardInput } | { ok: false; result: CardCommandResult } {
  const record = asRecord(body);
  if (!record) return { ok: false, result: failure(400, "invalid_request", "请求体须为 JSON 对象") };
  const touched = ["deckId", "type", "fields", "tags", "layout", "source"].some((key) => key in record);
  if (!touched) return { ok: false, result: failure(400, "invalid_request", "请提供要修改的字段") };

  const deckId = record.deckId === undefined ? existing.deckId : record.deckId;
  if (typeof deckId !== "string" || !isUuid(deckId)) {
    return { ok: false, result: failure(400, "invalid_request", "deckId 须为卡片盒 ID") };
  }
  const type = record.type === undefined ? existing.type : parseType(record.type);
  if (!type) return { ok: false, result: failure(400, "invalid_request", "type 须为 qa、choice、cloze、vocab、poem 或 note") };
  const fields = record.fields === undefined ? existing.fields : mergeFields(existing.fields, record.fields);
  if (!fields) return { ok: false, result: failure(400, "invalid_request", "fields 须为对象") };
  const tags = record.tags === undefined ? existing.tags : parseTags(record.tags);
  if (!tags) return { ok: false, result: failure(400, "invalid_request", "tags 须为不超过 20 个、每项不超过 40 字的字符串数组") };
  const layout = record.layout === undefined ? existing.layout : parseLayout(record.layout);
  if (!layout) return { ok: false, result: failure(400, "invalid_request", "layout 须为 minimal、emphasis 或 illustrated") };
  const source = "source" in record ? parseSource(record.source) : existing.source;
  if (source === "invalid") return { ok: false, result: failure(400, "invalid_request", "source 须为 JSON 值") };
  const prepared = prepareFields(type, fields);
  if (!prepared.ok) return { ok: false, result: failure(400, "invalid_request", prepared.message) };
  return {
    ok: true,
    input: { id: existing.id, deckId, type, fields: prepared.fields, tags, layout, source: source === "invalid" ? null : source },
  };
}

function prepareFields(type: NoteType, fields: NoteFields): { ok: true; fields: NoteFields } | { ok: false; message: string } {
  if (JSON.stringify(fields).length > MAX_FIELDS_CHARS) return { ok: false, message: "fields 过大" };
  let next = fields;
  if (type === "choice") {
    const sanitized = sanitizeChoiceFields(fields);
    if (!sanitized) return { ok: false, message: "选择题至少需要 2 个已填写的选项" };
    next = { ...fields, ...sanitized };
  }
  const invalid = validateNoteFields(type, next);
  if (invalid) return { ok: false, message: invalid };
  return { ok: true, fields: next };
}

function mergeFields(current: NoteFields, patch: unknown): NoteFields | null {
  const incoming = asFields(patch);
  if (!incoming) return null;
  return { ...current, ...incoming };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFields(value: unknown): NoteFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as NoteFields;
}

function parseType(value: unknown): NoteType | null {
  return typeof value === "string" && NOTE_TYPES.includes(value as NoteType) ? (value as NoteType) : null;
}

function parseLayout(value: unknown): CardLayout | null {
  return typeof value === "string" && CARD_LAYOUTS.includes(value as CardLayout) ? (value as CardLayout) : null;
}

function parseTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const tag = item.trim();
    if (!tag || tag.length > MAX_TAG_LENGTH) return null;
    tags.push(tag);
  }
  return tags;
}

function parseSource(value: unknown): Json | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (!isJson(value)) return "invalid";
  return value;
}

function isJson(value: unknown): value is Json {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isJson);
  return false;
}

function failure(status: 400 | 401 | 404, code: string, message: string): CardCommandResult {
  return { ok: false, status, error: { code, message } };
}
