-- Lane B Stage B Step 2: backfill existing auth.users into signup_requests
-- Purpose: prevent middleware gate from locking out the 15 existing users at
--          Lane B introduction. Policy R4=b — all existing approved.
-- Idempotent via ON CONFLICT (user_id) DO NOTHING.

INSERT INTO public.signup_requests (
  user_id,
  email,
  name,
  role,
  status,
  submitted_at,
  reviewed_at
)
SELECT
  u.id AS user_id,
  COALESCE(u.email, '(no-email-' || substring(u.id::text, 1, 8) || ')') AS email,
  COALESCE(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name',
    u.email,
    '(legacy-' || substring(u.id::text, 1, 8) || ')'
  ) AS name,
  'unspecified' AS role,
  'approved' AS status,
  COALESCE(u.created_at, now()) AS submitted_at,
  now() AS reviewed_at
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
