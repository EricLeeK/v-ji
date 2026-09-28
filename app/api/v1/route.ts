import { agentJson } from "@/lib/agent/http";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export function GET() {
  const origin = siteOrigin();
  return agentJson(
    {
      name: "v-ji",
      auth: "Authorization: Bearer <个人访问令牌>。浏览器登录会话也可调用。令牌在设置页创建，只代表该账号。",
      cards: `${origin}/api/v1/cards`,
      mcp: `${origin}/api/mcp`,
    },
    200,
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: agentJson({}, 204).headers });
}
