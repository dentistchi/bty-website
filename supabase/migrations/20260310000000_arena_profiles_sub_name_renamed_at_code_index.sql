-- Codename "once per code" rule: which code index the user last used their one-time rename.
-- When code_index > sub_name_renamed_at_code_index (or it is null), user can rename again in the new code at tier 25+.
alter table public.arena_profiles
  add column if not exists sub_name_renamed_at_code_index smallint null;

comment on column public.arena_profiles.sub_name_renamed_at_code_index is 'Code index (0-5) at which user last used the one-time sub-name rename. Next code allows one more rename at tier 25+.';

-- Backfill: users who already renamed (sub_name_renamed_in_code = true) get current code_index so they get one more chance in the next code.
update public.arena_profiles
set sub_name_renamed_at_code_index = least(6, greatest(0, code_index))
where sub_name_renamed_in_code = true and sub_name_renamed_at_code_index is null;
