ALTER TABLE public.arena_profiles
  ADD COLUMN IF NOT EXISTS display_name_changed_at_code_index smallint NULL;
COMMENT ON COLUMN public.arena_profiles.display_name_changed_at_code_index IS
  'Code index (0-6) at which user last set display_name. Allow change when NULL or code_index > stored. One change per code, opens at code entry (no tier floor).';
