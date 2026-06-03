-- G-DC-23: full_name (real/legal name) for admin identification.
-- Distinct from display_name (public nickname). No code gate; freely editable.
-- Stored on arena_membership_requests (audit snapshot at submission) and
-- arena_profiles (authoritative, read by admin screens).
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.arena_profiles
  ADD COLUMN IF NOT EXISTS full_name text NULL;
COMMENT ON COLUMN public.arena_profiles.full_name IS
  'Real/legal name for admin identification. NOT a public nickname (display_name). Freely editable, no code gate.';

ALTER TABLE public.arena_membership_requests
  ADD COLUMN IF NOT EXISTS full_name text NULL;
COMMENT ON COLUMN public.arena_membership_requests.full_name IS
  'Applicant real name captured at submission (audit snapshot).';
