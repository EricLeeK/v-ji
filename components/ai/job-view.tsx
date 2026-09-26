"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAiJob, importAiCards, retryAiJob, setAiCardStatus, updateAiCard } from "@/app/actions/ai";
import { JobProgress } from "@/components/ai/job-progress";
import { DraftCard } from "@/components/ai/draft-card";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { MISSING_DEEPSEEK_KEY } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/client";
import type { Json, NoteType, Tables } from "@/types/database";

type JobPayload = {
  job: Tables<"ai_jobs">;
  cards: Tables<"ai_cards">[];
  sources: Tables<"ai_sources">[];
};

export function AiJobView({ initial }: { initial: JobPayload }) {
  const router = useRouter();
  const [job, setJob] = useState(initial.job);
  const [cards, setCards] = useState(initial.cards);
  const [selected, setSelected] = useState<string[]>(
    initial.cards.filter((card) => card.status !== "rejected").map((card) => card.id),
  );
  const [images, setImages] = useState<Record<string, string>>({});
  const { pending: importing, run: importCards } = useAction();
  const { pending: retrying, run: retry } = useAction();
  const [pollError, setPollError] = useState(false);
  const busy = ["queued", "reading", "organizing", "generating", "checking"].includes(job.status);

  useEffect(() => {
    if (!busy) return;
    let disposed = false, fetching = false;
    const timer = setInterval(async () => {
      if (fetching) return;
      fetching = true;
      try {
        const result = await getAiJob(job.id);
        if (disposed) return;
        if (!result.job) { setPollError(true); return; }
        setPollError(false);
        setJob(result.job);
        setCards(result.cards);
        setSelected(current => {
          const known = new Set(cards.map(card => card.id));
          const ids = new Set(result.cards.filter(card => card.status !== "rejected").map(card => card.id));
          return [...current.filter(id => ids.has(id)), ...[...ids].filter(id => !known.has(id))];
        });
      } catch { if (!disposed) setPollError(true); }
      finally { fetching = false; }
    }, 2000);
    return () => { disposed = true; clearInterval(timer); };
  }, [busy, job.id, cards]);

  useEffect(() => {
    const paths = cards.flatMap((card) => citations(card.sources).map((item) => item.imagePath).filter(Boolean)) as string[];
    if (!paths.length) return;
    const supabase = createClient();
    void Promise.all(
      [...new Set(paths)].map(async (path) => {
        const { data } = await supabase.storage.from("ai-sources").createSignedUrl(path, 3600);
        return [path, data?.signedUrl ?? ""] as const;
      }),
    ).then((entries) => setImages(Object.fromEntries(entries.filter(([, url]) => url)))).catch(() => toast.error("部分来源图片暂时无法加载"));
  }, [cards]);

  const visible = useMemo(
    () => cards.filter((card) => card.status !== "rejected"),
    [cards],
  );
  const importable = visible.filter((card) => card.status !== "imported" && selected.includes(card.id));
  const stage = asRecord(job.stage);

  return (
    <div className="space-y-5 pb-24">
      <JobProgress status={job.status} detail={String(stage.detail ?? job.error ?? "")} progress={Number(stage.progress ?? 0)} />
      {pollError ? <p role="status" className="rounded-xl bg-muted p-3 text-sm">连接暂时中断，正在重新获取生成进度…</p> : null}
      {job.status === "failed" ? (
        <div className="space-y-2">
          {job.error === MISSING_DEEPSEEK_KEY ? (
            <Button asChild className="w-full rounded-full">
              <Link href="/me/settings">去设置填写 API Key</Link>
            </Button>
          ) : null}
          <Button
            className="w-full rounded-full"
            variant={job.error === MISSING_DEEPSEEK_KEY ? "outline" : "default"}
            disabled={retrying}
            onClick={() => void retry(() => retryAiJob(job.id), () => {
              setJob(current => ({ ...current, status: "queued", error: null, stage: { progress: 0, detail: "正在重新生成" } }));
              toast.success("已开始重试");
            })}
          >
            {retrying ? "正在重试…" : "重试失败部分"}
          </Button>
        </div>
      ) : null}
      {visible.map((card) => (
        <DraftCard
          key={card.id}
          card={card}
          selected={selected.includes(card.id)}
          sourceImageUrl={firstImage(card.sources, images)}
          onSelect={(value) =>
            setSelected((current) => (value ? [...current, card.id] : current.filter((id) => id !== card.id)))
          }
          onReject={async () => {
            const result = await setAiCardStatus(card.id, "rejected");
            if (result.error) throw new Error(result.error);
            setCards((current) => current.map((item) => (item.id === card.id ? { ...item, status: "rejected" } : item)));
          }}
          onSave={async (patch) => {
            const result = await updateAiCard(card.id, {
              type: patch.type,
              fields: patch.fields,
              layout: patch.layout,
            });
            if (result.error) throw new Error(result.error);
            setCards((current) =>
              current.map((item) =>
                item.id === card.id
                  ? { ...item, type: patch.type as NoteType, fields: patch.fields, layout: patch.layout, edited: true }
                  : item,
              ),
            );
          }}
        />
      ))}
      {job.status === "ready" || job.status === "imported" ? (
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto w-full max-w-[430px] border-t border-border bg-background p-4">
          <Button
            data-testid="ai-import"
            className="h-11 w-full rounded-full"
            disabled={!importable.length || importing}
            onClick={() => void importCards(() => importAiCards(job.id, importable.map(card => card.id)), result => {
              if (!result.deckId) { toast.error("导入失败，请重试"); return; }
              toast.success("已加入卡片盒");
              router.push(`/decks/${result.deckId}`);
              router.refresh();
            })}
          >
            {importing ? "导入中..." : `导入 ${importable.length} 张`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function citations(sources: Json) {
  return Array.isArray(sources) ? (sources as Array<{ imagePath?: string }>) : [];
}

function firstImage(sources: Json, images: Record<string, string>) {
  const path = citations(sources).find((item) => item.imagePath)?.imagePath;
  return path ? images[path] : undefined;
}

function asRecord(value: Json | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
