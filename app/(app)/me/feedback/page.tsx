"use client";

import { useState } from "react";
import { BackLink } from "@/components/back-link";
import { useAction } from "@/lib/hooks/use-action";
import { submitFeedback } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function FeedbackPage() {
  const [content, setContent] = useState("");
  const { pending, run } = useAction();

  async function send() {
    if (!content.trim()) { toast.error("请先填写反馈内容"); return; }
    await run(() => submitFeedback(content), () => { toast.success("已提交，感谢反馈"); setContent(""); });
  }

  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <BackLink href="/me" label="我的" />
      <h1 className="app-page-title">问题与建议</h1>
      <p className="mt-2 text-sm text-muted-foreground">告诉我卡在哪、想要什么功能，或发现的问题。</p>
      <Textarea aria-label="反馈内容" maxLength={2000} disabled={pending} placeholder="请描述遇到的问题或你的建议…" className="mt-4" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
      <Button className="mt-4 h-11 rounded-full" disabled={pending || !content.trim()} onClick={send}>
        {pending ? "提交中…" : "提交"}
      </Button>
    </div>
  );
}
