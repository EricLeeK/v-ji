"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { DeckList, type DeckItem } from "@/components/decks/deck-list";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { deckMatchesFilter, DECK_FILTERS, MASTERED_STABILITY_DAYS, type DeckFilter } from "@/lib/deck-summary";

export function DeckBrowser({ items }: { items: DeckItem[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status") ?? "all";
  const status: DeckFilter = DECK_FILTERS.some(item => item.value === rawStatus) ? rawStatus as DeckFilter : "all";
  const deferredQuery = useDeferredValue(q);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const visibleItems = items.filter(deck =>
    (!normalizedQuery || deck.name.toLocaleLowerCase().includes(normalizedQuery)) && deckMatchesFilter(deck, status));
  function updateQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value); else params.delete("q");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/decks?${query}` : "/decks");
  }

  const filterHref = (nextStatus: DeckFilter) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nextStatus !== "all") params.set("status", nextStatus);
    const query = params.toString();
    return query ? `/decks?${query}` : "/decks";
  };

  return (
    <div className="app-page flex flex-1 flex-col px-4 pt-7 pb-20 min-[400px]:px-5">
      <header className="mb-1 flex items-start justify-between gap-3">
        <h1 className="app-page-title">卡片盒</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/ai/new" data-tone="lilac" className="tone-icon flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--tone-border)] px-3.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/30 hover:bg-white">
            <Sparkles className="size-3.5" />
            AI 制卡
          </Link>
          <Link
            href="/decks/new"
            aria-label="新建卡片盒"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(42,168,154,0.26)] transition-transform hover:brightness-105 active:scale-95"
          >
            <Plus className="size-4" />
          </Link>
        </div>
      </header>
      <p className="mb-5 text-[0.8125rem] leading-5 text-muted-foreground">把正在学习的内容收进一个清晰的空间</p>

      <form action="/decks" method="get" onSubmit={(event) => event.preventDefault()} className="relative">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70" />
        <Input
          name="q"
          value={q}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="搜索卡片盒"
          aria-label="搜索卡片盒"
          className="h-12 rounded-2xl border-primary/15 bg-white/75 pl-11 pr-4 text-[15px] shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/40 focus-visible:ring-primary/20"
        />
      </form>

      <nav aria-label="卡片盒筛选" className="mt-4 grid grid-cols-5 gap-1 rounded-2xl bg-muted/55 p-1">
        {DECK_FILTERS.map((item) => (
          <Link
            key={item.value}
            href={filterHref(item.value)}
            prefetch={false}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              window.history.pushState(null, "", filterHref(item.value));
            }}
            aria-current={status === item.value ? "page" : undefined}
            title={item.value === "mastered" ? `已掌握：每张卡片稳定性达到 ${MASTERED_STABILITY_DAYS} 天` : undefined}
            className={`flex min-h-9 min-w-0 items-center justify-center rounded-xl px-1 py-1 text-[0.8125rem] transition-colors ${
              status === item.value
                ? "bg-white font-medium text-primary shadow-sm"
                : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-[11px] text-muted-foreground/80">
        已掌握按每张卡片稳定性达到 {MASTERED_STABILITY_DAYS} 天计算
      </p>

      <div className="mb-2 mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>{status === "favorites" ? "收藏的卡片盒" : "我的卡片盒"}</span>
        <span>{visibleItems.length} 个</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="还没有卡片盒"
          description="新建一个科目卡片盒，或从社区加入现成卡册。"
          actionHref="/decks/new"
          actionLabel="新建卡片盒"
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={status === "favorites" ? "还没有收藏的卡片盒" : "没有找到匹配的卡片盒"}
          description={status === "favorites" ? "在卡片盒详情中收藏常用内容，稍后更快找到它。" : "换个关键词或筛选条件试试。"}
          actionHref="/decks"
          actionLabel="查看全部"
        />
      ) : (
        <DeckList decks={visibleItems} />
      )}
    </div>
  );
}
