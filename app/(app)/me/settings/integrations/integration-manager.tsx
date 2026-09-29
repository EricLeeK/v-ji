"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { createLearningHubToken, revokeLearningHubToken } from "@/app/actions/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type IntegrationDeckOption = { id: string; name: string };
export type IntegrationTokenSummary = {
  id: string;
  deck_id: string;
  deck_name: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function IntegrationManager({
  decks,
  tokens,
  supabaseUrl,
  publishableKey,
  loadError,
}: {
  decks: IntegrationDeckOption[];
  tokens: IntegrationTokenSummary[];
  supabaseUrl: string;
  publishableKey: string;
  loadError?: string;
}) {
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [label, setLabel] = useState("V Learning Hub");
  const [newToken, setNewToken] = useState<{ token: string; label: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [pending, startTransition] = useTransition();

  const cleanUrl = supabaseUrl.replace(/\/$/, "");
  const config = [
    `SUPABASE_URL=${cleanUrl}`,
    `SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    `SYNC_RPC=${cleanUrl}/rest/v1/rpc/learning_hub_sync`,
    `STATUS_RPC=${cleanUrl}/rest/v1/rpc/learning_hub_status`,
    "",
    'const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);',
    'const { data, error } = await supabase.rpc("learning_hub_sync", {',
    '  p_token: VJI_TOKEN,',
    '  p_notes: notes, // 1–50 validated notes',
    "});",
    'const progress = await supabase.rpc("learning_hub_status", {',
    '  p_token: VJI_TOKEN, p_limit: 100, p_offset: 0,',
    "});",
  ].join("\n");

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("浏览器未允许剪贴板访问，请选中内容后手动复制");
    }
  }

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setNewToken(null);
    startTransition(async () => {
      const result = await createLearningHubToken(deckId, label);
      if (result.error || !result.token || !result.label) {
        setError(result.error ?? "创建连接令牌失败");
        return;
      }
      setNewToken({ token: result.token, label: result.label });
      setNotice("连接已创建。请现在复制令牌，之后无法再次查看。");
    });
  }

  function onRevoke(tokenId: string) {
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await revokeLearningHubToken(tokenId);
      if (result.error) setError(result.error);
      else setNotice("连接令牌已撤销");
    });
  }

  return (
    <div className="space-y-5">
      <section className="app-card rounded-[26px] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Link2 className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">V Learning Hub</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              为一个卡片盒创建独立令牌。Hub 会通过 Supabase RPC 把笔记同步成卡片，并读取这些卡片的复习进度。
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-primary/[0.045] p-4 text-sm leading-6">
          <div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" />令牌只显示一次</div>
          <p className="mt-1 text-muted-foreground">原始令牌只在创建时交给你；V-记仅保存 SHA-256 摘要。每个令牌只访问所选卡片盒，可随时撤销。</p>
        </div>

        {error || loadError ? <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error || loadError}</p> : null}
        {notice ? <p role="status" className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p> : null}

        {newToken ? (
          <div className="mt-5 rounded-2xl border border-primary/25 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{newToken.label} · 新令牌</p>
                <p className="mt-1 text-xs text-muted-foreground">请立刻复制并保存到 Hub 的本地密钥管理中。</p>
              </div>
              <Button type="button" variant="outline" className="min-h-10 rounded-full" onClick={() => void copy(newToken.token, "token")}>
                {copied === "token" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === "token" ? "已复制" : "复制令牌"}
              </Button>
            </div>
            <code className="mt-3 block select-all break-all rounded-xl bg-[#122c29] px-3 py-3 font-mono text-xs leading-5 text-white">{newToken.token}</code>
          </div>
        ) : null}

        <form onSubmit={onCreate} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium">
            卡片盒
            <select
              value={deckId}
              onChange={(event) => setDeckId(event.target.value)}
              disabled={pending || decks.length === 0}
              className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              {decks.length ? decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>) : <option value="">暂无自建卡片盒</option>}
            </select>
          </label>
          <label className="block text-sm font-medium">
            连接名称
            <Input className="mt-2 h-11 rounded-xl" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} required />
          </label>
          <Button type="submit" className="h-11 rounded-full sm:min-w-36" disabled={pending || !deckId || !supabaseUrl || !publishableKey}>
            {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus className="size-4" />}
            创建令牌
          </Button>
        </form>
      </section>

      <section className="app-card rounded-[26px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Supabase 调用配置</h2>
            <p className="mt-1 text-sm text-muted-foreground">发布密钥是可公开使用的 publishable key；Hub 只需它和上方的个人令牌。</p>
          </div>
          <Button type="button" variant="outline" className="min-h-10 rounded-full" onClick={() => void copy(config, "config")} disabled={!supabaseUrl || !publishableKey}>
            {copied === "config" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "config" ? "配置已复制" : "复制配置"}
          </Button>
        </div>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-[#122c29] p-4 font-mono text-xs leading-5 text-white"><code>{config}</code></pre>
      </section>

      <section className="app-card overflow-hidden rounded-[26px]">
        <div className="px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold">已创建的连接</h2>
          <p className="mt-1 text-sm text-muted-foreground">撤销后，旧令牌会立即失效。</p>
        </div>
        {tokens.length ? (
          <ul className="divide-y divide-border/70">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{token.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{token.deck_name} · 创建于 {formatDate(token.created_at)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{token.revoked_at ? `已撤销于 ${formatDate(token.revoked_at)}` : token.last_used_at ? `最近使用 ${formatDate(token.last_used_at)}` : "尚未使用"}</p>
                </div>
                {token.revoked_at ? (
                  <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">已撤销</span>
                ) : (
                  <Button type="button" variant="outline" className="min-h-10 rounded-full text-destructive hover:text-destructive" disabled={pending} onClick={() => onRevoke(token.id)}>
                    {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Trash2 className="size-4" />}
                    撤销
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border/70 px-5 py-7 text-center text-sm text-muted-foreground">还没有连接令牌</p>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
