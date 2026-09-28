import { expect, it } from "vitest";
import { generateApiToken, hashApiToken, resolveActor } from "@/lib/agent/token";
import { isAgentApiPath } from "@/lib/agent/paths";
import {
  applyListQuery,
  decodeCursor,
  encodeCursor,
  executeCardCommand,
  ownedCards,
  parseStoredCard,
  type AgentCard,
} from "@/lib/agent/cards";
import { createMemoryDirectory } from "@/lib/agent/memory-store";
import { handleCardCollection, handleCardItem, type AgentRuntime } from "@/lib/agent/http";
import { handleMcp } from "@/lib/agent/mcp";

const deckA = "11111111-1111-4111-8111-111111111111";
const deckB = "22222222-2222-4222-8222-222222222222";

function directory() {
  const dir = createMemoryDirectory();
  dir.addDeck("user-a", deckA, "甲的卡片盒");
  dir.addDeck("user-b", deckB, "乙的卡片盒");
  return dir;
}

function runtime(authenticate: AgentRuntime["authenticate"]): AgentRuntime {
  return { authenticate };
}

function authRuntime(dir: ReturnType<typeof directory>, tokens: Map<string, string>, sessionUserId: string | null): AgentRuntime {
  return runtime(async (request) => {
    const actor = await resolveActor(request.headers.get("authorization"), sessionUserId, async (hash) => tokens.get(hash) ?? null);
    return actor ? dir.storeFor(actor.userId) : null;
  });
}

it("keeps a bearer token from falling back to another account's session", async () => {
  expect(await resolveActor("Bearer not-a-token", "user-b", async () => "user-a")).toBeNull();
  expect(await resolveActor(null, "user-b", async () => "user-a")).toEqual({ userId: "user-b", tokenHash: null });
  const token = generateApiToken();
  const actor = await resolveActor(`Bearer ${token}`, "user-b", async (hash) => (hash === hashApiToken(token) ? "user-a" : null));
  expect(actor?.userId).toBe("user-a");
  expect(actor?.tokenHash).toBe(hashApiToken(token));
  expect(await resolveActor(`Bearer ${token}`, "user-b", async () => null)).toBeNull();
});

it("does not treat the card image route as an agent API", () => {
  expect(isAgentApiPath("/api/v1/cards")).toBe(true);
  expect(isAgentApiPath("/api/mcp")).toBe(true);
  expect(isAgentApiPath("/api/card-images")).toBe(false);
  expect(isAgentApiPath("/decks")).toBe(false);
});

it("drops rows that are not owned by the actor", () => {
  const parsed = parseStoredCard(stored("user-a", deckA));
  expect(parsed?.deckId).toBe(deckA);
  expect(ownedCards(parsed ? [parsed] : [], "user-a")).toHaveLength(1);
  expect(ownedCards(parsed ? [parsed] : [], "user-b")).toBeNull();
});

it("creates and updates only the authenticated account's cards", async () => {
  const dir = directory();
  const tokens = new Map([[hashApiToken("vji_aaaaaaaaaaaaaaaaaaaa"), "user-a"]]);
  const api = authRuntime(dir, tokens, null);
  const created = await handleCardCollection(jsonRequest("POST", "/api/v1/cards", {
    ownerId: "user-b",
    deckId: deckA,
    type: "qa",
    fields: { question: "问", answer: "答" },
  }, "Bearer vji_aaaaaaaaaaaaaaaaaaaa"), api);
  expect(created.status).toBe(201);
  const body = await created.json() as { card: { id: string; deckId: string; fields: { question: string } } };
  expect(body.card.deckId).toBe(deckA);
  expect(dir.cardsOf("user-b")).toEqual([]);

  const stolen = await handleCardCollection(jsonRequest("POST", "/api/v1/cards", {
    deckId: deckB,
    type: "qa",
    fields: { question: "别人的盒", answer: "不行" },
  }, "Bearer vji_aaaaaaaaaaaaaaaaaaaa"), api);
  expect(stolen.status).toBe(404);
  expect(dir.cardsOf("user-b")).toEqual([]);

  const moved = await handleCardItem(jsonRequest("PATCH", `/api/v1/cards/${body.card.id}`, {
    deckId: deckB,
  }, "Bearer vji_aaaaaaaaaaaaaaaaaaaa"), body.card.id, api);
  expect(moved.status).toBe(404);
  expect(dir.cardsOf("user-a")[0]?.deckId).toBe(deckA);

  const updated = await handleCardItem(jsonRequest("PATCH", `/api/v1/cards/${body.card.id}`, {
    ownerId: "user-b",
    fields: { answer: "新答案" },
  }, "Bearer vji_aaaaaaaaaaaaaaaaaaaa"), body.card.id, api);
  expect(updated.status).toBe(200);
  const after = await updated.json() as { card: { fields: { question: string; answer: string } } };
  expect(after.card.fields).toMatchObject({ question: "问", answer: "新答案" });

  const other = authRuntime(dir, new Map(), "user-b");
  const hidden = await handleCardItem(new Request("http://localhost/api/v1/cards/" + body.card.id), body.card.id, other);
  expect(hidden.status).toBe(404);
  const tamper = await handleCardItem(jsonRequest("PATCH", `/api/v1/cards/${body.card.id}`, {
    fields: { answer: "被改掉" },
  }), body.card.id, other);
  expect(tamper.status).toBe(404);
  expect(dir.cardsOf("user-a")[0]?.fields).toMatchObject({ answer: "新答案" });
});

