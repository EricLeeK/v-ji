"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createAiJob } from "@/app/actions/ai";
import { SourceInput, type PendingSource } from "@/components/ai/source-input";
import { SourceList } from "@/components/ai/source-list";
import { GenerateSettingsSheet } from "@/components/ai/generate-settings-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MISSING_DEEPSEEK_KEY } from "@/lib/ai/provider";
import { DEFAULT_AI_SETTINGS, type AiGenerateSettings } from "@/lib/ai/schemas";
import { createClient } from "@/lib/supabase/client";

export function AiNewForm({
  decks,
  initialDeckId,
  configured,
}: {
  decks: Array<{ id: string; name: string }>;
  initialDeckId?: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<PendingSource[]>([]);
  const [instruction, setInstruction] = useState(
    "根据这些资料生成考试复习卡，重点整理概念和易混点，优先使用问答与挖空。",
  );
  const [settings, setSettings] = useState<AiGenerateSettings>(DEFAULT_AI_SETTINGS);
  const [deckId, setDeckId] = useState<string | undefined>(initialDeckId);
  const [newDeckName, setNewDeckName] = useState("AI 制卡");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!configured) {
      toast.error(MISSING_DEEPSEEK_KEY);
      return;
    }
    if (!sources.length) {
      toast.error("请先放入资料");
      return;
    }
    setPending(true);
    try {
      const prepared = await Promise.all(sources.map((source) => prepareSource(source)));
      const result = await createAiJob({
        deckId,
        newDeckName: deckId ? undefined : newDeckName,
        instruction,
        settings,
        sources: prepared.map((source) => ({
          kind: source.kind,
          name: source.name,
          mime: source.mime,
          sizeBytes: source.sizeBytes,
          storagePath: source.storagePath,
          text: source.text,
          pageRange: source.pageRange,
        })),
      });
      if (result.error || !result.id) {
        toast.error(result.error ?? "无法开始生成");
        return;
      }
      router.push(`/ai/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      {configured ? null : (
        <div
          data-testid="ai-missing-key"
          className="rounded-3xl bg-white p-4 text-sm leading-6 text-muted-foreground"
        >
          {MISSING_DEEPSEEK_KEY}。
          <Link href="/me/settings" className="ml-1 text-primary">
            去设置
          </Link>
        </div>
      )}
      <SourceInput onAdd={(items) => setSources((current) => [...current, ...items])} />
      <SourceList
        sources={sources}
        onRemove={(id) => setSources((current) => current.filter((item) => item.id !== id))}
        onChangeRange={(id, pageRange) =>
          setSources((current) => current.map((item) => (item.id === id ? { ...item, pageRange } : item)))
        }
      />
      <Textarea
        data-testid="ai-instruction"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        rows={3}
        placeholder="补充要求，例如：不超过 30 张"
      />
      <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="mr-1 size-4" />
        生成设置
      </Button>
      <Button
        data-testid="ai-generate"
        type="button"
        className="h-11 w-full rounded-full"
        disabled={pending}
        onClick={() => void submit()}
      >
        {pending ? "开始中..." : "开始生成"}
      </Button>
      <GenerateSettingsSheet
        open={open}
        onOpenChange={setOpen}
        settings={settings}
        onChange={setSettings}
        decks={decks}
        deckId={deckId}
        newDeckName={newDeckName}
        onDeckId={setDeckId}
        onNewDeckName={setNewDeckName}
      />
    </div>
  );
}

async function prepareSource(source: PendingSource): Promise<PendingSource> {
  if (source.kind === "text") {
    if (source.text) return source;
    if (source.file) {
      const text = await source.file.text();
      return { ...source, text, file: undefined };
    }
    return source;
  }
  if (!source.file || source.storagePath) return source;
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid || typeof uid !== "string") throw new Error("请先登录");
  const ext = source.file.name.split(".").pop() || (source.kind === "pdf" ? "pdf" : "jpg");
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("ai-sources").upload(path, source.file, {
    upsert: false,
    contentType: source.file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return { ...source, storagePath: path, file: undefined };
}
