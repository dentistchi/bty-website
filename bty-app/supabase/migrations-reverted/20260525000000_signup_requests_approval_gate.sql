-- Lane B Stage B Step 1: signup approval gate substrate
-- Purpose: pre-launch external-signup approval gate (Q1-a all-block).
-- Apply path: standard supabase db push (no out-of-band apply).
-- Governance: docs/SIGNUP_APPROVAL_LANE_B.md (TBD).

CREATE TABLE IF NOT EXISTS public.signup_requests (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT
);

COMMENT ON TABLE public.signup_requests IS 'Lane B: external signup approval gate. Row inserted by register endpoint; gated by middleware on subsequent requests.';
COMMENT ON COLUMN public.signup_requests.status IS 'pending | approved | rejected. Admin transitions via /api/admin/signup-approvals endpoints.';

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

-- Self-read only. Admin actions use service_role client (bypasses RLS).
-- No INSERT/UPDATE policy for anon or authenticated: writes are server-side only.
CREATE POLICY signup_requests_self_read ON public.signup_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX signup_requests_status_submitted_idx ON public.signup_requests (status, submitted_at);
