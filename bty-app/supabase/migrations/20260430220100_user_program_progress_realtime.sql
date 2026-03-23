-- Live progress updates in Foundry program UI (Supabase Realtime).

do $$
begin
  alter publication supabase_realtime add table only public.user_program_progress;
exception
  when duplicate_object then null;
end $$;
