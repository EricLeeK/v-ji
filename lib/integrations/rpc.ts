import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type IntegrationRpcError = { message: string; code?: string };
export type IntegrationRpcResult<T> = { data: T | null; error: IntegrationRpcError | null };

export function callIntegrationRpc<T>(
  supabase: SupabaseClient<Database>,
  functionName: string,
  args?: Record<string, unknown>,
): Promise<IntegrationRpcResult<T>> {
  const rpc = supabase.rpc as unknown as (
    name: string,
    parameters?: Record<string, unknown>,
  ) => Promise<IntegrationRpcResult<T>>;
  return rpc(functionName, args);
}
