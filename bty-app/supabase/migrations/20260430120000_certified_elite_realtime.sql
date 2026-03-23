-- LeadershipEngineWidget: live refresh on Certified Leader grants + Elite Spec nominations.

alter publication supabase_realtime add table only public.certified_leader_grants;
alter publication supabase_realtime add table only public.elite_spec_nominations;
