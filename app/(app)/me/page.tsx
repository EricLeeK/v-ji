import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Flag, HelpCircle, LineChart, Settings } from "lucide-react";
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
    <div className="flex flex-1 flex-col px-5 pt-6">
      <div className="rounded-[28px] bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
            {(profile?.nickname ?? "学").slice(0, 1)}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{profile?.nickname ?? "学习者"}</h1>
            <p className="text-xs text-muted-foreground">ID {uid.slice(0, 8)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-muted/70 py-3">
            <div className="text-lg font-semibold">{todayStats?.reviews ?? 0}</div>
            <div className="text-[11px] text-muted-foreground">今日复习</div>
          </div>
          <div className="rounded-2xl bg-muted/70 py-3">
            <div className="text-lg font-semibold">{Math.round((todayStats?.study_seconds ?? 0) / 60)}</div>
            <div className="text-[11px] text-muted-foreground">今日分钟</div>
          </div>
        </div>
      </div>

      <ul className="mt-4 overflow-hidden rounded-[24px] bg-white">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href} className="border-b last:border-b-0">
              <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5">
                <Icon className="size-4 text-primary" />
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
