-- Realtime INSERT for condition-based outfit unlocks (see OutfitUnlockPanel).

alter publication supabase_realtime add table only public.user_avatar_assets;
