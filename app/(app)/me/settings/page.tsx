import { redirect } from "next/navigation";
import { DeepseekKeyForm } from "@/components/settings/deepseek-key-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { deepseekKeyStatus } from "@/lib/ai/provider";
import { getProfile } from "@/lib/data";
import { parseSettings } from "@/lib/settings";
import { getUserId } from "@/lib/supabase/server";
import { AvatarPicker } from "@/components/profile/avatar-picker";

export default async function SettingsPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const profile = await getProfile();
  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <h1 className="mb-5 app-page-title">设置</h1>
      <div className="space-y-5">
        <AvatarPicker avatarUrl={profile?.avatar_url} nickname={profile?.nickname ?? "学习者"} variant="row" />
        <DeepseekKeyForm status={deepseekKeyStatus(profile?.settings)} />
        <SettingsForm nickname={profile?.nickname ?? "学习者"} settings={parseSettings(profile?.settings)} />
      </div>
    </div>
  );
}
