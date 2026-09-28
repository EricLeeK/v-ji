import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAgentApiPath } from "@/lib/agent/paths";
import type { Database } from "@/types/database";

const PUBLIC_PREFIXES = [
  "/login",
  "/onboarding",
  "/auth",
  "/manifest.webmanifest",
  "/offline",
  "/serwist",
  "/_next",
];

const AGENT_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
};

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("supabase proxy missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    return supabaseUnavailable(path);
  }

  try {
    return await continueSession(request, url, key);
  } catch (error) {
    console.error("supabase proxy", error instanceof Error ? error.message : "error");
    return supabaseUnavailable(path);
  }
}

async function continueSession(request: NextRequest, url: string, key: string) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => supabaseResponse.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));

  // Agent clients authenticate with a bearer token and need a JSON 401, not an HTML login redirect.
  if (!user && !isPublic && !isAgentApiPath(path) && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // The guide is also linked from the signed-in profile page.
  if (user && path === "/login") {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = "/today";
    return NextResponse.redirect(nextUrl);
  }

  return supabaseResponse;
}

function supabaseUnavailable(path: string) {
  if (isAgentApiPath(path)) {
    return NextResponse.json(
      { error: { code: "unavailable", message: "服务端未配置 Supabase 连接，卡片接口暂时不可用" } },
      { status: 503, headers: { "cache-control": "private, no-store", ...AGENT_CORS } },
    );
  }
  return new NextResponse("服务端未配置 Supabase 连接", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
  });
}
