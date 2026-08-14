# ADR-003 — Verified Learning Engine — Same Contract

**Status:** Accepted  
**Date:** 2026-06-25

## Context

Learning is the third Reality Engine (after Action and Event). A common failure mode: treat learning as content consumption that automatically grants points (watch video → XP).

## Decision

The **Verified Learning Engine** uses the **same Reality Engine contract** as Action and Event:

```
verify(learning happened in reality) → award() → new_core_xp → reproject(new_core_xp)
```

Learning content may exist in Foundry or elsewhere, but **no Core XP** until verification confirms the learning occurred in the real world.

Unverified consumption awards **nothing**.

## Reason

- Constitution: reality is the source; the app does not create growth.
- "Learning gives XP" is a misconception that collapses BTY into a course platform.
- One contract across engines prevents special-case XP logic that future AI will duplicate in UI or API handlers.

## Consequences

- Do not build "progress bars that grant Core XP on page scroll" or "video completion = XP" without a verification step equivalent to Action/Event.
- Learning verification mechanism is TBD in implementation — the **decision** is fixed: verify first, award second.
- Weekly/activity ledgers, if used, remain subordinate to Core XP root (ADR-001).

## Related

- ADR-001, ADR-002  
- [`BTY_PRODUCT_ROADMAP.md`](../BTY_PRODUCT_ROADMAP.md) — Learning Engine is roadmap #1
