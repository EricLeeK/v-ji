import { redirect } from "next/navigation";
import { Heatmap } from "@/components/stats/heatmap";
import { StatsCharts } from "@/components/stats/stats-charts";
import { countStreak, localDateKey } from "@/lib/dates";
import { buildHeatmap, sumSince } from "@/lib/heatmap";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function StatsPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const [{ data: stats }, { count: cardCount }] = await Promise.all([
    supabase.from("daily_stats").select("*").eq("owner_id", uid).order("date", { ascending: true }),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("owner_id", uid),
  ]);
  const today = localDateKey();
  const weekStartDate = new Date(`${today}T00:00:00`);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = localDateKey(weekStartDate);
  const streak = countStreak((stats ?? []).filter((row) => row.reviews > 0).map((row) => row.date), today);
  const todayRow = (stats ?? []).find((row) => row.date === today);
  const week = sumSince(stats ?? [], weekStart);
  const totalReviews = (stats ?? []).reduce((sum, row) => sum + row.reviews, 0);
  const totalMinutes = Math.round((stats ?? []).reduce((sum, row) => sum + row.study_seconds, 0) / 60);
  const points = (stats ?? []).slice(-14).map((row) => ({
    date: row.date.slice(5),
    reviews: row.reviews,
    minutes: Math.round(row.study_seconds / 60),
  }));
  const heatDays = buildHeatmap(stats ?? [], today);

  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <h1 className="app-page-title">学习统计</h1>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Card label="今日卡片" value={`${todayRow?.reviews ?? 0}`} />
        <Card label="本周复习" value={`${week.reviews}`} />
        <Card label="累计卡片" value={`${cardCount ?? 0}`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card label="连续打卡" value={`${streak} 天`} />
        <Card label="累计复习" value={`${totalReviews} 次`} />
        <Card label="学习时长" value={`${totalMinutes} 分`} />
        <Card label="本周时长" value={`${Math.round(week.seconds / 60)} 分`} />
      </div>
      <div className="mt-5 space-y-4">
        <Heatmap days={heatDays} />
        <StatsCharts points={points} />
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-card rounded-3xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
