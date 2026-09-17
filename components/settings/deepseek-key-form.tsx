"use client";

import { useState } from "react";
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

  async function save() {
    setPending(true);
    const result = await saveDeepseekApiKey(apiKey);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setCurrent({ configured: true, masked: result.masked ?? null });
    setApiKey("");
    router.refresh();
    toast.success("DeepSeek API Key 已保存");
  }

  async function clear() {
    setPending(true);
    const result = await clearDeepseekApiKey();
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setCurrent({ configured: false, masked: null });
    setApiKey("");
    router.refresh();
    toast.success("已清除 DeepSeek API Key");
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
        <Input readOnly value={DEEPSEEK_BASE_URL} />
      </Field>
      <Field label="模型">
        <Input readOnly value={DEEPSEEK_MODEL} />
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
          placeholder={current.configured ? "要更换请重新填写" : "粘贴你的 DeepSeek API Key"}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          data-testid="deepseek-key-save"
          type="button"
          className="h-11 flex-1 rounded-full"
          disabled={pending}
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
            onClick={() => void clear()}
          >
            清除
          </Button>
        ) : null}
      </div>
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
