-- Discover empty decks without accepting an owner ID from the agent.
create or replace function private.list_agent_decks_for_owner(p_owner_id uuid,p_limit integer,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_owner_id is null then raise exception 'not authenticated'; end if;
  if p_limit is null or p_limit<1 or p_limit>101 or p_offset is null or p_offset<0 then raise exception 'invalid pagination'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'owner_id',d.owner_id) order by d.id),'[]') into result
  from (select id,name,owner_id from public.decks where owner_id=p_owner_id order by id limit p_limit offset p_offset)d;
  return result;
end $$;
create or replace function public.list_own_agent_decks(p_limit integer default 51,p_offset integer default 0)
returns jsonb language sql security definer set search_path='' as $$
 select private.list_agent_decks_for_owner(auth.uid(),p_limit,p_offset);
$$;
create or replace function public.agent_list_decks(p_token_hash text,p_limit integer default 51,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'not authenticated'; end if;
 uid:=private.owner_from_api_token(p_token_hash);
 if uid is null then raise exception 'not authenticated'; end if;
 perform private.touch_api_token(p_token_hash);
 return private.list_agent_decks_for_owner(uid,p_limit,p_offset);
end $$;
revoke all on function private.list_agent_decks_for_owner(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.list_own_agent_decks(integer,integer) from public,anon;
grant execute on function public.list_own_agent_decks(integer,integer) to authenticated;
revoke all on function public.agent_list_decks(text,integer,integer) from public,anon,authenticated;
grant execute on function public.agent_list_decks(text,integer,integer) to service_role;
