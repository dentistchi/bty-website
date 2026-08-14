# ADR-004 — SECURITY DEFINER — Explicit REVOKE Required

**Status:** Accepted  
**Date:** 2026-06-24

## Context

Reality award paths use `SECURITY DEFINER` PostgreSQL functions (owner `postgres`) to perform atomic Core XP updates with service-role orchestration from API routes.

After deploying `bty_event_scan_award`, runtime ACL inspection showed **PUBLIC EXECUTE** was granted by default. Anon key could call the RPC directly, bypassing route gates (`requireApprovedMembership`, event live checks, `xp_value` binding) — enabling arbitrary Core XP inflation.

## Decision

Every `SECURITY DEFINER` function that must be service-role-only:

1. `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated`
2. `GRANT EXECUTE ON FUNCTION … TO service_role` (only if needed)
3. **Verify runtime ACL after apply** — catalog assumptions and commit messages are not authority; `pg_proc` / API probe is.

**"We did not GRANT to anon" ≠ safe.** Postgres defaults can still expose PUBLIC EXECUTE.

## Reason

- `SECURITY DEFINER` + RLS bypass = maximum privilege. Any unintended EXECUTE grant is a production-critical vulnerability.
- Route-level gates are defense in depth; they are **void** if RPC is callable with anon/authenticated key.
- This incident proved: security reasoning without runtime measurement is stale by definition.

## Consequences

- All future Reality-award definer functions **must** ship with revoke migration in the same release wave.
- Apply migration → immediately verify ACL before marking gate PASS.
- Authenticated-only definer functions use GRANT-then-REVOKE pattern (grant to `authenticated, service_role`, then revoke from `PUBLIC, anon`) — see prior arena RPC revoke migration for precedent.

## Related

- [`BTY_IMPLEMENTATION_RULES.md`](../BTY_IMPLEMENTATION_RULES.md) §4  
- Ledger: `CURRENT_TASK.md` 2026-06-24 Gate ③-pre
