"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, Search } from "lucide-react";

export function LibrarySearchButton() {
  return <button type="button" aria-label="搜索卡册" onClick={() => document.getElementById("library-query")?.focus()} className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-foreground/70 shadow-sm hover:bg-white"><Search className="size-5" /></button>;
}

export function LibrarySort({ sort, q, category }: { sort: string; q: string; category: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="relative shrink-0" aria-busy={pending}>
    <select aria-label="卡册排序" value={sort} disabled={pending}
      className="h-9 w-[104px] appearance-none rounded-full border border-primary/10 bg-white/80 pl-3 pr-7 text-xs text-muted-foreground shadow-sm disabled:opacity-60"
      onChange={event => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (category !== "全部") params.set("category", category);
        if (event.target.value !== "popular") params.set("sort", event.target.value);
        startTransition(() => router.replace(`/library?${params}`, { scroll: false }));
      }}>
      <option value="popular">人气最高</option><option value="recent">最新发布</option>
    </select>
    {pending ? <LoaderCircle aria-label="正在排序" className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin" /> : <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2" />}
  </div>;
}
