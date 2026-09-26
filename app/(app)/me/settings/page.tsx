import { redirect } from "next/navigation";
import { DeepseekKeyForm } from "@/components/settings/deepseek-key-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { deepseekKeyStatus } from "@/lib/ai/provider";
import { getProfile } from "@/lib/data";
import { parseSettings } from "@/lib/settings";
import { getUserId } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { safeNextPath } from "@/lib/site-url";
import { AvatarPicker } from "@/components/profile/avatar-picker";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const profile = await getProfile();
  const { returnTo } = await searchParams;
  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <BackLink href={safeNextPath(returnTo, "/me")} label={returnTo?.startsWith("/study") ? "返回学习" : "我的"} />
      <h1 className="mb-5 app-page-title">设置</h1>
      <div className="space-y-5">
        <AvatarPicker avatarUrl={profile?.avatar_url} nickname={profile?.nickname ?? "学习者"} variant="row" />
        <SettingsForm nickname={profile?.nickname ?? "学习者"} settings={parseSettings(profile?.settings)} />
        <DeepseekKeyForm status={deepseekKeyStatus(profile?.settings)} />
      </div>
    </div>
  );
}
