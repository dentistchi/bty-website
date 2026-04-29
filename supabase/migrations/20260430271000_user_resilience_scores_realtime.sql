-- Realtime: ResilienceScoreCard subscribes to INSERT for live score updates
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_resilience_scores'
  ) then
    execute 'alter publication supabase_realtime add table only public.user_resilience_scores';
  end if;
end $$;
