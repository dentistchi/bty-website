-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- TRUSTED READ-ONLY LIVE FUNCTION BODY EXPORT (Slice 3.2I-R5B1A.1-R2.7).
-- ===========================================================================
-- WHY THIS EXISTS
-- The r2.6 packet audit compares function bodies by SHA-256 of raw prosrc; it
-- deliberately does NOT carry the body text. That was enough to PROVE two live
-- bodies differ from repository authority, but not enough to say WHICH body is
-- correct — and an exhaustive sweep of both repositories (3,500 commits, ~21,000
-- blobs) found no candidate that reproduces either live digest. The live bodies
-- are therefore UNKNOWN versions and cannot be judged without their text.
--
-- WHAT IT IS
-- ONE read-only statement returning the raw source of the four audited Foundry
-- functions. STRICTLY pg_catalog only: no application rows, no user content, no
-- credentials. Function source is technical schema evidence.
--
-- THIS IS NOT A PACKET. It deliberately does not alter the r2.6 audit packet, so
-- the existing attested r2.6 result REMAINS VALID evidence. Its trust anchor is
-- that packet: every exported body must hash to the digest the r2.6 audit already
-- measured independently. `scripts/migration-proof/body-forensics/ingest-live-body.mjs`
-- enforces that and REFUSES any body that does not match.
--
-- HOW TO RUN (trusted runner, read-only connection)
--   psql "<read-only connection string>" -tAq \
--     -f bty-app/docs/audit/forensics/foundry_function_body_export_readonly.sql \
--     > live_body_export.json
--
-- THEN (offline, no DB):
--   cd bty-app
--   node scripts/migration-proof/body-forensics/ingest-live-body.mjs \
--        /path/to/live_body_export.json /path/to/live_audit_result.r2.6.json
--   PGPROOF_BINDIR=/opt/homebrew/opt/postgresql@17/bin bash scripts/migration-proof/body-forensics/run.sh
--
-- AUTHORIZES NOTHING. Read-only. No repair, no apply, no deploy.
-- ===========================================================================

select json_build_object(
  'exportKind', 'foundry_function_body_export',
  'exportContractVersion', 'r2.7',
  'boundPacketId', 'd5171bbd503388a1ec9ac34aa11e05026b800f79f607697e809e416b2f1705d8',
  'serverVersionNum', current_setting('server_version_num')::int,
  'actualRuntimeQueryDigest', encode(sha256(convert_to(current_query(), 'UTF8')), 'hex'),
  'functions', (
    select coalesce(json_agg(json_build_object(
      'proname', p.proname,
      'identityArgs', pg_get_function_identity_arguments(p.oid),
      'result', pg_get_function_result(p.oid),
      'language', l.lanname,
      'securityDefiner', p.prosecdef,
      'proconfig', to_jsonb(p.proconfig),
      'prosrc', p.prosrc,
      'prosrcSha256', encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex')
    ) order by p.proname), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.proname in (
        'bty_foundry_set_shared_review',
        'bty_foundry_materialize_followup',
        'bty_foundry_submit_followup',
        'bty_foundry_get_my_followup')
  )
) as body_export;
