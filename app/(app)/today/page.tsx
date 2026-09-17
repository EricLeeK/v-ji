import Link from "next/link";
import { redirect } from "next/navigation";
import { countStreak, formatDateLabel, greeting, localDateKey } from "@/lib/dates";
import { parseSettings } from "@/lib/settings";
import { buildTodayQueue } from "@/lib/srs/queue";
import { createClient, getUserId } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default async function TodayPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const today = localDateKey();

  const [{ data: profile }, { data: cardRows }, { data: stats }] = await Promise.all([
    supabase.from("profiles").select("nickname, settings").eq("id", uid).maybeSingle(),
    supabase
      .from("cards")
      .select("id, state, due, created_at, suspended")
      .eq("owner_id", uid)
      .eq("suspended", false),
    supabase.from("daily_stats").select("date, reviews, new_cards").eq("owner_id", uid).order("date", { ascending: false }).limit(120),
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
  const doneToday = todayNew + todayReviews;
  const todayProgress = Math.min(
    100,
    (doneToday / Math.max(doneToday + summary.queue.length, 1)) * 100,
  );

  return (
    <div className="flex flex-1 flex-col bg-[linear-gradient(180deg,#d5efe8_0%,#f7f8f7_38%)]">
      <header className="px-5 pt-6 pb-2">
        <p className="text-xs text-muted-foreground">{formatDateLabel()}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {greeting()}，{profile?.nickname ?? "同学"}
        </h1>
      </header>

      <section className="px-5 pt-4">
        <div className="rounded-[28px] bg-white p-5 shadow-[0_12px_40px_rgba(30,80,60,0.08)]">
          {summary.queue.length === 0 ? (
            <div>
              <p className="text-lg font-semibold">今日任务完成</p>
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
              <p className="text-sm text-muted-foreground">今天还有</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">
                {summary.queue.length}
                <span className="ml-1 text-base font-medium text-muted-foreground">张卡片要复习</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="复习" value={summary.reviews.length} />
                <Stat label="新卡" value={summary.news.length} />
                <Stat label="约" value={`${Math.max(1, Math.ceil(summary.queue.length * 0.3))} 分`} />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${todayProgress}%` }}
                />
              </div>
              <Button asChild className="mt-5 h-12 w-full rounded-full text-base active:scale-[0.98]">
                <Link href="/study">开始学习</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-5 py-5">
        <Link href="/me/stats" className="rounded-3xl bg-white p-4">
          <p className="text-xs text-muted-foreground">连续打卡</p>
          <p className="mt-2 text-2xl font-semibold">{streak} 天</p>
        </Link>
        <Link href="/decks" className="rounded-3xl bg-white p-4">
          <p className="text-xs text-muted-foreground">学习目标</p>
          <p className="mt-2 text-2xl font-semibold">{settings.newCardsPerDay} 新卡</p>
        </Link>
      </section>

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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-muted/70 py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
