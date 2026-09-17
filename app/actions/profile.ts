"use server";

import { revalidatePath } from "next/cache";
import {
  maskSecret,
  normalizeDeepseekApiKey,
  overlayUserSettings,
  withDeepseekApiKey,
} from "@/lib/ai/provider";
import type { UserSettings } from "@/lib/settings";
import { createClient, getUserId } from "@/lib/supabase/server";

export async function updateProfile(patch: { nickname?: string; settings?: UserSettings }) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const next: { nickname?: string; settings?: ReturnType<typeof overlayUserSettings> } = {};
  if (patch.nickname !== undefined) next.nickname = patch.nickname;
  if (patch.settings) {
    const { data } = await supabase.from("profiles").select("settings").eq("id", uid).maybeSingle();
    next.settings = overlayUserSettings(data?.settings, patch.settings);
  }
  const { error } = await supabase.from("profiles").update(next).eq("id", uid);
  if (error) return { error: error.message };
  revalidatePath("/me");
  revalidatePath("/me/settings");
  return {};
}

export async function saveDeepseekApiKey(apiKey: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const parsed = normalizeDeepseekApiKey(apiKey);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", uid).maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({ settings: withDeepseekApiKey(data?.settings, parsed.key) })
    .eq("id", uid);
  if (error) return { error: error.message };
  revalidatePath("/me/settings");
  revalidatePath("/ai/new");
  return { masked: maskSecret(parsed.key) };
}

export async function clearDeepseekApiKey() {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", uid).maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({ settings: withDeepseekApiKey(data?.settings, null) })
    .eq("id", uid);
  if (error) return { error: error.message };
  revalidatePath("/me/settings");
  revalidatePath("/ai/new");
  return {};
}

export async function submitFeedback(content: string) {
  const uid = await getUserId();
  if (!uid) return { error: "请先登录" };
  const trimmed = content.trim();
  if (!trimmed) return { error: "请填写内容" };
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({ owner_id: uid, content: trimmed });
  if (error) return { error: error.message };
  return {};
}
