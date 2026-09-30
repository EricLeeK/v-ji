import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CardStoreError,
  ownedCards,
  parseStoredCard,
  parseStoredCards,
  stripOwner,
  type AgentCard,
  type CardStore,
  type ListQuery,
  type SaveCardInput,
} from "@/lib/agent/cards";
import {
  AgentUnavailableError,
  isAgentSchemaMissing,
} from "@/lib/agent/errors";
import type { Database, Json } from "@/types/database";

type Db = SupabaseClient<Database>;

export function createSessionCardStore(client: Db, ownerId: string): CardStore {
  return bindStore(ownerId, {
    decks: (limit, offset) =>
      client.rpc("list_own_agent_decks", { p_limit: limit, p_offset: offset }),
    list: (query) =>
      client.rpc("list_own_cards", {
        p_deck_id: query.deckId ?? null,
        p_limit: query.limit,
        p_cursor_updated: query.cursorUpdated,
        p_cursor_id: query.cursorId,
      }),
    get: (id) => client.rpc("get_own_card", { p_note_id: id }),
    save: (input) =>
      client.rpc("save_own_card", {
        p_note_id: input.id,
        p_deck_id: input.deckId,
        p_type: input.type,
        p_fields: input.fields as Json,
        p_tags: input.tags,
        p_layout: input.layout,
        p_source: input.source,
      }),
  });
}

export function createTokenCardStore(
  client: Db,
  ownerId: string,
  tokenHash: string,
): CardStore {
  return bindStore(ownerId, {
    decks: (limit, offset) =>
      client.rpc("agent_list_decks", {
        p_token_hash: tokenHash,
        p_limit: limit,
        p_offset: offset,
      }),
    list: (query) =>
      client.rpc("agent_list_cards", {
        p_token_hash: tokenHash,
        p_deck_id: query.deckId ?? null,
        p_limit: query.limit,
        p_cursor_updated: query.cursorUpdated,
        p_cursor_id: query.cursorId,
      }),
    get: (id) =>
      client.rpc("agent_get_card", { p_token_hash: tokenHash, p_note_id: id }),
    save: (input) =>
      client.rpc("agent_save_card", {
        p_token_hash: tokenHash,
        p_note_id: input.id,
        p_deck_id: input.deckId,
        p_type: input.type,
        p_fields: input.fields as Json,
        p_tags: input.tags,
        p_layout: input.layout,
        p_source: input.source,
      }),
  });
}

function bindStore(
  ownerId: string,
  rpc: {
    decks: (
      limit: number,
      offset: number,
    ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;
    list: (
      query: ListQuery,
    ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;
    get: (
      id: string,
    ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;
    save: (
      input: SaveCardInput,
    ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;
  },
): CardStore {
  return {
    async listDecks(limit, offset) {
      const { data, error } = await rpc.decks(limit, offset);
      raiseStoreError(error);
      if (!Array.isArray(data))
        throw new CardStoreError("invalid_request", "无法读取卡片盒");
      return data.map((row) => {
        if (
          !row ||
          typeof row !== "object" ||
          Array.isArray(row) ||
          typeof row.id !== "string" ||
          typeof row.name !== "string" ||
          row.owner_id !== ownerId
        )
          throw new CardStoreError("unauthorized", "无法读取卡片盒");
        return { id: row.id, name: row.name };
      });
    },
    async list(query) {
      const { data, error } = await rpc.list(query);
      raiseStoreError(error);
      const parsed = parseStoredCards(data ?? []);
      if (!parsed) throw new CardStoreError("invalid_request", "无法读取卡片");
      const cards = ownedCards(parsed, ownerId);
      if (!cards) {
        console.error("agent card owner mismatch");
        throw new CardStoreError("unauthorized", "需要登录或个人访问令牌");
      }
      return cards;
    },
    async get(id) {
      const { data, error } = await rpc.get(id);
      raiseStoreError(error);
      if (data == null) return null;
      return ownCard(data, ownerId);
    },
    async save(input) {
      const previous = input.id ? await this.get(input.id) : null;
      if (input.id && !previous)
        throw new CardStoreError("not_found", "卡片不存在");
      const { data, error } = await rpc.save(input);
      raiseStoreError(error);
      const card = ownCard(data, ownerId);
      if (!card) throw new CardStoreError("not_found", "卡片不存在");
      revalidateCardPaths([card.deckId, previous?.deckId]);
      return card;
    },
  };
}

function ownCard(value: Json | null, ownerId: string): AgentCard | null {
  if (value == null) return null;
  const parsed = parseStoredCard(value);
  if (!parsed) throw new CardStoreError("invalid_request", "无法读取卡片");
  if (parsed.ownerId !== ownerId) {
    console.error("agent card owner mismatch");
    throw new CardStoreError("unauthorized", "需要登录或个人访问令牌");
  }
  return stripOwner(parsed);
}

function raiseStoreError(error: { message: string } | null) {
  if (!error) return;
  const message = error.message;
  if (isAgentSchemaMissing(message)) {
    console.error("agent card store", message);
    throw new AgentUnavailableError("卡片接口的数据库迁移尚未应用");
  }
  if (message.includes("not authenticated"))
    throw new CardStoreError("unauthorized", "需要登录或个人访问令牌");
  if (message.includes("deck not found"))
    throw new CardStoreError("deck_not_found", "卡片盒不存在");
  if (message.includes("note not found"))
    throw new CardStoreError("not_found", "卡片不存在");
  if (message.includes("invalid cursor"))
    throw new CardStoreError("invalid_cursor", "分页游标无效");
  console.error("agent card store", message);
  throw new CardStoreError("invalid_request", "无法完成卡片操作");
}

function revalidateCardPaths(deckIds: Array<string | undefined>) {
  for (const deckId of new Set(
    deckIds.filter((id): id is string => Boolean(id)),
  )) {
    revalidatePath(`/decks/${deckId}`);
  }
  revalidatePath("/decks");
  revalidatePath("/today");
}
