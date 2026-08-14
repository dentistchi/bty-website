# BTY Create Training — Redesign Preflight V1

**Status:** read-only audit · no source, migration, database or deployment change
**Repository HEAD:** `7657a97f5bbdc275ae4c6e252383d74863d15913` (inner-main, tracked tree clean)
**Audit date:** 2026-08-05 · **reconciled R2** 2026-08-05

> ### FORMAL VERDICT CORRECTION
>
> **R1's verdict is corrected to `B — CURRENT JOURNEY INVENTORY INCOMPLETE`.** R1 shipped an
> unresolved approval-reachability risk while reading as redesign-ready; that combination was not
> safe to implement from.
>
> **R2 resolved the entire source side** (§§2.1–2.4 below) and returns
> `D — AUTHENTICATED REACHABILITY GATE REQUIRED`: the remaining unknown is browser-observable
> only, and no Foundry Host session exists in the audit shell.

---

## 0. AUTHORITY NOTE — CORRECTED IN R2

⚠️ **R1's authority findings were wrong in two material ways. Both are corrected here.**

R1 searched for the *directive's* vocabulary rather than the *repository's own*, and concluded that
no canon and no authority hierarchy existed. Both conclusions were false.

### 0.1 An authority hierarchy DOES exist — Constitution Article X

`docs/BTY_PRODUCT_CONSTITUTION.md` **Article X — Documentation Law** declares it:

> Only three document **types** grow the permanent product record:
> 1. **Constitution** — this file; almost never changes
> 2. **Architecture** — one doc per major system when that system is born
> 3. **Decision Records (ADR)** — why a specific choice was made; append-only
>
> Everything else is either code or disposable planning.
> **New documents are the last resort.**

⚠️ **This document is category 4 — disposable planning.** It is not Constitution, Architecture or
ADR. Under Article X it should be read as working analysis, not permanent record, and any durable
conclusion belongs in an ADR instead. R1's recommendation to create a
`docs/CANONICAL_DOCUMENT_AUTHORITY.md` is **withdrawn** — it would violate Article X and duplicate
a hierarchy that already exists.

### 0.2 The canon exists under different names

| Directive term | Repository's actual canon | Location |
|---|---|---|
| Reality Bridge | **Reality Engines** (Article IV) | `BTY_PRODUCT_CONSTITUTION.md:54` |
| Learning OS / Product Architecture | **Culture Operating System** (Article I) | `BTY_PRODUCT_CONSTITUTION.md:11` |
| Evidence floor / rung | **Evidence Ladder** + **ADR-005 Evidence vs Verification** | `module-draft.ts:137`, `decisions/ADR-005-*.md` |
| — | **ADR-003 Verified Learning Engine** | `decisions/ADR-003-*.md` |
| Arena constitution | `ARENA_CANONICAL_CONTRACT.md` (named in Article XI's related docs) | — |

**REPOSITORY ABSENT ≠ PROJECT ARTIFACT ABSENT.** Where this document says "absent", it means *not
found in this repository at this HEAD under the searched name*. Several items R1 called absent were
present under the repository's own vocabulary. Nothing here claims a document does not exist
globally.

Still not found under any name: a *QR Trigger Engine* spec, an *AI Routing Engine* spec, a
*Memory / Delayed Outcome Engine* spec, and any *Create Training / Guided Builder* documentation.

### 0.3 Governor status against the real canon

The directive's Governors are **not** a foreign framework — most restate existing constitutional
law, which strengthens them:

| Governor | Constitutional basis | Status |
|---|---|---|
| 1 — Reality First | Article IV (Reality Engines), Article V (Verification) | ✅ canon |
| 2 — AI draft, human commit | Article IV ("engines submit verified reality") | ✅ consistent |
| 3 — Existing engine integration | Article IX (System Boundaries), ADR-003 ("same contract") | ✅ canon |
| 4 — Evidence floor | ⚠️ **partly new.** ADR-005 separates *verification* (awards Core XP) from *evidence* (patterns, awards nothing). The directive's rung-per-gap floor is **not** in canon and would need its own ADR. | 🟡 proposal |
| 5 — Version integrity | not in canon; implemented in code | ✅ implemented |
| 6 — Locale authority | not in canon | 🔴 absent |

⚠️ **Governor 4 needs care.** ADR-005 fixes a distinction this audit must not blur: *verification*
answers "did this happen?" and is the only Core XP path; *evidence* answers "what does behavior
suggest?" and awards nothing. ADR-003 adds that learning consumption awards nothing without
verification. A "minimum evidence rung" that gates *publishing* is compatible with both — but it
must never be described as an XP or verification path. Table D below is therefore a **publishing
gate proposal**, not a verification change.

---

## 1. CONSTITUTIONAL RECONCILIATION — corrected

R1 framed this as "one written rule versus one undocumented phrase". That was wrong: **Article I
already answers it.**

```
Article I:  "BTY (Better Than Yesterday) is a Culture Operating System."
Article II: "not ... a course platform whose goal is content completion"
Boot §:     "BTY is not a learning platform."
```

So the repository already says BTY *is* an operating system and is *not* a course/content platform.
The proposed wording is a near-restatement:

> BTY is not a content-consumption LMS or a gamified completion system.
> BTY is a Learning OS connecting intended change, learning, practice, reality, evidence,
> follow-up and organizational memory.

**Evaluation:** substantively consistent with Articles I and II and with ADR-003. One caution — the
canon's noun is **"Culture Operating System"**, not "Learning OS". Article I is deliberate: BTY
deals with behavior and culture, and Learning is *one of three* Reality Engines (Article IV), not
the whole system. Calling the whole system a "Learning OS" would demote Action and Event Engines to
subordinates of Learning, which Article IV does not support.

**Recommendation:** adopt the *spirit* but keep the canonical noun —

> BTY is a **Culture Operating System**. It is not a content-consumption LMS or a gamified
> completion system. It connects intended change, learning, practice, reality, evidence, follow-up
> and organizational memory — with Learning as one Reality Engine among Action and Event.

Per Article X this belongs in an **ADR**, not in a new document and not by editing the Constitution.
**No LOCK or Constitution file was modified.**

---

## 2. THE ACTUAL CREATE TRAINING JOURNEY (measured)

Entry: `CreateFoundryEventForm.tsx` (quick path) and `ModuleBuilderShell.tsx` (the 7-step
builder, 1,440 lines). Copy: `moduleBuilderCopy.ts` (920 lines, en + ko).

**Two parallel creation paths exist**, which is itself a finding:

| Path | Component | Steps | Produces |
|---|---|---|---|
| Quick create | `CreateFoundryEventForm` | 1 screen | event with `title`, `youtube_url`/PDF, `completion_prompt` |
| Guided builder | `ModuleBuilderShell` | 7 steps | module draft → approved → published event |

`stepProgress: (n) => "Step ${n} of 7"`.

Revision entry: `revisionTitle: "Create new version"` with
`revisionNote: "Your current published training will remain unchanged."`

---

## 2.1 R2 — APPROVAL REACHABILITY: **RESOLVED BY SOURCE**

R1's unresolved risk #1 is closed. The system has **two different approval validators**, and only
one is wired.

| | Legacy (Slice 1) | **Real (in use)** |
|---|---|---|
| Function | `validateModuleDraft` | `builderApprovalErrors` / `isBuilderApprovable` |
| File | `domain/foundry/module/module-draft.ts:305` | `domain/foundry/module/module-publish.ts:34` |
| Requires | `capability`, `targetRoles`, **`reflectionPrompt`**, **`actionDecisionPrompt`**, `problem`, `observableBehavior`, `successEvidence` | `stepBlocker(1..7)` + `material_youtube_url_required` |
| Called by | ⛔ **nobody** | ✅ `foundryModuleService.ts:267` (`draftReadinessErrors` → `approve`) |

`module-publish.ts:9-15` states the reason in-source:

> *"the Slice-1 `validateModuleDraft` was written for a conceptual field set (capability /
> targetRoles / reflectionPrompt / actionDecisionPrompt) that the actual manual builder never
> captures. The builder's own per-step completeness (`stepBlocker`) is the truthful definition of
> 'ready', so approval is derived from it here — the single source both approve and publish
> consult."*

