"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createApiToken, revokeApiToken } from "@/app/actions/api-tokens";
import type { ApiTokenSummary } from "@/lib/agent/api-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AgentAccess({
  origin,
  tokens,
  error,
}: {
  origin: string;
  tokens: ApiTokenSummary[];
  error: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("我的 Agent");
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const lock = useRef(false);
  const mcp = `{
  "mcpServers": {
    "v-ji": {
      "url": "${origin}/api/mcp",
      "headers": { "Authorization": "Bearer <个人访问令牌>" }
    }
  }
}`;

  async function create() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      const result = await createApiToken(name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSecret(result.token ?? null);
      router.refresh();
      toast.success("令牌已创建，请立即复制");
    } catch {
      toast.error("暂时无法创建令牌");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  async function revoke(id: string) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      const result = await revokeApiToken(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConfirmId(null);
      router.refresh();
      toast.success("令牌已撤销");
    } catch {
      toast.error("暂时无法撤销令牌");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制");
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  }

  return (
    <section className="space-y-3 rounded-3xl bg-white p-4">
      <div>
        <p className="text-sm font-medium">Agent 接入</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          个人访问令牌代表你自己的账号。任意 Agent 或 MCP 客户端带上它之后，只能查看和修改这个账号里的卡片。
        </p>
      </div>
      <details className="rounded-2xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">连接方式</summary>
        <div className="mt-2 space-y-2">
          <p>基础地址 {origin}</p>
          <p>请求头 Authorization: Bearer &lt;令牌&gt;。浏览器里已登录时，也可以不带令牌，直接用当前会话。</p>
          <p>GET/POST {origin}/api/v1/cards</p>
          <p>GET/PATCH {origin}/api/v1/cards/&lt;卡片 ID&gt;</p>
          <p>MCP {origin}/api/mcp ，工具为 list_cards、get_card、create_card、update_card。</p>
          <pre className="overflow-x-auto rounded-xl bg-white p-2 text-[11px] leading-4 text-foreground">{mcp}</pre>
        </div>
      </details>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {secret ? (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs leading-5 text-muted-foreground">这是该令牌唯一一次显示原文。关闭页面前请保存到你的 Agent 配置里。</p>
          <Input readOnly aria-label="个人访问令牌" value={secret} />
          <Button type="button" variant="outline" className="h-10 w-full rounded-full" onClick={() => void copy(secret)}>
            复制令牌
          </Button>
        </div>
      ) : null}
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-foreground">令牌名称</span>
        <Input aria-label="令牌名称" maxLength={40} value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />
      </label>
      <Button type="button" className="h-11 w-full rounded-full" disabled={pending || !name.trim()} onClick={() => void create()}>
        {pending ? "请稍候..." : "创建令牌"}
      </Button>
      <ul className="space-y-2">
        {tokens.length === 0 ? <li className="text-xs text-muted-foreground">还没有有效令牌。</li> : null}
        {tokens.map((token) => (
          <li key={token.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{token.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {token.prefix} · {token.lastUsedAt ? "已使用" : "尚未使用"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-full px-3"
              disabled={pending}
              onClick={() => (confirmId === token.id ? void revoke(token.id) : setConfirmId(token.id))}
            >
              {confirmId === token.id ? "确认撤销" : "撤销"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
