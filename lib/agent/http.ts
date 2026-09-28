import {
  clampPageLimit,
  decodeCursor,
  executeCardCommand,
  isUuid,
  type CardStore,
  type CardCommandResult,
} from "@/lib/agent/cards";
import { AgentUnavailableError } from "@/lib/agent/errors";

export type AgentRuntime = {
  authenticate(request: Request): Promise<CardStore | null>;
};

const UNAUTHORIZED = { error: { code: "unauthorized", message: "需要登录，或提供本人的个人访问令牌" } };

export function agentJson(body: unknown, status: number, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  return new Response(JSON.stringify(body), { status, headers });
}

export function agentOptions(allow: string) {
  const response = agentJson({}, 204, { allow });
  return new Response(null, { status: 204, headers: response.headers });
}

export function agentErrorResponse(error: unknown, logLabel: string) {
  if (error instanceof AgentUnavailableError) {
    return agentJson({ error: { code: "unavailable", message: error.message } }, 503);
  }
  console.error(logLabel, error instanceof Error ? error.message : "error");
  return agentJson({ error: { code: "unavailable", message: "卡片接口暂时不可用" } }, 500);
}

export async function handleCardCollection(request: Request, runtime: AgentRuntime): Promise<Response> {
  try {
    return await handleCardCollectionUnsafe(request, runtime);
  } catch (error) {
    return agentErrorResponse(error, "agent cards");
  }
}

async function handleCardCollectionUnsafe(request: Request, runtime: AgentRuntime): Promise<Response> {
  if (request.method === "OPTIONS") return agentOptions("GET, POST, OPTIONS");
  if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed("GET, POST, OPTIONS");
  const store = await runtime.authenticate(request);
  if (!store) return agentJson(UNAUTHORIZED, 401);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const limit = clampPageLimit(url.searchParams.get("limit"));
    if (limit === null) return agentJson({ error: { code: "invalid_request", message: "limit 须为 1 到 100 的整数" } }, 400);
    const deckId = url.searchParams.get("deckId");
    if (deckId && !isUuid(deckId)) return agentJson({ error: { code: "invalid_request", message: "deckId 须为卡片盒 ID" } }, 400);
    const cursorText = url.searchParams.get("cursor");
    const cursor = cursorText ? decodeCursor(cursorText) : null;
    if (cursorText && !cursor) return agentJson({ error: { code: "invalid_cursor", message: "分页游标无效" } }, 400);
    return respond(
      await executeCardCommand(store, {
        op: "list",
        deckId: deckId ?? undefined,
        limit,
        cursor,
      }),
    );
  }

  const body = await readJson(request);
  if (!body.ok) return agentJson({ error: { code: "invalid_request", message: "请求体不是有效的 JSON" } }, 400);
  return respond(await executeCardCommand(store, { op: "create", body: body.value }));
}

export async function handleCardItem(request: Request, id: string, runtime: AgentRuntime): Promise<Response> {
  try {
    return await handleCardItemUnsafe(request, id, runtime);
  } catch (error) {
    return agentErrorResponse(error, "agent cards");
  }
}

async function handleCardItemUnsafe(request: Request, id: string, runtime: AgentRuntime): Promise<Response> {
  if (request.method === "OPTIONS") return agentOptions("GET, PATCH, OPTIONS");
  if (request.method !== "GET" && request.method !== "PATCH") return methodNotAllowed("GET, PATCH, OPTIONS");
  const store = await runtime.authenticate(request);
  if (!store) return agentJson(UNAUTHORIZED, 401);

  if (request.method === "GET") return respond(await executeCardCommand(store, { op: "get", id }));
  const body = await readJson(request);
  if (!body.ok) return agentJson({ error: { code: "invalid_request", message: "请求体不是有效的 JSON" } }, 400);
  return respond(await executeCardCommand(store, { op: "update", id, body: body.value }));
}

function respond(result: CardCommandResult) {
  if (!result.ok) return agentJson({ error: result.error }, result.status);
  return agentJson(result.body, result.status);
}

function methodNotAllowed(allow: string) {
  return agentJson({ error: { code: "method_not_allowed", message: "不支持的方法" } }, 405, { allow });
}

async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text();
  if (text.length > 100_000) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}
