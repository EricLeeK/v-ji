import { NextResponse } from "next/server";
import { toggleStar } from "@/app/actions/notes";

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

function json(body: { error?: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!CARD_ID.test(id)) return json({ error: "卡片不存在或已被删除" }, 404);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "请求无效" }, 400);
  }

  const starred = payload && typeof payload === "object" && "starred" in payload
    ? (payload as { starred: unknown }).starred
    : undefined;
  if (typeof starred !== "boolean") return json({ error: "请求无效" }, 400);

  const result = await toggleStar(id, starred);
  if (!result.error) return json({});

  const status = result.error === "请先登录"
    ? 401
    : result.error.includes("不存在") || result.error.includes("已删除")
      ? 404
      : 500;
  return json({ error: result.error }, status);
}
