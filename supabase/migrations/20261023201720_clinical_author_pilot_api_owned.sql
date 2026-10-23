-- Prerequisite for the Clinical Cases author pilot. Additive; no existing trace is rewritten.
-- Existing owner policies permit active learner writes. Pilot events must instead
-- pass through the authenticated API, which enforces append-only transitions/CAS.
-- RESTRICTIVE policies AND with all existing permissive owner policies.
drop policy if exists clinical_author_pilot_api_owned_insert on public.clinical_reasoning_traces;
create policy clinical_author_pilot_api_owned_insert
  on public.clinical_reasoning_traces as restrictive
  for insert to authenticated
  with check (trace_schema_version <> 'clinical-author-pilot/v1');

drop policy if exists clinical_author_pilot_api_owned_update on public.clinical_reasoning_traces;
create policy clinical_author_pilot_api_owned_update
  on public.clinical_reasoning_traces as restrictive
  for update to authenticated
  using (trace_schema_version <> 'clinical-author-pilot/v1')
  with check (trace_schema_version <> 'clinical-author-pilot/v1');

-- service_role remains the server-only writer; authenticated owners keep SELECT.
-- Do not enable the pilot in production until this migration is applied and the
-- authenticated direct-write denial is verified through the production control plane.
