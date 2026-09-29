"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callIntegrationRpc } from "@/lib/integrations/rpc";
import { createLearningHubToken as generateLearningHubToken, hashLearningHubToken } from "@/lib/integrations/token";
import { createClient, getUserId } from "@/lib/supabase/server";

const deckIdSchema = z.string().uuid();
const tokenIdSchema = z.string().uuid();
const labelSchema = z.string().trim().min(1).max(80);

export async function createLearningHubToken(deckId: string, label: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录后创建连接令牌" };

  const parsedDeckId = deckIdSchema.safeParse(deckId);
  const parsedLabel = labelSchema.safeParse(label);
  if (!parsedDeckId.success || !parsedLabel.success) {
    return { error: "请检查卡片盒和连接名称" };
  }

  const token = generateLearningHubToken();
  const supabase = await createClient();
  const { data, error } = await callIntegrationRpc<string>(supabase, "learning_hub_create_token", {
    p_deck_id: parsedDeckId.data,
    p_token_hash: hashLearningHubToken(token),
    p_label: parsedLabel.data,
  });
  if (error || !data) return { error: "创建连接令牌失败，请稍后重试" };

  revalidatePath("/me/settings/integrations");
  return { token, label: parsedLabel.data };
}

export async function revokeLearningHubToken(tokenId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  if (!tokenIdSchema.safeParse(tokenId).success) return { error: "连接令牌无效" };

  const supabase = await createClient();
  const { data, error } = await callIntegrationRpc<boolean>(supabase, "learning_hub_revoke_token", {
    p_token_id: tokenId,
  });
  if (error) return { error: "撤销失败，请稍后重试" };
  if (!data) return { error: "令牌不存在或已撤销" };

  revalidatePath("/me/settings/integrations");
  return {};
}
