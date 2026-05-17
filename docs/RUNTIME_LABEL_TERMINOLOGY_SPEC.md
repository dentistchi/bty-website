# RUNTIME_LABEL_TERMINOLOGY_SPEC

**Status:** NORMATIVE
**Date:** 2026-05-17
**Track:** queue #3 — runtime label terminology / STEP 1

**Authority.** This document is normative for runtime **label terminology** — the naming
of runtime state labels and multi-runtime path vocabulary. Every measured claim is
corroborated by raw code measurement (queue #3 STEP 0 / STEP 0.1 corroboration reports);
`file:line` references are given inline. This document **articulates terminology ontology
and performs no rename** — it changes no code identifier and proposes none.

Related: [`docs/RESULT_ORIGIN_CLOSURE_SPEC.md`](RESULT_ORIGIN_CLOSURE_SPEC.md),
[`docs/ARENA_CANONICAL_CONTRACT.md`](ARENA_CANONICAL_CONTRACT.md).

---

## §1 Scope

This document governs runtime label terminology across two layers:

- **Layer A** — runtime state labels (server gate-authority labels and client flow-state
  labels).
- **Layer B** — multi-runtime path naming (routing vocabulary).

It fixes the terminology ontology as NORMATIVE. It does **not** rename, and does not
recommend a rename; §8 records the single conditional under which a future rename track
could open.

## §2 Layer A — runtime state labels (server)

`ArenaRuntimeStateId` (`arenaRuntimeSnapshot.types.ts:9`) has **9 labels**:
`ACTION_REQUIRED`, `ACTION_SUBMITTED`, `ACTION_AWAITING_VERIFICATION`,
`ARENA_SCENARIO_READY`, `TRADEOFF_ACTIVE`, `ACTION_DECISION_ACTIVE`, `NEXT_SCENARIO_READY`,
`FORCED_RESET_PENDING`, `REEXPOSURE_DUE`.

- **NORMATIVE.** All 9 labels are **per-request derived snapshot labels** — not persisted
  database state. `runtime_state` is not a DB column; the `arenaRuntimeSnapshot.server.ts`
  builders compute it on each `GET /session`. Some labels derive *from* persisted rows
  (e.g. `ACTION_REQUIRED` from an action-contract row), but the `runtime_state` label
  itself is never stored.
- `ArenaRuntimeStateId` is the **server gate-authority derived projection**.
- **Terminology drift.** The drift is in the **naming surface, not the label values**.
  The label values (`*_ACTIVE`, `*_DUE`, `*_PENDING`, `*_REQUIRED`, `*_SUBMITTED`,
  `*_READY`) are accurate. The type name `ArenaRuntimeStateId` and the field names
  `runtime_state` / `state_priority` name a derived projection with the word "state",
  which conventionally connotes persisted status.
- A minor internal inconsistency: the `arenaRuntimeSnapshot.types.ts` comment calls them
  "Canonical runtime **labels**" while the type is named `…StateId`.

## §3 Layer A — client flow state

`RuntimeFlowState` (`data/scenario/types.ts:102`) has **6 labels**: `SCENARIO_READY`,
`PRIMARY_CHOICE_ACTIVE`, `TRADEOFF_ACTIVE`, `ACTION_DECISION_ACTIVE`, `ACTION_REQUIRED`,
`NEXT_SCENARIO_READY`. Its container is `RuntimeFlowContext = { state: RuntimeFlowState; … }`.

- **NORMATIVE.** `RuntimeFlowState` is an **in-scenario client flow position** — an
  in-memory FSM context, not persisted.
- The server `ArenaRuntimeStateId` and the client `RuntimeFlowState` are **separate
  types** with no shared type and no common reducer (`data/scenario/index.ts` does not
  import `ArenaRuntimeStateId`).

## §4 Layer A — four-label term overload (NORMATIVE judgment)

Four label strings — `TRADEOFF_ACTIVE`, `ACTION_DECISION_ACTIVE`, `ACTION_REQUIRED`,
`NEXT_SCENARIO_READY` — appear identically in both `ArenaRuntimeStateId` and
`RuntimeFlowState`.

- **Judgment.** This is **disjoint vocabulary reuse, not a shared type** — it is wording
  overload, not type collision. Because the two type systems are disjoint, no runtime
  collision can occur and code correctness is unaffected.
- **Disposition: doc-articulation sufficient.** The server label is a gate-authority
  projection; the client label is an in-scenario flow position — an intended separation.
  This document's explicit statement of that separation resolves the reader-overload
  risk. No rename is required.

## §5 Layer B — code runtime-path vocabulary

The code's actual routing vocabulary (queue #3 STEP 0.1):

- `route` union — `"mirror" | "perspective_switch" | "catalog"` (`scenario-type-router.ts:23`).
- `catalog` — the live routing value; `getNextScenarioForSession` always returns
  `route: "catalog"`.
- `useLegacyRunStepApi` / `isCanonicalJsonRuntimeScenario` — identifiers distinguishing
  the legacy `/api/arena/run/step` path from the "canonical JSON runtime".

- **Wording variance.** The same catalog-selection mechanism is called **"Elite v2 chain
  allowlist"** in the router (`scenario-type-router.ts:3`) and **"canonical allowlist"**
  in the selector (`scenario-selector.service.ts:283 / :414`). One concept, two wordings.
  **Disposition: doc-articulation sufficient** — this document records that the two
  wordings denote the same mechanism.
- **"legacy" type-vs-reality drift.** The `route` union admits `"mirror"` and
  `"perspective_switch"` as type members, while the adjacent comment states they are
  "legacy route labels; runtime always uses `catalog`". The type permits values the
  wording calls superseded — a mild type-vs-reality drift. **Disposition: doc-articulation
  sufficient** — narrowing the union is an optional code change; the wording gap itself
  is recorded here.

## §6 Signal-only vocabulary

The terms `own_re02_r1` (special runtime), `legacy index runtime`, `chain runtime`,
`v2 JSON artifact runtime`, and "controlled multi-runtime transitional architecture` are
**not corroborated in code** — both queue #3 STEP 0 and STEP 0.1 measured them absent.

- **NORMATIVE.** These are classified **signal-only, code-uncorroborated terminology**.
  They are not discarded, but they MUST NOT be promoted to runtime-state vocabulary. The
  code-authoritative routing vocabulary is the §5 set (`route` union / `catalog` /
  chain-allowlist / `useLegacyRunStepApi` / `isCanonicalJsonRuntimeScenario`).
- STEP 0.1 recorded nearest-code-vocabulary estimates for some of these terms; those
  remain **estimates only**. This document performs no forced mapping. `own_re02_r1` in
  particular has no identified code counterpart.

## §7 Cross-layer "runtime" overload (NORMATIVE judgment)

The word "runtime" is used in Layer A as a qualifier of a **derived state label**
(`ArenaRuntimeStateId`, `RuntimeFlowState`, `runtime_state`) and in Layer B as a qualifier
of an **execution path** ("canonical JSON runtime", "runtime always uses catalog",
`useLegacyRunStepApi`) — the same word, two referents.

- **Judgment.** This is a real **moderate wording overload**, but there is no shared type
  — it is not a type collision. "runtime" is a pervasive word in the codebase
  (~390 files).
- **Disposition: doc-articulation sufficient.** Renaming "runtime" would expand a
  terminology-governance concern into a codebase-wide refactor and is not required. This
  document's explicit statement of the two layer-specific meanings closes the overload.

## §8 Overall disposition + conditional escape

- **NORMATIVE.** Every runtime-label-terminology candidate — Layer A naming drift, the
  four-label overload (§4), the Layer B wording variance and "legacy" drift (§5), and the
  cross-layer "runtime" overload (§7) — is **doc-articulation sufficient**. No candidate
  reached outright rename pressure. **Rename — of any type, field, or identifier — is not
  required.** Runtime label terminology is **closed** by this document.
- **Conditional.** If future implementation work demonstrates concrete developer or
  runtime confusion caused by one of these overloads, a separate rename/refactor lane may
  be opened at that point. This document does not leave that as an open question — the
  terminology concern is closed here; the conditional names only the trigger under which
  a *new* lane would be justified.
