import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

type TestDeck = { name: string; db: SupabaseClient; ownerId: string };

export const test = base.extend<{ testDeck: TestDeck }>({
  testDeck: [async ({}, runTest) => {
    loadEnvConfig(process.cwd());
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await db.auth.signInWithPassword({
      email: "demo@huaji.local",
      password: "huaji123456",
    });
    if (error) throw error;
    const ownerId = data.user!.id;
    const name = `E2E ${randomUUID()}`;

    try {
      await runTest({ name, db, ownerId });
    } finally {
      // Exact per-test name also covers creation succeeding before navigation fails.
      // Deleting the deck cascades to its notes, cards, and review logs.
      const { error: deleteError } = await db.from("decks").delete()
        .eq("owner_id", ownerId).eq("name", name);
      if (deleteError) throw deleteError;
      const { data: remaining, error: readError } = await db.from("decks")
        .select("id").eq("owner_id", ownerId).eq("name", name);
      if (readError) throw readError;
      expect(remaining, `E2E cleanup left test deck ${name}`).toEqual([]);
    }
  }, { timeout: 30_000 }],
});

export { expect };
