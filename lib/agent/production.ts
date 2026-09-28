import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { createSessionCardStore, createTokenCardStore } from "@/lib/agent/supabase-store";
import { resolveActor } from "@/lib/agent/token";
import type { AgentRuntime } from "@/lib/agent/http";
import type { CardStore } from "@/lib/agent/cards";

export const productionRuntime: AgentRuntime = {
  authenticate: authenticateAgent,
};

export async function authenticateAgent(request: Request): Promise<CardStore | null> {
  const authorization = request.headers.get("authorization");
  const sessionUserId = authorization?.trim() ? null : await getUserId();
  const actor = await resolveActor(authorization, sessionUserId, async (tokenHash) => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("agent_token_owner", { p_token_hash: tokenHash });
    if (error || typeof data !== "string" || !data) return null;
    return data;
  });
  if (!actor) return null;
  if (actor.tokenHash) return createTokenCardStore(createAdminClient(), actor.userId, actor.tokenHash);
  return createSessionCardStore(await createClient(), actor.userId);
}
