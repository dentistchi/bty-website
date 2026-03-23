-- Enable Postgres Changes (Realtime) for team_integrity_index INSERTs (TII dashboard refresh).
do $$
begin
  alter publication supabase_realtime add table only public.team_integrity_index;
exception
  when duplicate_object then null;
end $$;
