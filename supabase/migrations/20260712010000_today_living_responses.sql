-- Today Living Response V1 — one immutable AI-or-fallback perspective per relationship commitment.
--
-- Separate entity from today_relationship_commitments (commitment = frame; response = expression).
-- One row per commitment (UNIQUE(commitment_id)); the row is claimed atomically (pending) then
-- SETTLED once as 'generated' or 'fallback' and thereafter immutable. Carries ONLY a machine
-- evidence_fingerprint + supported_codes + versions — never raw evidence text.
--
-- Security mirrors today_relationship_commitments: authenticated SELECT own rows; service-role
-- writes only (no client INSERT/UPDATE/DELETE policy). Atomic claim via a security-definer function.
--
-- Idempotent. Rollback:
--   DROP FUNCTION IF EXISTS public.claim_living_response(uuid,uuid,text,text,text,text,uuid,int);
--   DROP TABLE IF EXISTS public.today_living_responses;

CREATE TABLE IF NOT EXISTS public.today_living_responses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id        uuid NOT NULL REFERENCES public.today_relationship_commitments(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key              text NOT NULL,
  relationship         text NOT NULL,
  status               text NOT NULL,
  perspective          text NULL,
  source               text NULL,
  confidence           text NULL,
  evidence_fingerprint text NULL,
  supported_codes      text[] NOT NULL DEFAULT '{}',
  model_version        text NULL,
  prompt_version       text NOT NULL,
  policy_version       text NOT NULL,
  attempt_token        uuid NULL,
  attempt_started_at   timestamptz NULL,
  last_error_code      text NULL,
  settled_at           timestamptz NULL,
  generated_at         timestamptz NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT today_living_responses_commitment_uniq UNIQUE (commitment_id),
  CONSTRAINT today_living_responses_relationship_chk CHECK (relationship IN ('self','others','world')),
  CONSTRAINT today_living_responses_status_chk CHECK (status IN ('pending','generated','fallback')),
  CONSTRAINT today_living_responses_source_chk CHECK (source IS NULL OR source IN ('generated','fallback')),
  CONSTRAINT today_living_responses_confidence_chk CHECK (confidence IS NULL OR confidence IN ('grounded','limited')),
  -- settled rows are complete: a generated/fallback row must carry perspective + source + settled_at
  CONSTRAINT today_living_responses_settled_complete_chk CHECK (
    status = 'pending' OR (perspective IS NOT NULL AND source IS NOT NULL AND settled_at IS NOT NULL)
  ),
  -- source must correspond to the settled status
  CONSTRAINT today_living_responses_source_matches_status_chk CHECK (
    status = 'pending' OR source = status
  )
);

-- Layer 1 (capacity / GRANT): authenticated READ own rows; writes service_role-only.
REVOKE ALL ON public.today_living_responses FROM anon, PUBLIC;
GRANT SELECT ON public.today_living_responses TO authenticated;

-- Layer 2 (activation / RLS): default-deny; SELECT own rows only. No client write policy.
ALTER TABLE public.today_living_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS today_living_responses_select_own ON public.today_living_responses;
CREATE POLICY today_living_responses_select_own ON public.today_living_responses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ── Atomic claim (Phase 5) ──
-- Returns exactly one of: CLAIMED | SETTLED | IN_PROGRESS | RECLAIMED.
--  CLAIMED   : this call inserted the pending row → this attempt owns generation.
--  SETTLED   : a generated/fallback row already exists (immutable) → caller reads it.
--  IN_PROGRESS: a FRESH pending attempt (within lease) owns it → caller returns pending, no provider.
--  RECLAIMED : a STALE pending attempt was atomically taken over (attempt_token rotated).
-- Only the owning attempt_token may later settle the row (guarded UPDATE in the service layer).
CREATE OR REPLACE FUNCTION public.claim_living_response(
  p_commitment_id  uuid,
  p_user_id        uuid,
  p_day_key        text,
  p_relationship   text,
  p_prompt_version text,
  p_policy_version text,
  p_attempt_token  uuid,
  p_lease_seconds  int
) RETURNS text
LANGUAGE plpgsql
-- SECURITY DEFINER is REQUIRED: writes are server-authoritative (the table has no client write
-- policy), so the atomic claim must run with the definer's privileges, not the (RLS-scoped) caller.
-- Hardened per Supabase guidance: empty search_path + fully schema-qualified object references
-- (public.* for app tables, pg_catalog.* for built-ins) so the path cannot be hijacked.
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status  text;
  v_started timestamptz;
  v_rows    bigint;
BEGIN
  INSERT INTO public.today_living_responses(
    commitment_id, user_id, day_key, relationship, status,
    prompt_version, policy_version, attempt_token, attempt_started_at
  )
  VALUES (
    p_commitment_id, p_user_id, p_day_key, p_relationship, 'pending',
    p_prompt_version, p_policy_version, p_attempt_token, pg_catalog.now()
  )
  ON CONFLICT (commitment_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    RETURN 'CLAIMED';
  END IF;

  SELECT status, attempt_started_at INTO v_status, v_started
  FROM public.today_living_responses
  WHERE commitment_id = p_commitment_id;

  IF v_status IN ('generated','fallback') THEN
    RETURN 'SETTLED';
  END IF;

  -- pending: fresh attempt still owns it (within lease)
  IF v_started > pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds) THEN
    RETURN 'IN_PROGRESS';
  END IF;

  -- stale pending: atomically reclaim + rotate the attempt_token
  UPDATE public.today_living_responses
  SET attempt_token = p_attempt_token, attempt_started_at = pg_catalog.now()
  WHERE commitment_id = p_commitment_id
    AND status = 'pending'
    AND attempt_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    RETURN 'RECLAIMED';
  END IF;

  RETURN 'IN_PROGRESS';
END;
$$;

-- Execution is service_role ONLY (the app writes exclusively via the server admin client). Revoke
-- from every implicit grantee first, then grant the single application role.
REVOKE ALL ON FUNCTION public.claim_living_response(uuid,uuid,text,text,text,text,uuid,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_living_response(uuid,uuid,text,text,text,text,uuid,int) FROM anon;
REVOKE ALL ON FUNCTION public.claim_living_response(uuid,uuid,text,text,text,text,uuid,int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_living_response(uuid,uuid,text,text,text,text,uuid,int) TO service_role;
