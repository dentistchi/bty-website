# HK9-CODENAME-SYNC — Closure (C-β)

**Date**: 2026-05-12
**Sprint**: HK9-CODENAME-SYNC C-β
**Inner commit**: `99da02d2`
**Author**: Hanbit (Commander) / C3 patch

---

## Change

Single-line patch in `bty-app/src/features/my-page/logic/computeLeadershipState.ts`:

```diff
- const DEFAULT_CODE_NAME = "STILLWATER";
+ const DEFAULT_CODE_NAME = "QUIETFLAME";
```

Dormant fallback capacity normalized to align with DB Lock 4 active baseline (QUIETFLAME, snapshot `38ce28d2`).

## Production activation: 0

`bty-app/src/lib/bty/identity/getMyPageIdentityState.ts:85,91` passes `codeNameOverride` explicitly to `computeLeadershipState`. The `DEFAULT_CODE_NAME` fallback is **never reached on the production code path** — this was dormant capacity, not active risk. The patch corrects the residue without changing observable user behavior.

## Corrected frame

Prior memory frame was 3-way confused:

- **NOVA** — Arena Progression Code namespace (separate from leadership codenames)
- **QUIETFLAME** — Archetype Lock 4 active baseline (DB-anchored)
- **STILLWATER** — actual stale residue in `computeLeadershipState` fallback (this patch's target)

NOVA and QUIETFLAME do **not** conflict — they belong to separate namespaces. The original frame "NOVA vs QUIETFLAME mismatch" was incorrect; the real anomaly was STILLWATER dormant fallback. Inventory-first caught the frame error before mutation.

## Deferred

- `bty-app/src/domain/arena/scenarios/mockScenario.ts:275` — `codename: "STILLWATER"` TopBar mock placeholder. Out of scope for this sprint (Arena namespace concern, not leadership codename). Defer to separate Arena namespace sprint.
- Archetype-domain STILLWATER (RULE_REGISTRY entry in `archetype/rules.ts`, related test files) — legitimate archetype name in a separate namespace, preserved by design.

## Discipline note

Inventory-first dispatch caught a 3-way memory frame error before any code mutation. The original anomaly framing pointed at a non-issue (NOVA vs QUIETFLAME) while the real residue (STILLWATER) sat untouched. Pattern: when an anomaly frame fails to map cleanly onto the codebase, run full grep inventory before patching — the wrong target is more dangerous than the wrong fix.

## Tests

- Targeted: `computeLeadershipState.test.ts` — **2/2 PASS**
- My-page identity scope (5 files, 22 tests): **21/22 PASS**, 1 pre-existing fail at `MyPageLeadershipConsole.test.tsx:137` (verified via stash baseline — unrelated to this patch; mock setup or component fallback bug pre-dating the change).

## Outer status leak count after commit

**5** modified/deleted entries remain in outer working tree (`bty-app/src/features/my-page/logic/computeLeadershipState.ts`, `bty-app/src/lib/bty/center/letterService.ts`, `bty-app/src/lib/bty/identity/getMyPageIdentityState.ts`, `bty-app/src/lib/bty/validator/layer2Semantic.ts`, `bty-app/src/lib/llm.ts` deleted). These reflect inner repo commits (HK7 C3 `cb7512fd`, HK7 C4 `a1dc742a`, HK9 C-β `99da02d2`) **not yet propagated to outer**. Per dispatch rule 5, inner repo changes are not committed through the outer repo.
