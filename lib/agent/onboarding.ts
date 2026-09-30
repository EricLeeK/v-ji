export type OnboardingDeck = { id: string; name: string };
export function connectionConfig(origin: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        "v-ji": {
          url: origin.replace(/\/$/, "") + "/api/mcp",
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}
export function firstCardPrompt(deck?: OnboardingDeck) {
  return `请使用 v-ji 的 agent_help 和 list_decks，确认连接的是我的账号。${deck ? `本次目标卡片盒是 ${JSON.stringify(deck.name)}（deckId: ${deck.id}），请核对它在返回列表中。` : "请先让我选择目标卡片盒；如果还没有卡片盒，提示我回到 V 记创建。"}\n把下面材料整理成 3 张适合复习的卡片，保留真实出处。先用 list_cards 检查已有内容，再展示题目和答案让我确认；确认后调用 create_card 保存，并用 get_card 核对，给我返回卡片盒链接。不要提交复习评分；如果请求超时，先检查是否已保存，不要盲目重复创建。\n\n材料：在这里粘贴我要学习的内容。`;
}
export async function probeConnection(
  token: string,
  request: typeof fetch = fetch,
): Promise<{ decks: number }> {
  const response = await request("/api/mcp", {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_decks", arguments: { limit: 1 } },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401)
    throw new Error("令牌已失效，请创建新连接并更新 Agent 配置。");
  if (!response.ok) throw new Error("服务暂时无法连接，请稍后重试。");
  const body = await response.json();
  if (
    body.error ||
    body.result?.isError ||
    !Array.isArray(body.result?.content)
  )
    throw new Error("连接未通过验证，请稍后重试。");
  const content = body.result.content.find(
    (entry: { type?: string; text?: string }) => entry.type === "text",
  );
  const result = JSON.parse(content?.text ?? "null");
  if (!result || !Array.isArray(result.decks))
    throw new Error("服务返回的卡片盒信息无效，请稍后重试。");
  return { decks: result.decks.length };
}
