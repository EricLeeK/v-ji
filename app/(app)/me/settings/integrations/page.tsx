import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { createClient, getUserId } from "@/lib/supabase/server";
import { callIntegrationRpc } from "@/lib/integrations/rpc";
import { IntegrationManager, type IntegrationTokenSummary } from "./integration-manager";

export default async function IntegrationsSettingsPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");

  const supabase = await createClient();
  const [{ data: decks }, tokenResult] = await Promise.all([
    supabase.from("decks").select("id, name").eq("owner_id", uid).order("created_at", { ascending: false }),
    callIntegrationRpc<IntegrationTokenSummary[]>(supabase, "learning_hub_list_tokens"),
  ]);

  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <BackLink href="/me/settings" label="设置" />
      <h1 className="mb-5 app-page-title">外部连接</h1>
      <IntegrationManager
        decks={(decks ?? []).map((deck) => ({ id: deck.id, name: deck.name }))}
        tokens={tokenResult.data ?? []}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
        publishableKey={process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""}
        loadError={tokenResult.error ? "读取连接列表失败，请刷新后重试" : undefined}
      />
    </div>
  );
}
