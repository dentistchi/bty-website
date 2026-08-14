# ADR-002 — Reality Event Engine — Scan Semantics

**Status:** Accepted  
**Date:** 2026-06-24

## Context

The Reality Event Engine awards Core XP when a member verifies attendance at a real-world event. Scan can be attempted more than once (user rescans, network retry, UI double-tap).

We had to choose: treat duplicate scan as error (4xx), idempotent success (200), or silent no-op with different status codes.

## Decision

**Duplicate scan is not an error.** Return **200** with `already_scanned` semantics when unique constraint `(event_id, user_id)` fires (Postgres `23505`).

Fresh scan: insert participation + RPC-atomic Core award → **200**.

Invalid states remain errors: cancelled event (**409**), expired event (**410**), failed gates (**401/403**).

Event QR is a **separate family** (`btyev1`). Do not route through Action QR validation (`aalo1`).

## Reason

- **Reality already happened.** The user attended. Punishing a rescan teaches distrust of the product.
- XP was already awarded on first successful scan. A second scan must not double-award (unique constraint + idempotent response).
- 200-benign reduces support burden and matches user mental model: "I scanned" → success, not "you already did that, error."

## Consequences

- `UNIQUE (event_id, user_id)` on participation is a **security and integrity** device, not just UX.
- Implementers must not change duplicate scan to 409 without a new ADR — it would punish real users.
- Create route is leader-track gated; scan route is member + approved-membership gated (leader gate dropped at scan — creation-only).
- `xp_value` snapshot on participation row preserves what was awarded even if event row changes later.

## Related

- ADR-001 (Core XP root, RPC-atomic award)  
- ADR-004 (SECURITY DEFINER on award RPC)
