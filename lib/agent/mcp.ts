import { clampPageLimit, decodeCursor, executeCardCommand, isUuid, type CardCommand, type CardStore } from "@/lib/agent/cards";
import { agentErrorResponse, agentJson, type AgentRuntime } from "@/lib/agent/http";

const PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const DEFAULT_PROTOCOL = "2025-03-26";

const TOOLS = [
  {
    name: "list_cards",
    description: "列出当前账号的卡片。可按卡片盒筛选，用 nextCursor 继续翻页。",
    inputSchema: {
      type: "object",
      properties: {
        deckId: { type: "string", description: "只返回这个卡片盒中的卡片" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        cursor: { type: "string", description: "上一页返回的 nextCursor" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_card",
    description: "读取当前账号的一张卡片。卡片 ID 是笔记 ID。",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_card",
    description: "在当前账号的卡片盒中新建卡片。题型与字段同应用内的问答、选择、挖空、单词、古诗文和笔记卡。",
    inputSchema: {
      type: "object",
      properties: {
        deckId: { type: "string" },
        type: { type: "string", enum: ["qa", "choice", "cloze", "vocab", "poem", "note"] },
        fields: { type: "object" },
        tags: { type: "array", items: { type: "string" } },
        layout: { type: "string", enum: ["minimal", "emphasis", "illustrated"] },
        source: {},
      },
      required: ["deckId", "type", "fields"],
      additionalProperties: false,
    },
  },
  {
    name: "update_card",
    description: "修改当前账号的一张卡片。fields 按顶层字段合并。不能改复习进度、收藏或暂停状态。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        deckId: { type: "string" },
        type: { type: "string", enum: ["qa", "choice", "cloze", "vocab", "poem", "note"] },
        fields: { type: "object" },
        tags: { type: "array", items: { type: "string" } },
        layout: { type: "string", enum: ["minimal", "emphasis", "illustrated"] },
        source: {},
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
] as const;

export async function handleMcp(request: Request, runtime: AgentRuntime): Promise<Response> {
  try {
    return await handleMcpUnsafe(request, runtime);
  } catch (error) {
    return agentErrorResponse(error, "agent mcp");
  }
}

async function handleMcpUnsafe(request: Request, runtime: AgentRuntime): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: agentJson({}, 204).headers });
  }
  if (request.method === "GET" || request.method === "DELETE") {
    return agentJson({ error: { code: "method_not_allowed", message: "MCP 使用 POST 发送 JSON-RPC" } }, 405, { allow: "POST, OPTIONS" });
  }
  if (request.method !== "POST") {
    return agentJson({ error: { code: "method_not_allowed", message: "不支持的方法" } }, 405, { allow: "POST, OPTIONS" });
  }

  const text = await request.text();
  if (text.length > 100_000) return rpcError(null, -32700, "Parse error", 400);
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (Array.isArray(payload) || !payload || typeof payload !== "object") return rpcError(null, -32600, "Invalid Request", 400);
  const message = payload as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(message.id ?? null, -32600, "Invalid Request", 400);

  const isNotification = !("id" in message) || message.id === undefined;
  if (message.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: agentJson({}, 202).headers });
  }
  if (isNotification) return new Response(null, { status: 202, headers: agentJson({}, 202).headers });

  const store = await runtime.authenticate(request);
  if (!store) return rpcError(message.id ?? null, -32001, "需要登录，或提供本人的个人访问令牌", 401);

  if (message.method === "initialize") {
    const params = asRecord(message.params);
    const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL;
    const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : DEFAULT_PROTOCOL;
    return rpcResult(message.id ?? null, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "v-ji", version: "0.1.0" },
    });
  }
  if (message.method === "ping") return rpcResult(message.id ?? null, {});
  if (message.method === "tools/list") return rpcResult(message.id ?? null, { tools: TOOLS });
  if (message.method === "tools/call") return callTool(message.id ?? null, message.params, store);
  return rpcError(message.id ?? null, -32601, "Method not found", 400);
}

async function callTool(id: unknown, params: unknown, store: CardStore) {
  const record = asRecord(params);
  const name = record?.name;
  const args = asRecord(record?.arguments) ?? {};
  if (typeof name !== "string") return rpcError(id, -32602, "Invalid params", 400);

  let command: CardCommand;
  if (name === "list_cards") {
    const limit = clampPageLimit(args.limit);
    if (limit === null) return toolError(id, { code: "invalid_request", message: "limit 须为 1 到 100 的整数" });
    if (args.deckId !== undefined && (typeof args.deckId !== "string" || !isUuid(args.deckId))) {
      return toolError(id, { code: "invalid_request", message: "deckId 须为卡片盒 ID" });
    }
    const cursor = typeof args.cursor === "string" ? decodeCursor(args.cursor) : args.cursor === undefined ? null : "invalid";
    if (cursor === "invalid" || (typeof args.cursor === "string" && !cursor)) {
      return toolError(id, { code: "invalid_cursor", message: "分页游标无效" });
    }
    command = { op: "list", deckId: typeof args.deckId === "string" ? args.deckId : undefined, limit, cursor };
  } else if (name === "get_card") {
    if (typeof args.id !== "string") return toolError(id, { code: "invalid_request", message: "卡片 ID 无效" });
    command = { op: "get", id: args.id };
  } else if (name === "create_card") {
    command = { op: "create", body: args };
  } else if (name === "update_card") {
    const cardId = args.id;
    if (typeof cardId !== "string") return toolError(id, { code: "invalid_request", message: "卡片 ID 无效" });
    const body = { ...args };
    delete body.id;
    command = { op: "update", id: cardId, body };
  } else {
    return rpcError(id, -32602, "Unknown tool", 400);
  }

  const result = await executeCardCommand(store, command);
  if (!result.ok) return toolError(id, result.error);
  return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result.body) }], isError: false });
}

function toolError(id: unknown, error: { code: string; message: string }) {
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify({ error }) }],
    isError: true,
  });
}

function rpcResult(id: unknown, result: unknown) {
  return agentJson({ jsonrpc: "2.0", id: id ?? null, result }, 200);
}

function rpcError(id: unknown, code: number, message: string, status: number) {
  return agentJson({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
