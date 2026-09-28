import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { createSessionCardStore, createTokenCardStore } from "@/lib/agent/supabase-store";
import { resolveActor } from "@/lib/agent/token";
import { AgentUnavailableError, isAgentSchemaMissing } from "@/lib/agent/errors";
import type { AgentRuntime } from "@/lib/agent/http";
import type { CardStore } from "@/lib/agent/cards";

export const productionRuntime: AgentRuntime = {
  authenticate: authenticateAgent,
};

export async function authenticateAgent(request: Request): Promise<CardStore | null> {
  const authorization = request.headers.get("authorization");
  const sessionUserId = authorization?.trim() ? null : await getUserId();
  const actor = await resolveActor(authorization, sessionUserId, ownerForToken);
  if (!actor) return null;
  if (actor.tokenHash) return createTokenCardStore(createAdminClient(), actor.userId, actor.tokenHash);
  return createSessionCardStore(await createClient(), actor.userId);
}

async function ownerForToken(tokenHash: string): Promise<string | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SECRET_KEY")) {
      throw new AgentUnavailableError("服务端未配置 SUPABASE_SECRET_KEY");
    }
    throw error;
  }
  const { data, error } = await admin.rpc("agent_token_owner", { p_token_hash: tokenHash });
  if (error) {
    console.error("agent token lookup", error.message);
    if (isAgentSchemaMissing(error.message)) {
      throw new AgentUnavailableError("卡片接口的数据库迁移尚未应用");
    }
    throw new AgentUnavailableError("卡片接口暂时不可用");
  }
  if (typeof data !== "string" || !data) return null;
  return data;
}
