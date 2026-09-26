"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { reset: () => void }) {
  return <div className="app-page flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
    <h1 className="text-xl font-semibold">暂时没能打开页面</h1>
    <p className="text-sm text-muted-foreground">请检查网络后重试，已经保存的卡片仍然保留。</p>
    <Button onClick={reset} className="rounded-full">重新加载</Button>
    <Link href="/today" className="text-sm text-primary">返回今日</Link>
  </div>;
}