it("rejects an invalid token even when a browser session exists", async () => {
  const dir = directory();
  const api = authRuntime(dir, new Map([[hashApiToken("vji_bbbbbbbbbbbbbbbbbbbb"), "user-b"]]), "user-b");
  const response = await handleCardCollection(jsonRequest("GET", "/api/v1/cards", undefined, "Bearer vji_not-valid"), api);
  expect(response.status).toBe(401);
  expect(dir.cardsOf("user-b")).toEqual([]);
});

it("rejects incomplete cards and pages only the caller's deck", async () => {
  const dir = directory();
  const api = authRuntime(dir, new Map(), "user-a");
  const invalid = await handleCardCollection(jsonRequest("POST", "/api/v1/cards", {
    deckId: deckA,
    type: "qa",
    fields: { question: "只有问题" },
  }), api);
  expect(invalid.status).toBe(400);
  expect(dir.cardsOf("user-a")).toEqual([]);

  await executeCardCommand(dir.storeFor("user-a"), {
    op: "create",
    body: { deckId: deckA, type: "note", fields: { title: "一", body: "甲" } },
  });
  await executeCardCommand(dir.storeFor("user-b"), {
    op: "create",
    body: { deckId: deckB, type: "note", fields: { title: "二", body: "乙" } },
  });
  const listed = await handleCardCollection(new Request(`http://localhost/api/v1/cards?deckId=${deckA}&limit=1`), api);
  expect(listed.status).toBe(200);
  const page = await listed.json() as { cards: Array<{ deckId: string }>; nextCursor: string | null };
  expect(page.cards.map((card) => card.deckId)).toEqual([deckA]);
  expect(page.nextCursor).toBeNull();
});

it("orders cards for cursor pagination", () => {
  const older = card("2026-09-01T00:00:00.000Z", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const newer = card("2026-09-02T00:00:00.000Z", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  const cursor = decodeCursor(encodeCursor(newer));
  expect(cursor?.id).toBe(newer.id);
  const page = applyListQuery([older, newer], { limit: 10, cursorUpdated: cursor!.updatedAt, cursorId: cursor!.id });
  expect(page.map((item) => item.id)).toEqual([older.id]);
});

it("exposes the same create and ownership rules over MCP", async () => {
  const dir = directory();
  const token = "vji_cccccccccccccccccccc";
  const api = authRuntime(dir, new Map([[hashApiToken(token), "user-a"]]), null);
  const denied = await handleMcp(jsonRpc("tools/call", { name: "list_cards", arguments: {} }), api);
  expect(denied.status).toBe(401);

  const authed = await handleMcp(jsonRpc("tools/call", {
    name: "create_card",
    arguments: { deckId: deckA, type: "qa", fields: { question: "MCP", answer: "可以" }, ownerId: "user-b" },
  }, token), api);
  expect(authed.status).toBe(200);
  const created = await authed.json() as { result: { isError: boolean; content: Array<{ text: string }> } };
  expect(created.result.isError).toBe(false);
  const cardId = JSON.parse(created.result.content[0].text).card.id as string;
  expect(dir.cardsOf("user-b")).toEqual([]);

  const listed = await handleMcp(jsonRpc("tools/call", { name: "list_cards", arguments: {} }, token), api);
  const listBody = await listed.json() as { result: { content: Array<{ text: string }> } };
  expect(JSON.parse(listBody.result.content[0].text).cards).toHaveLength(1);

  const other = authRuntime(dir, new Map([[hashApiToken("vji_dddddddddddddddddddd"), "user-b"]]), null);
  const missing = await handleMcp(jsonRpc("tools/call", { name: "get_card", arguments: { id: cardId } }, "vji_dddddddddddddddddddd"), other);
  const missingBody = await missing.json() as { result: { isError: boolean } };
  expect(missingBody.result.isError).toBe(true);
  expect(dir.cardsOf("user-a")[0]?.fields).toMatchObject({ answer: "可以" });

  const tools = await handleMcp(jsonRpc("tools/list", {}, token), api);
  const toolBody = await tools.json() as { result: { tools: Array<{ name: string }> } };
  expect(toolBody.result.tools.map((tool) => tool.name)).toEqual(["list_cards", "get_card", "create_card", "update_card"]);
});

function jsonRequest(method: string, path: string, body?: unknown, authorization?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function jsonRpc(method: string, params: unknown, token?: string) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

function card(updatedAt: string, id: string): AgentCard {
  return {
    id,
    deckId: deckA,
    deckName: "甲",
    type: "qa",
    fields: { question: "问", answer: "答" },
    tags: [],
    layout: "minimal",
    source: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

function stored(ownerId: string, deckId: string) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    owner_id: ownerId,
    deck_id: deckId,
    deck_name: "盒",
    type: "qa",
    fields: { question: "问", answer: "答" },
    tags: [],
    layout: "minimal",
    source: null,
    created_at: "2026-09-28T00:00:00.000Z",
    updated_at: "2026-09-28T00:00:00.000Z",
  };
}
