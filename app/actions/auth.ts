"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath, siteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "学习者");
  const supabase = await createClient();
  const origin = siteOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    revalidatePath("/", "layout");
    redirect("/today");
  }
  return { error: null, needsConfirm: true };
}

export async function signInAnonymously() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { nickname: "访客" } },
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/today");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