⚠️ **Name-collision caution for future auditors:** a *second, unrelated* `validateModuleDraft`
exists at `module-draft-copilot.ts:284` and **is** live — it validates the AI copilot's parsed
output (`moduleDraftCopilotService.ts:125`). A naive grep for callers of "validateModuleDraft"
finds that one and wrongly concludes the legacy gate is wired. Verified by import source.

**Conclusion:** approval is reachable through the real Builder. `reflectionPrompt` and
`actionDecisionPrompt` are **not required** by any live path.

### 2.2 R2 — REFLECTION / ACTION DECISION PROMPT CONTRACT

| | Result |
|---|---|
| Write paths in Builder | **none** |
| Write paths anywhere | **none** (only test fixtures) |
| Read paths | only `REQUIRED_TEXT_FIELDS` in the dead legacy validator |
| In `SNAPSHOT_ANSWER_KEYS`? | **No** |
| AI generation | none |
| Host-editable surface | none |
| Approval requirement | dead-path only |
| Can empty/fabricated value pass? | n/a — never evaluated |

**Single source of truth: neither field has one.** They are unimplemented Slice-1 concepts. The
identically-named Arena `reflectionPrompt` (`OutputPanel`, `ReflectionBlock`, `i18n.ts`) is a
**different, unrelated** learner-facing string — do not conflate them.

**Verdict: DELETE from `ModuleDraftAnswers`, or implement deliberately.** Not a blocker today.

### 2.3 R2 — EVIDENCE FIELD FORENSICS

⚠️ **Correction to R1.** R1 said `evidenceType` has "no downstream reader at all". That
under-described it: `evidenceType` **is** frozen into the immutable module snapshot.

| Field | UI writer | Sanitizer | In snapshot? | Readers | Classification |
|---|---|---|---|---|---|
| `evidenceType` | ✅ `ModuleBuilderShell.tsx:773` | ✅ `module-builder.ts:282` | ✅ **`SNAPSHOT_ANSWER_KEYS`** (`module-publish.ts:172`) | ⛔ none | **B — snapshot-only legacy data** |
| `evidenceLevel` | ⛔ none | ⛔ none | ⛔ **not in snapshot** | dead gate only | dead |
| `evidenceSource` | ⛔ none | ⛔ none | ⛔ **not in snapshot** | dead gate only | dead |
| `evidence_type` / `evidence_level` / `evidence_source` | — | — | — | — | **no SQL column exists** |

**Deletion safety:** `evidenceType` is **not** class A (completely dead). It is persisted into
immutable snapshots that already exist in production. Removing the question is safe; removing the
key from `SNAPSHOT_ANSWER_KEYS` changes snapshot shape for future modules and must be a deliberate
decision, not a cleanup.

### 2.4 R2 — HONESTY GATE REACHABILITY: **B — IMPLEMENTED BUT UNREACHABLE**

`validateEvidenceHonesty` is called from exactly one place: `module-draft.ts:339`, inside the
legacy `validateModuleDraft`.

It is unreachable for **two independent reasons**, either of which alone would suffice:

1. **The containing validator is never called** (§2.1).
2. **Its entry condition is never true** — `if (a.evidenceLevel !== undefined || a.evidenceSource
   !== undefined)` and neither field is ever written (§2.3).

Overclaims it *would* reject if wired — e.g. `completion` + `applied`, `self_report` + `observed`,
`system_practice` + `sustained` → `evidence_overclaim`.

**Approval today bypasses it entirely by omitting both fields.** Nothing prevents publishing a
module whose only evidence is completion.


### 2.5 R2B — CORROBORATION FROM REAL HOST-AUTHORED DRAFTS (server-side, not rendered)

The authenticated *browser* journey remains unmeasured (see risk 8). However, three real editable
drafts authored by an **active Foundry Host** were read server-side, and their stored `answers`
key sets independently corroborate the source conclusions:

