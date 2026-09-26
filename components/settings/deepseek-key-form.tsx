"use client";

import { useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearDeepseekApiKey, saveDeepseekApiKey } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, type DeepseekKeyStatus } from "@/lib/ai/provider";

export function DeepseekKeyForm({ status }: { status: DeepseekKeyStatus }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [current, setCurrent] = useState(status);
  const [pending, setPending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const lock = useRef(false);

  async function save() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
    const result = await saveDeepseekApiKey(apiKey);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setCurrent({ configured: true, masked: result.masked ?? null });
    setApiKey("");
    router.refresh();
    toast.success("DeepSeek API Key 已保存");
    } catch { toast.error("密钥保存失败，请检查网络后重试"); }
    finally { lock.current = false; setPending(false); }
  }

  async function clear() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
    const result = await clearDeepseekApiKey();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setCurrent({ configured: false, masked: null });
    setApiKey("");
    router.refresh();
    toast.success("已清除 DeepSeek API Key");
    setConfirmClear(false);
    } catch { toast.error("清除失败，请检查网络后重试"); }
    finally { lock.current = false; setPending(false); }
  }

  return (
    <section className="space-y-3 rounded-3xl bg-white p-4">
      <div>
        <p className="text-sm font-medium">DeepSeek</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          目前只接入 DeepSeek。密钥保存在你的账号中，生成卡片时由服务器代你调用，不会用平台共用的 Key。
        </p>
      </div>
      <Field label="接口">
        <p className="break-all rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{DEEPSEEK_BASE_URL}</p>
      </Field>
      <Field label="模型">
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{DEEPSEEK_MODEL}</p>
      </Field>
      <p data-testid="deepseek-key-status" className="text-xs text-muted-foreground">
        {current.configured ? `已配置 ${current.masked}` : "尚未配置"}
      </p>
      <Field label="API Key">
        <Input
          data-testid="deepseek-key-input"
          type="password"
          autoComplete="off"
          value={apiKey}
          disabled={pending}
          aria-label="DeepSeek API Key"
          placeholder={current.configured ? "要更换请重新填写" : "粘贴你的 DeepSeek API Key"}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          data-testid="deepseek-key-save"
          type="button"
          className="h-11 flex-1 rounded-full"
          disabled={pending || !apiKey.trim()}
          onClick={() => void save()}
        >
          {pending ? "请稍候..." : "保存密钥"}
        </Button>
        {current.configured ? (
          <Button
            data-testid="deepseek-key-clear"
            type="button"
            variant="outline"
            className="h-11 rounded-full"
            disabled={pending}
            onClick={() => setConfirmClear(true)}
          >
            清除
          </Button>
        ) : null}
      </div>
      <AlertDialog open={confirmClear} onOpenChange={open => !pending && setConfirmClear(open)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>清除 DeepSeek API Key？</AlertDialogTitle><AlertDialogDescription>清除后需要重新填写密钥才能生成 AI 卡片，已有卡片会保留。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={pending}>取消</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={event => { event.preventDefault(); void clear(); }}>{pending ? "正在清除…" : "确认清除"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 text-sm">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
