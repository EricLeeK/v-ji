import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database";
import { callIntegrationRpc } from "./rpc";

describe("integration RPC transport", () => {
  it("calls the real Supabase client with its instance context intact", async () => {
    const rows = [{ id: "connection-id", label: "本机学习生态" }];
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const client = createClient<Database>("https://example.supabase.co", "test-public-key", {
      global: { fetch: request },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const result = await callIntegrationRpc<typeof rows>(client, "learning_hub_list_tokens");

    expect(result.error).toBeNull();
    expect(result.data).toEqual(rows);
    expect(request).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0][0])).toBe("https://example.supabase.co/rest/v1/rpc/learning_hub_list_tokens");
  });
});
