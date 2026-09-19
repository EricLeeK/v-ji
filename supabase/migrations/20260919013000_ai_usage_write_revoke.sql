-- Keep usage accounting server/RPC-only; authenticated users only need SELECT.
revoke insert, update, delete on public.ai_usage from public, anon, authenticated;
