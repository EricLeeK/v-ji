import { createClient, getUserId } from "@/lib/supabase/server";

export type ApiTokenSummary = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function listActiveApiTokens(): Promise<ApiTokenSummary[]> {
  const uid = await getUserId();
  if (!uid) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, token_prefix, created_at, last_used_at")
    .eq("owner_id", uid)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.token_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}
