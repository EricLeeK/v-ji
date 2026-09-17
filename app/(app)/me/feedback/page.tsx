"use client";

import { useState } from "react";
import { submitFeedback } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function FeedbackPage() {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    const result = await submitFeedback(content);
    setPending(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("已提交，感谢反馈");
      setContent("");
    }
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <h1 className="text-2xl font-semibold">问题与建议</h1>
      <p className="mt-2 text-sm text-muted-foreground">告诉我卡在哪、想要什么功能，或发现的问题。</p>
      <Textarea className="mt-4" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
      <Button className="mt-4 h-11 rounded-full" disabled={pending} onClick={send}>
        提交
      </Button>
    </div>
  );
}
