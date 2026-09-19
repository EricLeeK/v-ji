-- Allow the user-scoped AI fallback to record usage without opening direct
-- writes on ai_usage. Service-role clients may continue using the table grant.

create or replace function private.record_ai_usage(
  p_job_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_cache_hit_tokens integer,
  p_completion_tokens integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_prompt_tokens < 0 or p_cache_hit_tokens < 0 or p_completion_tokens < 0 then
    raise exception 'invalid AI usage';
  end if;
  if not exists (select 1 from public.ai_jobs where id = p_job_id and owner_id = uid) then
    raise exception 'AI job not found';
  end if;
  insert into public.ai_usage (
    owner_id, job_id, model, prompt_tokens, cache_hit_tokens, completion_tokens
  ) values (
    uid, p_job_id, left(coalesce(p_model, ''), 100), p_prompt_tokens,
    p_cache_hit_tokens, p_completion_tokens
  );
end;
$$;

create or replace function public.record_ai_usage(
  p_job_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_cache_hit_tokens integer,
  p_completion_tokens integer
)
returns void
language sql
security definer
set search_path = public, private
as $$
  select private.record_ai_usage(
    p_job_id, p_model, p_prompt_tokens, p_cache_hit_tokens, p_completion_tokens
  );
$$;

grant execute on function public.record_ai_usage(uuid, text, integer, integer, integer)
  to authenticated;
revoke execute on function public.record_ai_usage(uuid, text, integer, integer, integer)
  from public, anon;
revoke execute on function private.record_ai_usage(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
