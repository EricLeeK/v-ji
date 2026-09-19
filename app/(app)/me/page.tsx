import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, Crown, Flag, HelpCircle, LineChart, Settings } from "lucide-react";
import { getProfile } from "@/lib/data";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient, getUserId } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/dates";

export default async function MePage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const profile = await getProfile();
  const supabase = await createClient();
  const today = localDateKey();
  const { data: todayStats } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("owner_id", uid)
    .eq("date", today)
    .maybeSingle();

  const items = [
    { href: "/me/stats", label: "学习统计", icon: LineChart },
    { href: "/me/settings", label: "设置", icon: Settings },
    { href: "/me/feedback", label: "问题与建议", icon: Flag },
    { href: "/onboarding", label: "使用指北", icon: HelpCircle },
  ];

  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <div className="app-card relative overflow-hidden rounded-[30px] p-5">
        <div className="pointer-events-none absolute -right-5 bottom-0 size-36 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xl font-semibold text-primary ring-8 ring-primary/5">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : (profile?.nickname ?? "学").slice(0, 1)}
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.03em]">{profile?.nickname ?? "学习者"}</h1>
              <p className="mt-1 text-xs text-muted-foreground">ID {uid.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex gap-2"><button type="button" aria-label="通知" className="flex size-9 items-center justify-center rounded-full bg-white/80 text-muted-foreground shadow-sm"><Bell className="size-4" /></button><Link href="/me/settings" aria-label="设置" className="flex size-9 items-center justify-center rounded-full bg-white/80 text-muted-foreground shadow-sm"><Settings className="size-4" /></Link></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="app-stat rounded-2xl py-3">
            <div className="text-lg font-semibold">{todayStats?.reviews ?? 0}</div>
            <div className="text-[11px] text-muted-foreground">今日复习</div>
          </div>
          <div className="app-stat rounded-2xl py-3">
            <div className="text-lg font-semibold">{Math.round((todayStats?.study_seconds ?? 0) / 60)}</div>
            <div className="text-[11px] text-muted-foreground">今日分钟</div>
          </div>
        </div>
      </div>

      <Link href="/me/settings" className="mt-4 flex items-center gap-3 rounded-[24px] bg-[#164c45] px-5 py-4 text-white shadow-[0_14px_30px_rgba(22,76,69,0.2)] transition-transform active:scale-[0.99]">
        <span className="flex size-10 items-center justify-center rounded-full bg-amber-200/20 text-amber-200"><Crown className="size-6 fill-current" /></span>
        <span className="min-w-0 flex-1"><span className="block text-base font-semibold">卡片会员</span><span className="mt-0.5 block text-xs text-white/65">解锁更多功能，助力高效学习</span></span>
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-sm font-medium">去开通 <ChevronRight className="size-4" /></span>
      </Link>

      <ul className="app-card mt-4 overflow-hidden rounded-[26px]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href} className="border-b border-border/70 last:border-b-0">
              <Link href={item.href} className="flex min-h-14 items-center gap-3 px-4 transition-colors hover:bg-primary/[0.04] active:bg-primary/[0.08]">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-4 text-primary" />
                </span>
                <span className="flex-1 text-sm">{item.label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
