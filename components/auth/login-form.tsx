"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInAnonymously, signInWithPassword, signUpWithPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/today";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pending, setPending] = useState(false);

  const lock = useRef(false);
  async function attempt(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try { await action(); }
    catch { toast.error("暂时无法登录，请检查网络后重试"); }
    finally { lock.current = false; setPending(false); }
  }

  async function onSubmit(formData: FormData) {
    await attempt(async () => {
    formData.set("next", next);
    const result =
      mode === "login" ? await signInWithPassword(formData) : await signUpWithPassword(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    if (result && "needsConfirm" in result && result.needsConfirm) {
      toast.success("请到邮箱点击确认链接。开发环境也可直接用演示账号。");
    }
    });
  }

  async function guest() {
    await attempt(async () => {
    const result = await signInAnonymously();
    if (result?.error) {
      toast.error("访客登录未开启，请用演示账号：demo@huaji.local");
    }
    });
  }

  async function demo() {
    await attempt(async () => {
    const form = new FormData();
    form.set("email", "demo@huaji.local");
    form.set("password", "huaji123456");
    form.set("next", next);
    const result = await signInWithPassword(form);
    if (result?.error) toast.error(result.error);
    });
  }

  return (
    <form onSubmit={event => { event.preventDefault(); void onSubmit(new FormData(event.currentTarget)); }} className="space-y-3">
      {mode === "signup" ? (
        <Input disabled={pending} aria-label="昵称" name="nickname" placeholder="昵称" defaultValue="学习者" />
      ) : null}
      <Input disabled={pending} aria-label="邮箱" autoComplete="email" name="email" type="email" placeholder="邮箱" required />
      <Input disabled={pending} aria-label="密码" autoComplete={mode === "login" ? "current-password" : "new-password"} name="password" type="password" placeholder="密码（至少 6 位）" minLength={6} required />
      <Button type="submit" className="h-11 w-full rounded-full" disabled={pending}>
        {pending ? "正在处理…" : mode === "login" ? "登录" : "注册"}
      </Button>
      <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={demo} disabled={pending}>
        使用演示账号
      </Button>
      <Button type="button" variant="ghost" className="h-11 w-full rounded-full" onClick={guest} disabled={pending}>
        先随便看看
      </Button>
      <button
        disabled={pending}
        type="button"
        className="block w-full text-center text-sm text-muted-foreground"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "没有账号？去注册" : "已有账号？去登录"}
      </button>
      <button
        disabled={pending}
        type="button"
        className="block w-full text-center text-xs text-muted-foreground"
        onClick={() => router.push("/onboarding")}
      >
        查看产品介绍
      </button>
    </form>
  );
}