| Draft | Step | Stored `answers` keys |
|---|---|---|
| `093b0361` | **8 (Preview)** | problem, audienceType, **evidenceType**, followUpDays, materialText, **clarification**, learningNeeds, materialIntent, successEvidence, arenaRecommended, completionPrompt, observableBehavior |
| `f48414b4` | 2 | problem, audienceType |
| `2363c6f5` | 1 | *(none)* |

A draft that has reached **step 8** carries **no** `capability`, `reflectionPrompt`,
`actionDecisionPrompt`, `evidenceLevel` or `evidenceSource`. This is real Host data, and it
confirms four source conclusions at once:

- ✅ `evidenceType` **is** written by the real journey (§2.3).
- ✅ `capability` is **not** collected — yet the legacy validator requires it, so that validator
  cannot be the live gate (§2.1).
- ✅ `reflectionPrompt` / `actionDecisionPrompt` are never written (§2.2).
- ✅ `evidenceLevel` / `evidenceSource` are never written, so the honesty gate cannot fire (§2.4).

⚠️ **New field found — `clarification` (missing from Table A).** `module-builder.ts:122` — an
"Adaptive Clarification (Slice 2.4C)" structure with its own sanitization in `clarification.ts`. It
is **written by the real journey** and is **NOT** in `SNAPSHOT_ANSWER_KEYS`, so it is authoring-only
and does not survive into the immutable snapshot. It must be added to any complete question
inventory; R1's Table A is therefore incomplete by at least one item.

⚠️ **Also absent from Table A:** `realityGroundedJourneyV1` **is** in `SNAPSHOT_ANSWER_KEYS`
("Reality-Grounded Journey V1", Slice 3.2C-B3A) — a Host-approved participant-facing Journey frozen
into the snapshot. Table A does not cover it.

**Consequence:** the R1 inventory is **not exhaustive**. Phase 1 must not proceed on the assumption
that Table A lists every field.


---

## 2.6 R2C — COMPLETE BUILDER KEYSPACE (source ∩ real data)

**The keyspace is now closed.** The `BuilderAnswers` type declares **16** keys; a read-only
aggregation over **all 27** module drafts (24 published, 3 editable) found **exactly 16** distinct
keys. No unknown key exists in production data.

| Key | Draft rows | In snapshot? | Snapshot rows | Lifecycle class |
|---|---|---|---|---|
| `problem` | 26 | ✅ | 24/24 | **A** authoritative Host fact |
| `audienceType` | 26 | ✅ | 24/24 | **A** |
| `evidenceType` | 25 | ✅ | **24/24** | **E→A** (see §2.8) |
| `followUpDays` | 25 | ✅ | 24/24 | **G** runtime policy |
| `learningNeeds` | 25 | ✅ | 24/24 | **A** |
| `materialIntent` | 25 | ✅ | 24/24 | **A** |
| `successEvidence` | 25 | ✅ | 24/24 | **A** |
| `completionPrompt` | 25 | ✅ | 24/24 | **F** participant-facing |
| `observableBehavior` | 25 | ✅ | 24/24 | **A** |
| `capabilityCandidate` | **22** | ⛔ **no** | **0/24** | **D** authoring-only — *dropped at approval* |
| `arenaRecommended` | 16 | ✅ | 15/24 | **G** |
| `sharedQuestion` | **8** | ⛔ **no** | **0/24** | **F** — compiled to the *document* row, not the snapshot |
| `audienceDetail` | 7 | ✅ | 7/24 | **A** |
| `materialText` | 7 | ✅ | 6/24 | **A** |
| `clarification` | **1** | ⛔ by design | 0/24 | **D** authoring-only transient |
| `realityGroundedJourneyV1` | **1** | ✅ | **1/24** | **F** compiled participant artifact |
| `learningNeed` (legacy singular) | 0 | ✅ whitelisted | 0/24 | **E** legacy, still read by `normalizeLearningNeeds` |

Snapshot whitelist = **15** keys; **13** observed in real snapshots (`learningNeed` and one other
never populated). `module_version` distribution: **v1 × 23, v2 × 1**.

⚠️ **Answer to Part 6 Q4 — silently dropped at approval:** `capabilityCandidate` (22 drafts!),
`sharedQuestion` and `clarification` never reach the immutable snapshot. `sharedQuestion` is not
lost — it compiles into the document row — but **`capabilityCandidate` is**. R1's item A4 called
capability "required at approval"; the truth is the opposite: it is collected on 22 of 27 drafts
and then **discarded**.

## 2.7 R2C — `clarification` AND `realityGroundedJourneyV1` CONTRACTS

Both are documented in-source with explicit intent, so neither needed inference.

**`clarification`** (`module-builder.ts:118-127`) — *"Adaptive Clarification (Slice 2.4C) — the
resumable pre-draft Q&A state. **Assistive scratch, NOT a canonical published field**: deliberately
excluded from `SNAPSHOT_ANSWER_KEYS`, **never overwrites a canonical Builder field**, and survives
refresh only because it rides the same `answers` jsonb."* Bounds: 6 answers, 300 chars each.
→ **D — AUTHORING_ONLY_TRANSIENT.** Deliberate exclusion, not an oversight. **No contract defect**:
it never becomes authoritative output, so nothing authoritative loses provenance.

**`realityGroundedJourneyV1`** (`journey.ts:51`) — *"the Host-approved participant-facing structured
experience … frozen into the module snapshot at publish (**it IS a canonical published field**)."*
→ **F — PARTICIPANT_FACING_COMPILED_ARTIFACT.**

⚠️ **This changes the R1 picture materially.** Its element kinds are:

```
why_it_matters · observable_standard · scenario · reflection · action_decision
· field_application · evidence · completion_check
```

So **`reflection` and `action_decision` are alive** — as *Journey element kinds*, not as the dead
flat `reflectionPrompt` / `actionDecisionPrompt` fields. Journey V1 is the **successor** to the
Slice-1 flat concepts. R1 concluded those concepts were unimplemented; more precisely, **the flat
fields are dead and the concepts were re-homed.**

Required-before-approval kinds: `why_it_matters`, `observable_standard`, `completion_check`.
`displayTitleStatus` must be `grounded` — *"The learner title must be Host-approved, never silently
the raw problem phrase."*

**Adoption: 1 of 24 published modules.** This is new and almost unused, so the Builder is *not yet*
producing a complete participant Program for the other 23.

