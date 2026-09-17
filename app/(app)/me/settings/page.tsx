import { redirect } from "next/navigation";
import { DeepseekKeyForm } from "@/components/settings/deepseek-key-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { deepseekKeyStatus } from "@/lib/ai/provider";
import { getProfile } from "@/lib/data";
import { parseSettings } from "@/lib/settings";
import { getUserId } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const profile = await getProfile();
  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <h1 className="mb-4 text-2xl font-semibold">设置</h1>
      <div className="space-y-5">
        <DeepseekKeyForm status={deepseekKeyStatus(profile?.settings)} />
        <SettingsForm nickname={profile?.nickname ?? "学习者"} settings={parseSettings(profile?.settings)} />
      </div>
    </div>
  );
}
