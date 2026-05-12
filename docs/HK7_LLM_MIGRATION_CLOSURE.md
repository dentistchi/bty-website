# HK7-LLM-MIGRATION-CLOSURE

**Status**: CLOSED 2026-05-12
**Scope**: Inner repo (bty-app/)
**Outer impact**: Closure record only (this doc)

---

## Summary

Migrate all LLM client invocations from legacy @/lib/llm (raw fetch via getLlmEndpoint + fetchJson) to unified @/lib/bty/llm/client (LlmClient abstraction). Remove src/lib/llm.ts atomically with last importer migration.

---

## Inner commits (4)

| # | Hash | Scope | Δ |
|---|---|---|---|
| C1 | bcbfc6dc | chat/route.ts + quality.ts | +18 / -30 |
| C2 | b0f13eed | mentor/route.ts + mentor/route.test.ts (paired) | +49 / -63 |
| C3 | cb7512fd | letterService.ts | +12 / -17 |
| C4 | a1dc742a | layer2Semantic.ts + src/lib/llm.ts delete (atomic) | +16 / -72 |

Total: 6 files modified, 1 file deleted, net -87 lines.

---

## Verification

| Gate | Result |
|---|---|
| Importer count @/lib/llm post-C4 | 0 |
| src/lib/llm.ts post-C4 | deleted (NOT FOUND) |
| npx tsc --noEmit | exit 0, no Cannot find @/lib/llm |
| Scope vitest (chat + mentor + center + validator) | 72/72 PASS |
| Full vitest | 3207 passed, 17 failed (baseline match, no new regression), 6 skipped |

---

## Anti-pattern avoidance

Three anti-patterns explicitly avoided:

- partial-commit dep-orphan: C4 atomic commit (last importer migration + target file deletion in single commit). Importer count = 0 verified pre-commit; deletion would otherwise leave dead module across commits.
- test-only no prod guard: C2 paired production + test commit. Mentor route migration and its test mock alignment committed together.
- premature-module-commit: All 4 WIP files and 4 external dependency files tracked pre-sprint. No untracked phantom.

---

## Capacity vs activation

- Capacity wired (pre-sprint): @/lib/bty/llm/client (LlmClient class, getLlmClient, getLlmModel, isLlmAvailable).
- Activation sites consumed:
  - chat/route.ts, mentor/route.ts, mentor/route.test.ts, quality.ts (pre-sprint WIP, committed in C1+C2)
  - letterService.ts (C3)
  - layer2Semantic.ts (C4)
- Old capacity removed: src/lib/llm.ts deleted (C4).

---

## Repo invariants preserved

- Inner repo origin disjoint history maintained (no merge, no rebase).
- Inner push prohibited (HK8 outer-inner sync still open).
- Outer repo unaffected by inner commits; this closure record is the only outer-touching change.

---

## Backlog status post-HK7

| Item | Status |
|---|---|
| HK7 @/lib/llm phantom | CLOSED |
| HK8 outer-inner sync | OPEN |
| HK9 orphan docs | OPEN |
| AL-1.8-G P3 NOVA vs QUIETFLAME codename sync | OPEN |
| Inner WIP HOLD: C7, E3, F2, G5 | OPEN |