## 2.8 R2C — ⚠️ THE JOURNEY APPROVAL GATE IS CLIENT-SIDE ONLY

`journey.ts` marks missing required elements `needs_confirmation`, *"which blocks approval"*, and
`ModuleBuilderShell.tsx:530-535` renders `journey-publish-blocked` when `!journeyApprovable`.

But the **server** gate — `builderApprovalErrors` (`module-publish.ts:34-45`) — checks only
`stepBlocker(1..7)` and `material_youtube_url_required`. `draftReadinessErrors` adds only
`material_pdf_required`. **Neither reads `realityGroundedJourneyV1`.**

**Consequence:** the "Host must confirm the learner title and every element" rule is enforced by
the browser alone. A request that does not go through the UI could approve a module whose Journey
still contains `needs_confirmation` elements — and the learner would then receive participant-facing
content **no human confirmed**. This is precisely the class of gap R5C-4A2 closed for generation
governance (client-derived authority), reappearing in the approval path.

**Not verified:** whether some other server path enforces it. Recorded as a **suspected defect**,
not a proven one.

## 2.9 R2C — FINAL `evidenceType` CLASSIFICATION

**A — REQUIRED LEGACY SNAPSHOT CONTRACT.**

Present in **24 of 24** immutable snapshots — universal. It is written by the UI, sanitized, and
frozen, with **no proven reader**. Under ADR-005 it is *evidence* vocabulary ("what does behavior
suggest?"), never *verification*, so it can never have been an XP path.

⛔ **Do not delete the snapshot key.** Every existing published module carries it; removing it from
`SNAPSHOT_ANSWER_KEYS` changes the shape of a contract that 24 live records already satisfy.
✅ **Safe to stop asking the question** (step 4's "How would this be verified?") — that is a UI
change only.

**ADR-005 exposure check:** approval requires no evidence level and no verification actor, so a
module whose only evidence is completion can be published and will *look* the same as one backed by
manager observation. Completion **cannot** masquerade as Core XP (ADR-003/005 hold that line at the
Reality Engine), but it **can** masquerade as *sufficient program design* at publish time. That is
the real exposure, and it is a **publishing-gate** gap, not a verification gap.

## 2.10 R2C — STEP REGISTRY: 7 INPUT STEPS + STEP 8 = REVIEW

`BUILDER_STEP_MIN = 1`, `BUILDER_STEP_MAX = 8` (`module-builder.ts:49-50`), while
`APPROVAL_STEPS = [1..7]` and the copy says `"Step ${n} of 7"`.

**Reconciliation:** there are **7 input steps** (each with a `stepBlocker`) plus **step 8 = the
Review/Preview surface**, which has no blocker and is not part of `APPROVAL_STEPS`. The observed
step-8 draft is therefore a draft sitting *on Review*, not an eighth question. Host-facing "of 7"
is correct; stored `current_step` 8 is correct. **No discrepancy.**

---

## 2.11 FOUNDER BROWSER CHECKLIST — draft `093b0361`

Use `093b0361` (step 8 / Review, full answers), **not** `2363c6f5` (empty shell — it cannot show
the journey without saving). Verify only what a browser can see:

1. **Steps** — how many does the product say, and what is each one's exact title?
2. **Step 4** — is there a "How would this be verified?" question with four choices? Does the screen
   explain what that answer *does*? (Source says: nothing.)
3. **Clarification** — do extra adaptive questions appear before the main steps? Are they labelled
   as optional/assistive?
4. **Preview (step 8)** — list every section shown. Does it show a participant-facing Journey
   (why it matters / observable standard / reflection / action decision / evidence / completion)?
5. **"Needs confirmation"** — do any elements or the learner title show that state? Does the screen
   explain what must be confirmed?
6. **Approval control** — exact button label, enabled or disabled, and the exact blocker text.
7. **Interception** — DevTools → Network → Offline (or block the approval route), press approve
   **once**, capture the request payload, restore Online, do not retry.
8. **Integrity** — confirm the draft is still `draft`, and nothing was published.


---

## 2.12 R2D — ⚠️ §2.8 IS **REFUTED**. SERVER AUTHORITY IS COMPLETE.

R2C suspected the Journey confirmation gate was client-side only. **That was wrong**, and the
error was mine: I inspected the *approve* validator and concluded from its silence, without
tracing the *publish* path — where the snapshot is actually built.

### The complete approval/publish call graph

| # | Entrypoint | Route | Service | Mutation |
|---|---|---|---|---|
| 1 | Approve | `api/bty/foundry/modules/[id]/approve` | `approveDraft` | `status: draft→approved`. **No snapshot, no event, no participant-servable state.** |
| 2 | **Publish** | `api/bty/foundry/modules/[id]/publish` | `publishDraft` | Creates event + **immutable `module_snapshot`** + assignments |

These are the **only** two callers; no server action, RPC, job or admin script mutates module
approval state. Both are behind `requireManager` → `isActiveFoundryHost`.

### The gate, in `foundryPublishService.ts:211-223`

```ts
// Readiness (the approval gate) — enforced at publish even in the one-tap flow.
const errors = await draftReadinessErrors(admin, draftId, answers);
if (errors.length > 0) return { ok: false, reason: errors[0] ?? "draft_incomplete" };

// Publish is blocked unless the Journey is fully grounded (no needs_confirmation).
const journey = answers.realityGroundedJourneyV1;
const journeyEnabled = journey !== undefined;
if (journeyEnabled && !isJourneyApprovable(journey)) {
  return { ok: false, reason: "journey_not_approved" };
}
```

`isJourneyApprovable` (`journey.ts:168`) requires **all three**: schema valid,
`displayTitleStatus === "grounded"`, and **every** element `confirmationStatus === "grounded"`.

Both checks run **before** any write. The participant title and completion question are then taken
*from the approved Journey* — *"never the raw problem first line or a raw completionPrompt that
bypassed review."*

### Server authority case matrix

| Case | Result | Layer | Code |
|---|---|---|---|
| A — Journey absent | ✅ allowed (legacy path) | publish | — |
| B — all confirmed | ✅ allowed | publish | — |
| C — any element `needs_confirmation` | ⛔ **rejected** | publish | `journey_not_approved` |
| D — `reflection` unconfirmed | ⛔ rejected | publish | `journey_not_approved` |
| E — `action_decision` unconfirmed | ⛔ rejected | publish | `journey_not_approved` |
| F — unknown element kind | ⛔ rejected | `validateJourney` | `journey_not_approved` |
| G — malformed schema | ⛔ rejected | `validateJourney` | `journey_not_approved` |
| H — stale confirmation | ⚠️ **not detectable** — status is a flag, not content-bound (see below) | — | — |
| I — Journey edited after confirmation | ⚠️ same as H | — | — |
| J — direct request bypassing the UI | ⛔ **rejected** — the gate is in the service, not the component | publish | `journey_not_approved` |

**Case J is the one that mattered, and the server holds.**

⚠️ **Residual weakness (H/I), lower severity.** `confirmationStatus` is a flag on the element, not
a hash of its content. Source shows editing an element re-persists it with `"grounded"`
(`JourneyPreview.tsx:108`), so an edit *through the UI* re-confirms deliberately. But nothing binds
a confirmation to the exact text it was given for — a direct write could set `grounded` alongside
different content. Bounded by the same Host-only authorization, so it is a **provenance** gap, not
an authority gap. Recorded, not repaired.

### An approved module is not participant-servable

`approveDraft` only flips a status. No snapshot, no event, no assignment. So even an "approved"
module with an unconfirmed Journey reaches no learner — **publish is the only participant harm
boundary, and it is guarded.**

### Existing data — clean

| Measure | Count |
|---|---|
| Approved snapshots | **24** |
| With `realityGroundedJourneyV1` | 1 |
| All elements grounded | **1** |
| Containing `needs_confirmation` | **0** ✅ |
| Malformed | **0** ✅ |
| Unpublished drafts holding an unconfirmed Journey | **0** |

Observed: `version v1`, `displayTitleStatus grounded`, kinds `why_it_matters · observable_standard ·
reflection · evidence · completion_check`. **No integrity incident exists.**

### Test coverage — the gate is genuinely tested

`foundryPublishService.test.ts:259-268` — *"BLOCKS publish while the Journey is not fully grounded
(needs_confirmation) — nothing created"*, asserting `journey_not_approved`, an empty
`foundry_event_module`, and `createTrainingEvent` never called. This is a **server-service** test,
not a client-helper test, so it is not false confidence.

⚠️ Not covered: stale/content-drifted confirmation (H/I).

### Correction to §2.8

**§2.8's "suspected defect" is withdrawn.** Journey confirmation is enforced server-side at publish
with a stable code, before mutation, on the only path that can reach a learner. The lesson for this
audit: `builderApprovalErrors` is the *approve* gate, not the *publish* gate — reasoning from one
validator's silence produced a false alarm.


---

## TABLE A — CURRENT JOURNEY INVENTORY

| Item ID | Journey | Step | Exact user-facing question | Control | Stored field | Required | Answer changes what? | Downstream use | User understands why? | Duplication |
|---|---|---|---|---|---|---|---|---|---|---|
| **A1** | Builder | 1 | "What keeps going wrong?" | textarea | `answers.problem` | Yes (`problem_required`) | AI direction input; review display | DirectionCopilot input; review screen | **Yes** — help text names the failure mode | — |
| **A2** | Builder | 2 | "Who needs to do something differently?" | option + detail | `answers.audienceType`, `audienceDetail` | Yes (`s2Blocker`) | Assignment recipient set | `foundryAssignmentPublishService` | Partly — preview note is long and defensive | — |
| **A3** | Builder | 3 | "After this training, what should they do differently?" | textarea | `answers.observableBehavior` | Yes | Arena generation input; review | `ScenarioGenInput.facts.observableBehavior` | **Yes** | — |
| **A4** | Builder | 3 | "Capability (optional)" | text | `answers.capability` / `capabilityCandidate` | **Yes at approval** (`capability_required`) | Review display | Arena `facts.problem` | **No** — labelled optional, blocks approval | ⚠️ two fields, one concept |
| **A5** | Builder | 4 | "After the training, what would show that people are doing this differently?" | textarea | `answers.successEvidence` | Yes | Arena generation input | `facts.successEvidence` | **Yes** | — |
| **A6** | Builder | 4 | "How would this be verified?" | 4 options | `answers.evidenceType` | No | **Nothing** | ⚠️ **frozen into snapshot, never read** (§2.3) | **No** | ⚠️ parallel to `evidenceSource` |
| **A7** | Builder | 5 | "What does this training need to include?" | multi-select | `answers.learningNeeds` | Yes (`s5Blocker`) | Arena hint; `learning_type_required` | `facts.learningNeeds`; validation | Partly | ⚠️ legacy `learningNeed` singular also exists |
| **A8** | Builder | 6 | "What will people learn from?" | option + upload | `materialIntent`, `materialText`, `document_asset_ref` | Yes (`s6Blocker`) | Delivery | Event publish | **Yes** | — |
| **A9** | Builder | 7 | "Should people practice this in Arena?" | yes/no | `answers.arenaRecommended` | No | Arena recommendation | Practice creation | Partly | — |
| **A10** | Builder | 7 | "When should you check what happened?" | none/7/30 | `answers.followUpDays` | Yes (`s7Blocker`) | Follow-up scheduling | `module_snapshot.followUpDays` → `foundryFollowupService` | **Yes** | — |
| **A11** | Builder | review | (completion question) | text | `answers.completionPrompt` | No | Learner completion prompt | `module_snapshot.completionPrompt` | Partly | ⚠️ also collected in quick path |
| **A12** | Builder | review | (shared understanding question) | text | `answers.sharedQuestion` | No | Host-reviewable answer | `shared_understanding_response` | Partly | — |
| **A13** | Quick | 1 | Title / material / completion prompt | text | event columns | Yes | Event creation | Event runtime | **Yes** | ⚠️ **entire path duplicates A1–A11** |
| **A14** | Domain only | — | *(never asked)* | — | `answers.evidenceLevel` | No | Honesty gate | `validateEvidenceHonesty` | **N/A — never collected** | ⚠️ dead |
| **A15** | Domain only | — | *(never asked)* | — | `answers.evidenceSource` | No | Honesty gate | `validateEvidenceHonesty` | **N/A — never collected** | ⚠️ dead |
| **A16** | Domain only | — | *(never asked)* | — | `answers.reflectionPrompt` | ⚠️ **No — dead validator only** (§2.1) | nothing | — | **N/A — never collected** | ⚠️ unimplemented Slice-1 concept |
| **A17** | Domain only | — | *(never asked)* | — | `answers.actionDecisionPrompt` | ⚠️ **No — dead validator only** (§2.1) | nothing | — | **N/A — never collected** | ⚠️ unimplemented Slice-1 concept |

---

## TABLE B — PRODUCT, AI AND APPROVAL CONTRACT

| Item ID | Verdict | Why needed | Truth provider | AI role | AI may infer? | Must ask user? | Ask only when | Approval authority | Publish blocker | Internal-only? |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | **KEEP** | The only irreducible fact | Host | none | No | **Yes** | Always | Host | Yes | No |
| A2 | **KEEP** | Determines recipients | Host | none | No | **Yes** | Always | Host | Yes | No |
| A3 | **AI_GENERATE** → Host confirms | Derivable from A1 | AI draft, Host commit | **Yes** | Confirm only | Always | Host | Yes | No |
| A4 | **MERGE** into A3 | Same concept, two fields | AI draft | Yes | No | — | Host | Yes | ⚠️ label says optional |
| A5 | **AI_GENERATE** → Host confirms | Derivable from A3 | AI draft, Host commit | **Yes** | Confirm only | Always | Host | Yes | No |
| A6 | **DELETE** or **PROMOTE** | Currently governs nothing | — | — | — | — | — | No | **Yes — vocabulary leak** |
| A7 | **AI_GENERATE** → Host confirms | Derivable from A1+A3 | AI draft | **Yes** | Confirm only | Always | Host | Yes | Partly |
| A8 | **KEEP** | External artifact | Host/SME | none | **No** | **Yes** | Always | Host | Yes | No |
| A9 | **CONDITIONAL** | Derivable from gap | Deterministic | **No** (§9) | Only to override | practice/pressure gap | Host | No | No |
| A10 | **CONDITIONAL** | Derivable from evidence level | Deterministic | **No** | Only to override | evidence ≥ applied | Host | Yes | No |
| A11 | **AI_GENERATE** | Derivable | AI draft | Yes | Edit only | Always | Host | No | No |
| A12 | **CONDITIONAL** | Only when Host review is wanted | Host | Draft | No | shared-standard need | Host | No | No |
| A13 | **DELETE (fold into builder)** | Duplicate path | — | — | — | — | — | — | — |
| A14/A15 | **PROMOTE — derive, do not ask** | The floor mechanism | Deterministic | **Never** | **No** | Derived at step 4 | System + Host raise | **Should be** | No |
| A16/A17 | **AI_GENERATE or DELETE** | Block approval, never collected | AI draft | Yes | No | — | Host | **Yes — currently unsatisfiable** | Yes |

---

## TABLE C — COMPILE, RUNTIME, VERSION AND LOCALE

| Item ID | Compile target | Existing engine target | Runtime materialization | Version behavior | Existing learner | Historical evidence | Canonical locale | Translation producer | Locale approval gate | New-layer risk | DO NOT TOUCH |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `module_snapshot` | Foundry module | — (authoring only) | **FREEZE** ✅ | pinned by snapshot | retained | ⚠️ **none declared** | none | ⛔ **absent** | Low | — |
| A2 | audience snapshot | `bty_foundry_publish_assignments` | assignment rows at publish | **FREEZE** ✅ (atomic snapshot) | frozen at publish | retained | n/a | n/a | n/a | Low | **assignment transaction** |
| A3/A5 | `module_snapshot` → `ScenarioGenInput.facts` | Arena generation | practice draft | **FREEZE** ✅ | pinned | retained | ⚠️ none | none | ⛔ absent | Medium | **Arena source binding** |
| A6 | ⛔ **nothing** | ⛔ none | ⛔ none | n/a | n/a | n/a | n/a | n/a | n/a | — | — |
| A7 | `module_snapshot` | validation + Arena hint | — | **FREEZE** ✅ | pinned | retained | n/a | n/a | n/a | Low | — |
| A8 | event material | Foundry event | learner delivery | **FREEZE** ✅ | pinned | retained | source-locale | none | ⛔ absent | Low | **PDF bucket** |
| A9 | practice flag | Arena publish | published practice | **FREEZE** ✅ (`source_module_version`) | pinned | retained | per-request | n/a | n/a | Medium | **`foundryArenaPublishService`** |
| A10 | `module_snapshot.followUpDays` | `foundryFollowupService` | follow-up obligation | **FREEZE** ✅ | pinned to frozen snapshot | retained | n/a | n/a | n/a | Low | **follow-up scheduler** |
| A11 | `completion_prompt` | Foundry event | completion screen | **FREEZE** ✅ | pinned | retained | source-locale | none | ⛔ absent | Low | — |
| A12 | `shared_question` | Foundry event | `shared_understanding_response` | **FREEZE** ✅ | pinned | retained | source-locale | none | ⛔ absent | Low | **privacy split (R5B-3G)** |

**Version contract — measured, and it is GOOD:** `foundryModuleService.ts:89-111` — a revision
creates a **new draft** with `nextModuleVersion(parent.module_version)` and a `parent_module_id`
lineage link, and *"The parent is never mutated"*. Approved/published modules refuse edits
(`status = 'draft'` guard on update and delete). `source_module_version` is carried into published
practices. **Governor 5's immutable-snapshot hypothesis is substantially implemented.**

⚠️ **Gap:** no forced-migration contract exists. Nothing was found that migrates in-progress
learners to a new revision, nor any governed decision to do so. Report as **absent**, not implied.

---

## TABLE D — GAP, EVIDENCE FLOOR AND REALITY BRIDGE `[DIRECTIVE-SOURCED POLICY]`

⚠️ **Every "Minimum evidence rung" below is the directive's proposed policy, not current
behavior.** Current behavior is column "Today".

⚠️ **ADR-005 boundary.** This table proposes a **publishing gate** — what a Host must define before
a program may be published. It is **not** a verification path and **not** an XP path. Per ADR-005,
*verification* ("did this happen?") is the only Core XP route; *evidence* ("what does behavior
suggest?") awards nothing. Per ADR-003, learning consumption awards nothing without verification.
Nothing in this table may be implemented as an award trigger.

| Item ID | Diagnosed gap (`learningNeeds`) | Diagnosis source | Minimum rung `[DIRECTIVE]` | Today | Required activity | Arena | Verification actor | Follow-up | Downgrade permitted? | Non-training intervention |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Information ("need to understand") | A7 | `reflected` (≈Understood) | **none enforced** | material + completion | No | learner | optional | No | — |
| D2 | Decision ("judgment or commitment") | A7 | `decided` | **none enforced** | material + action decision | No | learner | optional | No | — |
| D3 | Practice ("rehearse the behavior") | A7 | `practiced` | **none enforced** | Arena run | **Required** | `system_practice` | 7d | No | — |
| D4 | Practice + behavior transfer matters | A7 + A5 | `applied` | **none enforced** | Arena + Reality | Required | `manager_observation` | 7/30d | No | — |
| D5 | Shared standard | A7 | `decided` + shared question | **none enforced** | material + A12 | No | Host | optional | No | — |
| D6 | Physical / operational skill | ⛔ **not diagnosable today** | `observed` | **n/a** | — | — | `manager_observation` | required | No | — |
| D7 | Process / authority / tool gap | ⛔ **not diagnosable today** | **cannot publish as training** | **n/a — publishes freely** | — | — | — | — | — | **Required** |

### The decisive finding

**The Evidence Ladder exists and is unreachable.**

`src/domain/foundry/module/module-draft.ts` defines:

```
EVIDENCE_LADDER = exposed | reflected | decided | practiced | applied | observed | sustained
VERIFIED_BEHAVIOR_LEVELS = applied | observed | sustained
evidenceSourceCanClaim():  completion/self_report → ≤ decided
                           system_practice        → ≤ practiced
                           manager_observation    → any rung
validateEvidenceHonesty(): rejects `evidence_overclaim`
```

That is a correct, well-reasoned anti-vanity mechanism. **It never runs.** Measured:

- `evidenceLevel` and `evidenceSource` are **never set** anywhere in `src/components/foundry/**`.
- The gate is conditional: `if (a.evidenceLevel !== undefined || a.evidenceSource !== undefined)`
  (`module-draft.ts:338`). Both are always undefined, so the branch is never entered.
- The builder instead collects `evidenceType` (Observed / Heard / Recorded / Confirmed) at step 4,
  which has **no downstream reader at all**.

**Consequences, all currently true:**

1. Vanity completion is fully permitted — a module may publish with completion as its only evidence.
2. No floor is derived from the diagnosed gap; `learningNeeds` influences only an Arena *hint*.
3. Step 4's "How would this be verified?" is the clearest instance of the Founder's complaint: an
   earnest question whose answer changes nothing.
4. D6 and D7 are not diagnosable — the four `learningNeeds` options cannot express a physical-skill
   gap or a process/authority/tool gap, so the "training cannot solve this" outcome is unreachable.

✅ **RESOLVED IN R2 — this is NOT blocking.** `REQUIRED_TEXT_FIELDS` lives in the *legacy*
validator, which nothing calls. The live approval gate is `builderApprovalErrors` (§2.1), and it
does not read either prompt. Approval is reachable.

---

## 3. AI INVOCATION AUDIT (measured)

| Insertion point | Component | Input | Output | Approval | Failure | Can affect runtime truth? |
|---|---|---|---|---|---|---|
| **Direction Copilot** | `DirectionCopilot.tsx` | A1 problem | 3 directions (capability, why, behavior, evidence, assumption) | ✅ explicit "Apply" | `continueWithout`, `rateLimited`, `staleTitle` | **No** — draft only |
| **Module Draft Copilot** | `ModuleDraftCopilot.tsx` | draft answers | learning approach, completion question, Arena rec, follow-up, material guidance | ✅ per-section apply | same | **No** — draft only |
| **Arena generation** | `arenaScenarioGenerationService` | module snapshot facts + boundary | scenario draft | ✅ Host publish | R5A/R5C taxonomy | **No** — draft until published |
| **Semantic / boundary reviewers** | same | scenario | verdict | n/a | ⚠️ **currently failing ~6/7** | Governs refusal only |

**Governor 2 verdict: SATISFIED.** Copy is explicit and repeated — *"Nothing changes in your draft
until you apply it"*, *"You will review every section before anything is applied."* No AI path was
found that writes authoritative runtime truth.

**Governor 3 verdict: SATISFIED.** No parallel engine; both copilots write into `answers` jsonb and
compile through existing Foundry/Arena contracts.

---

## 4. LOCALE CONTRACT — ⛔ ABSENT

- `module-draft.ts` and `module-builder.ts` contain **no locale field**. Module content is
  single-locale with no declared canonical locale.
- `MODULE_BUILDER_COPY` is `Record<Locale, …>` — **UI-only localization**, correctly separated.
- Arena generation takes `locale` **per request** (R5C-4A2), so one module can generate scenarios
  in either language with **no locale-specific approval**.
- No translation producer, no locale approval gate, no publish-eligibility-by-locale, no fallback
  policy.

**Governor 6 verdict: NOT IMPLEMENTED.** Every authoritative text field (A1, A3, A5, A8, A11, A12)
is source-locale text with no approval contract. A Korean learner can receive an English-approved
standard, or an AI-translated scenario no human approved in Korean.

---

## 5. PROPOSED FUTURE JOURNEY

**Start from the minimum Host facts: A1 (what keeps going wrong) and A2 (who).** Everything else is
drafted or derived.

### New
1. **Host says one thing** — "What keeps going wrong?" + who. *(2 fields, not 7 steps.)*
2. **AI drafts the program immediately** — behavior, evidence, capability, learning approach,
   completion question. Presented as a **complete draft program**, not as more questions.
3. **Deterministic gap classification** from the draft → **evidence floor derived**, shown as a
   statement with its reason: *"Because this needs rehearsal under pressure, completion alone will
   not show it worked. This needs practice evidence."*
4. **Adaptive questions only where the draft is uncertain** — never a fixed 7-step march.
5. **Material requested only when the approach needs it.**
6. **Arena appears only when the derived floor is `practiced` or higher.**
7. **Full program preview**, then one approval.
8. Compile → module snapshot + event + assignments + optional practice + follow-up.

### Repeat
Re-publish an approved snapshot to a new audience. **No re-authoring, no AI.** Ask only: who, and
when to follow up.

### Update Standard
Uses the existing revision lineage (`parent_module_id` + `nextModuleVersion`). Show a **diff**, not
a blank form. New learners get the new revision; in-progress learners stay pinned (already true);
forced migration requires an explicit governed decision (**not yet built**).

---

## 6. PHASED REDESIGN PLAN

| Phase | User value | Source areas | Migration risk | Runtime risk | Founder verification | Depends on |
|---|---|---|---|---|---|---|
| **1. Remove dead questions** | Journey stops asking things that change nothing | A6 delete; A4 merge into A3; resolve A16/A17 | None | **Low** | Builder still approves | — |
| **2. Problem → program draft** | "One thing in, a program out" | Direction + Draft copilots merged | None | Low | Draft quality | 1 |
| **3. Deterministic gap + floor** | Evidence stops being decorative | Promote `evidenceLevel`/`evidenceSource`; derive from `learningNeeds`; extend needs to cover D6/D7 | **Medium** — existing drafts have no level | **Medium** — approval gate changes | Floor is correct per gap | 1, 2 |
| **4. Draft→commit authority** | Already satisfied; make explicit | Copilot apply paths | None | Low | — | 2 |
| **5. Compile into existing engines** | No parallel engine | module snapshot → event/assignment/practice/follow-up | Low | **Medium** | Published module unchanged | 3 |
| **6. Version pinning + forced migration** | Governed revision behavior | New: forced-migration decision | **Medium** | **High** | In-progress learners unaffected | 5 |
| **7. Locale approval contract** | A standard is approved in the language it is delivered in | New locale columns + approval gate | **High** | **High** | KO module approved in KO | 5 |
| **8. Arena/Reality only where derived** | No irrelevant QR or practice | A9/A10 conditional | Low | Low | Info-only module offers no Arena | 3 |
| **9. Verify real learner outcomes** | The point of all of it | Follow-up + memory | None | Low | Real evidence recorded | 6, 8 |

**Recommended order: 1 → 2 → 3.** Phase 1 alone addresses much of the "repetitive and
disconnected" complaint at near-zero risk. Phase 7 is the highest-risk and should not be attempted
until 5 and 6 are stable.

### Phase 1 entry criteria — status after R2

| Criterion | Status |
|---|---|
| Approval reachable, or exact blocker identified | ✅ reachable — `builderApprovalErrors` (§2.1) |
| `reflectionPrompt` ownership known | ✅ none — unimplemented Slice-1 concept (§2.2) |
| `actionDecisionPrompt` ownership known | ✅ none — same (§2.2) |
| `evidenceType` consumers fully known | ✅ snapshot-only, no readers (§2.3) |
| `evidenceLevel`/`evidenceSource` wiring gap proven | ✅ never written, not in snapshot (§2.3) |
| Existing draft/snapshot compatibility understood | ✅ `evidenceType` is in existing snapshots — do not remove the key casually (§2.3) |
| No hidden AI commit path | ✅ both copilots are draft-only with explicit apply (§3) |
| Rendered Builder confirmed in an authenticated browser | ⛔ **OPEN** — see risk 8 |
| Question inventory exhaustive | ✅ **YES (R2C §2.6)** — 16 declared keys = 16 observed in all 27 real drafts; no unknown key |
| Every key lifecycle-classified | ✅ §2.6 |
| `clarification` classified | ✅ D — authoring-only transient, deliberate (§2.7) |
| `realityGroundedJourneyV1` classified | ✅ F — compiled participant artifact, 1/24 adoption (§2.7) |
| `evidenceType` compatibility settled | ✅ A — required legacy snapshot contract; stop asking, keep reading (§2.9) |
| Journey approval enforced server-side | ✅ **PROVEN (R2D §2.12)** — `journey_not_approved` at publish, before mutation, tested |
| Existing approved data integrity | ✅ 0 of 24 snapshots contain unconfirmed content |

⚠️ **Phase 1 is NOT ready.** Two criteria are open: the rendered journey is unmeasured, and R2B
proved the question inventory in Table A is **incomplete**. A "remove meaningless questions" phase
built on an inventory known to be partial would delete or keep the wrong things.

---

## 7. UNRESOLVED RISKS

1. ✅ **RESOLVED (R2 §2.1–2.2).** The two prompts belong to a dead Slice-1 validator; the live
   gate is `builderApprovalErrors`. Approval is reachable and neither prompt blocks it.
2. Two creation paths (quick + builder) with overlapping fields and no stated relationship.
3. Legacy `learningNeed` (singular) coexists with `learningNeeds`.
4. Locale authority absent everywhere (§4).
5. No forced-migration contract.
6. `learningNeeds` cannot express D6/D7, so "training cannot solve this" is unreachable.
7. The semantic reviewer is failing ~6 of 7 calls (measured in R5C-6A) — Arena-dependent floors
   cannot currently be satisfied.
8. ⚠️ **OPEN — browser-only.** No authenticated Foundry Host session exists in the audit shell
   (`requireManager` → `isActiveFoundryHost`; the only stored sessions are Arena E2E contract
   users). The *rendered* step count, the Preview contents, the approval control's enabled state
   and its visible validation copy remain unmeasured. One editable draft exists on staging
   (`2363c6f5`, status `draft`, step 1) for whoever performs this.

---

## 8. WHAT REMAINS ON HOLD

Migration `20260805050000` unapplied · containment commit `7657a97f` undeployed · reviewer repair ·
product generation · provider calls · further Create actions · production changes.
