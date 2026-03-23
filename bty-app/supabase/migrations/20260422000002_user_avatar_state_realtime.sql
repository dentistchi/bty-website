-- Realtime for user_avatar_state (tier / unlocked_assets) — AvatarRenderer live refresh.
do $$
begin
  alter publication supabase_realtime add table only public.user_avatar_state;
exception
  when duplicate_object then null;
end $$;
