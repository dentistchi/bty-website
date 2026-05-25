-- Lane B Stage B Step 2: add role taxonomy CHECK to signup_requests
-- Purpose: lock role to BTY broad taxonomy (Path α). Step 1 substrate created
--          role as TEXT NOT NULL without CHECK; this migration adds the CHECK.
-- Note: 'unspecified' included for legacy backfill marker; public signup is
--       enforced to non-unspecified values in application layer (register/route.ts).

ALTER TABLE public.signup_requests
  ADD CONSTRAINT signup_requests_role_taxonomy_check
  CHECK (role IN (
    'unspecified',
    'doctor',
    'office_admin',
    'assistant',
    'office_manager',
    'regional_manager',
    'dso_member',
    'sso_member',
    'specialist',
    'other'
  ));

COMMENT ON COLUMN public.signup_requests.role IS 'BTY broad role taxonomy (Path α, Commander-locked). 9 categories + unspecified for legacy backfill. Tenure/region/specialty detail is out of scope; reserved for post-launch profile lane.';
