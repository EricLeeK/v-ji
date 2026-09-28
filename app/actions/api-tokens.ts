"use server";

import { revalidatePath } from "next/cache";
import { apiTokenPrefix, generateApiToken, hashApiToken } from "@/lib/agent/token";
import { createClient, getUserId } from "@/lib/supabase/server";

const MAX_ACTIVE_TOKENS = 10;

export async function createApiToken(name: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) return { error: "名称须为 1–40 个字符" };

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("api_tokens")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid)
    .is("revoked_at", null);
  if (countError) return { error: "暂时无法创建令牌" };
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) return { error: "最多保留 10 个有效令牌，请先撤销不用的令牌" };

  const token = generateApiToken();
  const { error } = await supabase.from("api_tokens").insert({
    owner_id: uid,
    name: trimmed,
    token_hash: hashApiToken(token),
    token_prefix: apiTokenPrefix(token),
  });
  if (error) return { error: "暂时无法创建令牌" };
  revalidatePath("/me/settings");
  return { token };
}

export async function revokeApiToken(id: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", uid)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: "暂时无法撤销令牌" };
  if (!data) return { error: "令牌不存在或已经撤销" };
  revalidatePath("/me/settings");
  return {};
}
