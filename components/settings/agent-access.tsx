"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { createApiToken, revokeApiToken } from "@/app/actions/api-tokens";
import type { ApiTokenSummary } from "@/lib/agent/api-tokens";
import {
  connectionConfig,
  firstCardPrompt,
  probeConnection,
  type OnboardingDeck,
} from "@/lib/agent/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AgentAccess({
  origin,
  tokens,
  decks,
  error,
}: {
  origin: string;
  tokens: ApiTokenSummary[];
  decks: OnboardingDeck[];
  error: string | null;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [name, setName] = useState("我的学习助手");
  const [secret, setSecret] = useState<{ token: string; id: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [copied, setCopied] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const deck = decks.find((d) => d.id === deckId);
  const config = connectionConfig(origin, secret?.token ?? "<个人访问令牌>");
  const prompt = firstCardPrompt(deck);
  const endpoint = origin.replace(/\/$/, "") + "/api/mcp";
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
      if (!result.token || !result.id) {
        toast.error("连接未能创建，请重试。");
        return;
      }
      setSecret({ token: result.token, id: result.id });
      setTestMessage(null);
      setShowConfig(false);
      router.refresh();
      toast.success("连接已创建，下一步复制配置");
    } catch {
      toast.error("连接未能创建，请检查网络后重试。");
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
      if (secret?.id === id) {
        setSecret(null);
        setTestMessage(null);
        setShowConfig(false);
        setCopied("");
      }
      setConfirmId(null);
      router.refresh();
      toast.success("连接已撤销，该令牌立即失效");
    } catch {
      toast.error("撤销失败，请检查网络后重试。");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success("已复制");
    } catch {
      setShowConfig(true);
      toast.error("未能访问剪贴板，请展开内容后手动复制。");
    }
  }
  async function testConnection() {
    if (!secret || testing) return;
    setTesting(true);
    setTestMessage(null);
    try {
      await probeConnection(secret.token);
      setTestMessage({
        ok: true,
        text: "令牌和接口验证通过。将配置加入 Agent 后，请让它执行下方的首次使用指令。",
      });
      router.refresh();
    } catch (e) {
      setTestMessage({
        ok: false,
        text:
          e instanceof Error ? e.message : "连接测试失败，请检查网络后重试。",
      });
    } finally {
      setTesting(false);
    }
  }
  const copyLabel = (key: string, label: string) => (
    <>
      {copied === key ? (
        <Check className="size-4" />
      ) : (
        <Copy className="size-4" />
      )}
      {copied === key ? "已复制" : label}
    </>
  );
  return (
    <div className="space-y-7">
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => router.refresh()}
          >
            刷新页面
          </Button>
        </div>
      )}
      <section
        aria-labelledby="connection-title"
        className="app-card rounded-2xl p-5"
      >
        <h2 id="connection-title" className="text-base font-semibold">
          1. 创建个人连接
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          每个 Agent
          使用一个令牌，可读取和修改你账号内的所有卡片盒；不能访问其他用户的内容，也不能替你提交复习评分。
        </p>
        <label className="mt-5 block text-sm font-medium" htmlFor="agent-name">
          给这个连接起个名字
        </label>
        <Input
          id="agent-name"
          className="mt-2 min-h-11"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：我的学习助手"
          disabled={pending}
        />
        <Button
          className="mt-4 min-h-11 w-full"
          disabled={pending || !!error || !name.trim() || !!secret}
          onClick={() => void create()}
        >
          {pending ? "正在处理…" : secret ? "本次连接已创建" : "创建连接"}
        </Button>
        {secret && (
          <p
            role="status"
            className="mt-3 text-sm leading-6 text-muted-foreground"
          >
            请先复制下方配置。离开或刷新页面后，无法再次查看令牌原文。
          </p>
        )}
      </section>
      <section aria-labelledby="configuration-title" className="space-y-3">
        <h2 id="configuration-title" className="text-base font-semibold">
          2. 添加到你的 Agent
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          在客户端的“工具 / MCP / 自定义服务器”中添加连接。支持 URL
          和认证请求头的客户端可使用下面配置。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            disabled={!secret}
            onClick={() => void copy(config, "config")}
          >
            {copyLabel("config", "复制完整 MCP 配置")}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void copy(endpoint, "url")}
          >
            {copyLabel("url", "复制服务地址")}
          </Button>
          {secret && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void copy(secret.token, "token")}
            >
              {copyLabel("token", "单独复制令牌")}
            </Button>
          )}
        </div>
        <button
          type="button"
          className="min-h-11 text-sm underline underline-offset-4"
          aria-expanded={showConfig}
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? "收起配置" : "查看配置与手动填写方式"}
        </button>
        {showConfig && (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              地址填 {endpoint}；认证请求头名称填 Authorization，值填 Bearer
              加一个空格和你的令牌。配置含私有令牌，请只粘贴到你信任的客户端设置。
            </p>
            <pre
              tabIndex={0}
              aria-label="MCP 配置"
              className="max-w-full overflow-x-auto rounded-2xl bg-foreground p-4 text-xs leading-6 text-background"
            >
              {config}
            </pre>
          </div>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          当前使用个人令牌，不支持 OAuth
          网页登录授权。只支持网页登录的客户端暂时无法接入；不同客户端的配置格式可能不同。
        </p>
        {secret && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={testing || pending}
              onClick={() => void testConnection()}
            >
              <RefreshCw
                className={
                  testing
                    ? "size-4 animate-spin motion-reduce:animate-none"
                    : "size-4"
                }
              />
              {testing ? "正在验证…" : "测试令牌与接口"}
            </Button>
            {testMessage && (
              <p
                role={testMessage.ok ? "status" : "alert"}
                className={`mt-3 text-sm leading-6 ${testMessage.ok ? "text-foreground" : "text-destructive"}`}
              >
                {testMessage.text}
              </p>
            )}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              此测试只读取卡片盒，不创建卡片；测试通过不代表外部 Agent
              已配置成功。
            </p>
          </div>
        )}
      </section>
      <section
        aria-labelledby="first-card-title"
        className="space-y-3 border-t pt-6"
      >
        <h2 id="first-card-title" className="text-base font-semibold">
          3. 让 Agent 帮你做第一组卡片
        </h2>
        {decks.length ? (
          <>
            <label htmlFor="agent-deck" className="block text-sm font-medium">
              本次保存到
            </label>
            <select
              id="agent-deck"
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              value={deckId}
              onChange={(e) => {
                setDeckId(e.target.value);
                setCopied("");
              }}
            >
              {decks.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted-foreground">
              选择只用于生成下面的指令，不会限制令牌的访问范围。
            </p>
          </>
        ) : (
          <div className="text-sm leading-6">
            <p>还没有卡片盒。先创建一个，用来接收 Agent 整理好的卡片。</p>
            <Link
              className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
              href="/decks"
            >
              去创建卡片盒
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        )}
        <p className="text-sm leading-6 text-muted-foreground">
          复制指令发给
          Agent，并替换末尾的学习材料。它会先展示卡片，等你确认后再保存。
        </p>
        <textarea
          aria-label="首次使用指令"
          readOnly
          value={prompt}
          className="min-h-52 w-full resize-y rounded-2xl border border-input bg-card p-4 text-sm leading-6"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void copy(prompt, "prompt")}
          >
            {copyLabel("prompt", "复制首次使用指令")}
          </Button>
          {deck && (
            <Link
              href={`/decks/${deck.id}`}
              className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
            >
              打开卡片盒
              <ArrowUpRight className="size-4" />
            </Link>
          )}
        </div>
      </section>
      <section aria-labelledby="connections-title" className="border-t pt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="connections-title" className="text-base font-semibold">
            我的连接
          </h2>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-4" />
            刷新记录
          </Button>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          最近调用也包含页面中的接口测试，不代表 Agent
          正在运行。每个账号最多保留 10 个有效令牌。
        </p>
        <ul className="mt-3 divide-y">
          {tokens.length ? (
            tokens.map((t) => (
              <li key={t.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{t.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t.prefix}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t.lastUsedAt
                        ? `最近调用：${new Date(t.lastUsedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）`
                        : "尚无调用记录"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-11 shrink-0"
                    disabled={pending || testing}
                    onClick={() =>
                      confirmId === t.id
                        ? void revoke(t.id)
                        : setConfirmId(t.id)
                    }
                  >
                    {confirmId === t.id ? "确认撤销" : "撤销"}
                  </Button>
                </div>
                {confirmId === t.id && (
                  <div className="mt-2 text-sm leading-6">
                    <span>撤销后，使用此令牌的 Agent 将无法再访问。</span>
                    <button
                      className="ml-2 min-h-11 underline"
                      type="button"
                      onClick={() => setConfirmId(null)}
                    >
                      取消
                    </button>
                  </div>
                )}
              </li>
            ))
          ) : (
            <li className="py-4 text-sm text-muted-foreground">
              创建连接后，可在这里查看调用记录或撤销访问。
            </li>
          )}
        </ul>
        {secret && (
          <Button
            variant="ghost"
            className="mt-2 min-h-11"
            onClick={() => {
              setSecret(null);
              setShowConfig(false);
              setCopied("");
              setTestMessage(null);
            }}
          >
            已保存配置，隐藏令牌并准备新连接
          </Button>
        )}
      </section>
    </div>
  );
}
