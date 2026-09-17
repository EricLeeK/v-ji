import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiDb = SupabaseClient<Database>;

export function createAdminClient(): AiDb {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("缺少 SUPABASE_SECRET_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createPipelineClient(): AiDb {
  if (process.env.SUPABASE_SECRET_KEY) return createAdminClient();
  throw new Error("缺少 SUPABASE_SECRET_KEY");
}
