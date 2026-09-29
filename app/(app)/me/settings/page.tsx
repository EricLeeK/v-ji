import { redirect } from "next/navigation";
import { DeepseekKeyForm } from "@/components/settings/deepseek-key-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { AgentAccess } from "@/components/settings/agent-access";
import { deepseekKeyStatus } from "@/lib/ai/provider";
import { listActiveApiTokens } from "@/lib/agent/api-tokens";
import { getProfile } from "@/lib/data";
import { parseSettings } from "@/lib/settings";
import { getUserId } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { safeNextPath, siteOrigin } from "@/lib/site-url";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import Link from "next/link";
import { Link2 } from "lucide-react";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const profile = await getProfile();
  const { returnTo } = await searchParams;
  let tokens: Awaited<ReturnType<typeof listActiveApiTokens>> = [];
  let tokenError: string | null = null;
  try {
    tokens = await listActiveApiTokens();
  } catch {
    tokenError = "暂时无法读取访问令牌。请确认已执行最新数据库迁移。";
  }
  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <BackLink href={safeNextPath(returnTo, "/me")} label={returnTo?.startsWith("/study") ? "返回学习" : "我的"} />
      <h1 className="mb-5 app-page-title">设置</h1>
      <div className="space-y-5">
        <AvatarPicker avatarUrl={profile?.avatar_url} nickname={profile?.nickname ?? "学习者"} variant="row" />
        <SettingsForm nickname={profile?.nickname ?? "学习者"} settings={parseSettings(profile?.settings)} />
        <DeepseekKeyForm status={deepseekKeyStatus(profile?.settings)} />
        <AgentAccess origin={siteOrigin()} tokens={tokens} error={tokenError} />
        <Link href="/me/settings/integrations" className="app-card flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-primary/[0.04]">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">外部连接</span><span className="mt-0.5 block text-xs text-muted-foreground">管理 V Learning Hub 令牌</span></span>
          <span className="text-sm text-muted-foreground">管理</span>
        </Link>
      </div>
    </div>
  );
}
