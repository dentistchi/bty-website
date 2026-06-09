# features/growth — SHARED REFLECTION-SEED INFRA (do NOT delete with Growth UI)

⚠️ "growth" namespace is a MISNOMER. This module (logic/ + api/) is load-bearing
shared infrastructure, NOT a Growth-UI appendage. The Growth UI was dismantled in
IA-B4 (reflection family moved to Center, hub removed), but this seed pipe MUST survive.

## Live consumers (verified IA-B4-STEP0)
- PRODUCER — Arena: `src/app/api/bty/arena/signals/route.ts:32` → `saveArenaSignalWithSeed`
  (`src/lib/bty/identity/saveArenaSignalWithSeed.ts:49` → `buildReflectionSeed`,
  defined at `src/features/growth/logic/buildReflectionSeed.ts:22`).
  Every arena signal save generates a reflection seed. Core arena flow.
- CONSUMER — My Page: `src/components/bty/my-page/MyPageLeadershipConsole.tsx:84` and
  `src/features/my-page/logic/mergeLeadershipReflection.ts:19` →
  `loadReflections` (`src/features/growth/logic/reflectionStorage.ts`).
  Leadership console displays reflections.
- CONSUMER — Center: reflection surface (post-B4 home, see IA_RESTRUCTURE_PLAN B4c+B4d).

## Removal warning
Naive deletion of features/growth/{logic,api} BREAKS arena signal-save (무게중심) and
my-page console. Decision4 "seed 파이프 보존" = mandatory. b-stay: stays here, documented.
Re-home (out of features/growth) = optional future refactor lane, NOT part of IA-B4.

Authority: docs/plans/IA_RESTRUCTURE_PLAN.md @ 8b14d13c
