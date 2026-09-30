import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { AgentAccess } from "@/components/settings/agent-access";
import { listActiveApiTokens } from "@/lib/agent/api-tokens";
import { createClient, getUserId } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
export default async function AgentSettingsPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login?next=/me/settings/agent");
  const supabase = await createClient();
  const [tokenResult, deckResult] = await Promise.allSettled([
    listActiveApiTokens(),
    supabase
      .from("decks")
      .select("id,name")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false }),
  ]);
  const tokens = tokenResult.status === "fulfilled" ? tokenResult.value : [];
  const decks =
    deckResult.status === "fulfilled" && !deckResult.value.error
      ? (deckResult.value.data ?? [])
      : [];
  const error =
    tokenResult.status === "rejected" ||
    deckResult.status === "rejected" ||
    (deckResult.status === "fulfilled" && deckResult.value.error)
      ? "连接信息未能完整加载，请刷新页面后再试。"
      : null;
  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <BackLink href="/me/settings" label="设置" />
      <h1 className="app-page-title">连接我的 Agent</h1>
      <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">
        把材料交给你常用的 AI，整理成卡片后，回到 V 记开始复习。
      </p>
      <AgentAccess
        origin={siteOrigin()}
        tokens={tokens}
        decks={decks}
        error={error}
      />
    </div>
  );
}
