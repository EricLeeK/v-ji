import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Check, ChevronRight, Flame, Play, Target } from "lucide-react";
import { countStreak, formatDateLabel, greeting, localDateKey } from "@/lib/dates";
import { deckTone } from "@/lib/deck-tone";
import { parseSettings } from "@/lib/settings";
import { buildTodayQueue } from "@/lib/srs/queue";
import { createClient, getUserId } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DeckIcon } from "@/components/app-icon";
import { ProfileAvatar } from "@/components/profile/profile-avatar";

export default async function TodayPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const today = localDateKey();

  const [{ data: profile }, { data: cardRows }, { data: stats }, { data: decks }] = await Promise.all([
    supabase.from("profiles").select("nickname, avatar_url, settings").eq("id", uid).maybeSingle(),
    supabase
      .from("cards")
      .select("id, state, due, created_at, suspended, deck_id")
      .eq("owner_id", uid)
      .eq("suspended", false),
    supabase.from("daily_stats").select("date, reviews, new_cards").eq("owner_id", uid).order("date", { ascending: false }).limit(120),
    supabase.from("decks").select("id, name, icon, created_at").eq("owner_id", uid).order("created_at", { ascending: false }).limit(3),
  ]);

  const settings = parseSettings(profile?.settings);
  const todayNew = stats?.find((row) => row.date === today)?.new_cards ?? 0;
  const todayReviews = stats?.find((row) => row.date === today)?.reviews ?? 0;
  const remainingNew = Math.max(0, settings.newCardsPerDay - todayNew);
  const summary = buildTodayQueue(cardRows ?? [], remainingNew);
  const streak = countStreak(
    (stats ?? []).filter((row) => row.reviews > 0).map((row) => row.date),
    today,
  );
  // reviews already includes first-time reviews of new cards.
  const doneToday = todayReviews;
  const todayProgress = Math.min(
    100,
    (doneToday / Math.max(doneToday + summary.queue.length, 1)) * 100,
  );
  const goalPercent = Math.min(100, Math.round((todayNew / Math.max(settings.newCardsPerDay, 1)) * 100));
  const activeDates = new Set((stats ?? []).filter(row => row.reviews > 0).map(row => row.date));
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - 6 + index);
    const key = localDateKey(date);
    return { key, label: "日一二三四五六"[date.getDay()], studied: activeDates.has(key) };
  });
  const queuedIds = new Set(summary.queue.map(card => card.id));
  const deckRows = (decks ?? []).map((deck) => {
    const cards = (cardRows ?? []).filter(card => card.deck_id === deck.id);
    const queued = cards.filter(card => queuedIds.has(card.id));
    return { ...deck, count: cards.length, due: queued.length, newCount: queued.filter(card => card.state === 0).length };
  });
  const planRows = deckRows.filter(deck => deck.due > 0).slice(0, 2);

  return (
    <div className="app-page flex flex-1 flex-col pb-28">
      <header className="flex items-start justify-between gap-3 px-5 pt-7 pb-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{formatDateLabel()}</p>
          <h1 className="app-page-title mt-1">
            {greeting()}，{profile?.nickname ?? "同学"}
          </h1>
        </div>
        <Link href="/me" aria-label="查看个人资料" className="mt-1 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-primary/10 text-lg font-semibold text-primary shadow-[0_8px_20px_rgba(30,80,60,0.12)] transition-transform active:scale-95">
          <ProfileAvatar src={profile?.avatar_url} nickname={profile?.nickname ?? "学"} />
        </Link>
      </header>

      <section className="px-5 pt-4">
        <div className="app-card rounded-[30px] p-5 shadow-[0_18px_44px_rgba(30,80,60,0.1)]">
          {summary.queue.length === 0 ? (
            <div>
              <p className="text-lg font-semibold">{todayReviews > 0 ? "今日任务完成" : "今日暂无待学任务"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                可以去社区加一本卡册，或继续复习某个卡片盒。
              </p>
              <div className="mt-5 flex gap-2">
                <Button asChild className="flex-1 rounded-full">
                  <Link href="/library">去社区看看</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 rounded-full">
                  <Link href="/decks">管理卡片</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">今日学习</p>
                <Link href="/me/stats" className="flex items-center gap-1 rounded-full bg-primary/8 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" /> 学习日历
                </Link>
              </div>
              <p className="mt-1 text-4xl font-semibold tracking-tight">
                {summary.queue.length}
                <span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">张卡片待学习</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="复习" value={summary.reviews.length} tone="sky" />
                <Stat label="新卡" value={summary.news.length} tone="mint" />
                <Stat label="约" value={`${Math.max(1, Math.ceil(summary.queue.length * 0.3))} 分`} tone="apricot" />
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(42,168,154,0.38)]"
                  style={{ width: `${todayProgress}%` }}
                />
              </div>
              <div className="mt-5 flex gap-3">
                <Button asChild className="h-12 flex-1 rounded-full text-base active:scale-[0.98]"><Link href="/study" prefetch={true}>开始学习</Link></Button>
                <Link href="/study" prefetch={true} aria-label="直接开始学习" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15 active:scale-95"><Play className="ml-0.5 size-5 fill-current" /></Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-5 py-5">
        <Link href="/me/stats" data-tone="apricot" className="app-card app-card-interactive tinted-stat rounded-[26px] p-4 active:scale-[0.98]">
          <div className="flex items-center justify-between gap-1"><p className="text-xs font-medium">连续打卡</p><Flame className="size-4 shrink-0" /></div>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{streak} 天</p>
          <p className="mt-1 text-xs">最近 7 天</p>
          <div className="mt-3 grid grid-cols-7 gap-1" role="list" aria-label="最近七天打卡记录">
            {recentDays.map(day => <span key={day.key} role="listitem" aria-label={`${day.key} ${day.studied ? "已学习" : "未学习"}`} title={`${day.key} ${day.studied ? "已学习" : "未学习"}`} className="flex min-w-0 flex-col items-center gap-1">
              <span className={`flex size-3.5 items-center justify-center rounded-full ${day.studied ? "bg-[var(--tone-ink)] text-[var(--tone-surface)]" : "border border-[var(--tone-border)]"}`}>
                {day.studied ? <Check aria-hidden="true" className="size-2.5" strokeWidth={3} /> : null}
              </span>
              <span aria-hidden="true" className="text-[9px]">{day.label}</span>
            </span>)}
          </div>
        </Link>
        <Link href="/me/settings#plan" data-tone="sky" className="app-card app-card-interactive tinted-stat rounded-[26px] p-4 active:scale-[0.98]">
          <div className="flex items-center justify-between gap-1"><p className="text-xs font-medium">今日新卡目标</p><Target className="size-4 shrink-0" /></div>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{settings.newCardsPerDay} <span className="text-[0.8125rem] font-medium">张</span></p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.6875rem]">已学 {todayNew} 张</p>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--tone-ink) ${goalPercent * 3.6}deg, var(--tone-border) 0deg)` }}>
              <div className="flex size-8 items-center justify-center rounded-full bg-[var(--tone-surface)] text-[0.6875rem] font-medium">{goalPercent}%</div>
            </div>
          </div>
        </Link>
      </section>

      {deckRows.length > 0 ? <section className="px-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold tracking-tight">近期卡盒</h2><Link href="/decks" className="flex items-center gap-1 text-xs text-muted-foreground">查看全部 <ChevronRight className="size-3.5" /></Link></div>
        <div className="grid grid-cols-2 gap-2.5">
          {deckRows.map(deck => <Link key={deck.id} href={`/decks/${deck.id}`} data-tone={deckTone(deck.id)} className="app-card app-card-interactive deck-tile min-w-0 rounded-[22px] p-3 active:scale-[0.98]">
            <span className="tone-icon flex size-9 items-center justify-center rounded-xl"><DeckIcon name={deck.icon} className="size-5" /></span>
            <p className="mt-3 text-[0.8125rem] font-medium leading-5 text-balance [overflow-wrap:anywhere]">{deck.name}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{deck.count} 张卡片</p>
          </Link>)}
        </div>
      </section> : null}

      {planRows.length > 0 ? <section className="px-5 pt-5">
        <div className="app-card rounded-[26px] p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold tracking-tight">待学卡片盒</h2><Link href="/decks" className="flex items-center gap-1 text-xs text-muted-foreground">查看全部 <ChevronRight className="size-3.5" /></Link></div>
          <div className="space-y-3">{planRows.map(item => <Link key={item.id} href={`/study?deckId=${item.id}`} data-tone={deckTone(item.id)} className="flex items-center gap-3 text-[0.8125rem] leading-5">
            <span className="tone-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><DeckIcon name={item.icon} className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block [overflow-wrap:anywhere]">{item.name}</span><span className="block text-[0.6875rem] text-muted-foreground">新卡 {item.newCount} 张 · 复习 {item.due - item.newCount} 张</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>)}</div>
        </div>
      </section> : null}

      {(cardRows ?? []).length === 0 ? (
        <EmptyState
          title="还没有卡片"
          description="从社区加入一本卡册，或自己新建卡片盒开始制卡。"
          actionHref="/library"
          actionLabel="浏览社区卡册"
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div data-tone={tone} className="tinted-stat rounded-2xl py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px]">{label}</div>
    </div>
  );
}
