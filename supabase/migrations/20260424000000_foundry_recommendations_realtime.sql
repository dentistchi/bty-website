-- Realtime: refresh Foundry program recommendations in the client when rows change.
do $$
begin
  alter publication supabase_realtime add table only public.foundry_recommendations;
exception
  when duplicate_object then null;
end $$;
