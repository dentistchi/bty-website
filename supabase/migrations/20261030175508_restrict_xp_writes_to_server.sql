-- XP is calculated by authenticated application routes, then written only by
-- their server client. Direct authenticated RPC access accepted arbitrary user
-- IDs/deltas and bypassed those routes. Preserve server-side and nested owner
-- execution while closing the direct Data API path.
begin;
revoke execute on function public.increment_arena_xp(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.increment_weekly_xp(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_arena_xp(uuid, uuid, integer) to service_role;
grant execute on function public.increment_weekly_xp(uuid, uuid, integer) to service_role;
commit;
