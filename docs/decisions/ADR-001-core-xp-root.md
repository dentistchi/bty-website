# ADR-001 — Core XP as Root — Direct Award

**Status:** Accepted  
**Date:** 2026-06-24

## Context

BTY needed a single permanent growth record that all surfaces (Avatar, Identity, Codes, Stages, TII, Leaderboards, Weekly views) could derive from without drift or double authority.

Two forks existed: award through activity ledgers with derived totals, or treat Core XP as the root and project everything else.

## Decision

**Core XP is the root.** Verified reality awards Core XP **directly** (RPC-atomic increment). All other fields are **derived views** reprojected from the returned `new_core_xp`.

Reality Engine contract:

```
award() → new_core_xp → reproject(new_core_xp)
```

Authority: the value returned by the award transaction is the **only** input to derived calculations. No re-fetch. No recompute of Core from ledgers.

## Reason

- Reality creates growth; the app reflects it. A single root prevents the app from "calculating" growth independently of verified events.
- Multiple authorities (ledger sum vs profile total) inevitably drift under race conditions and retries.
- Direct Core award matches the philosophy: *verified behavior creates permanent value*; everything else is projection.

## Consequences

- `activity_xp_event_id` and similar links may exist for audit/future wiring — they do not become a second authority for Core totals.
- Reality Engines verify and submit; they do not calculate Avatar, Tier, or Leaderboard rank.
- Reprojection after award is **best-effort, self-healing** — transient projection failure must not roll back Core XP already confirmed in the award tx.

## Related

- Constitution Article III  
- ADR-002 (Event Engine uses same contract)  
- ADR-003 (Learning Engine must use same contract)
