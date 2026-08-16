# BTY R2 — POST-TRAINING LOOP CLOSURE

**Status: PASS / CLOSED — 2026-08-15**
Slice family: `3.2R-R2` (R2 → R2.1 → R2.2 → R2.3 → R2.3-R2 → R2.3-R3 → R2.4 → R2.5 → R2.6 → R2.6-R1)

| | |
|---|---|
| Inner final commit | `41c6969d` (`bty-app`, branch `inner-main`) |
| Outer final commit | see the closure commit that carries this file (`btytrainingcenter`, branch `main`) |
| Staging Worker | `217f37cd-6218-4089-9c9e-d42bc0fd9b08` @ 100% |
| Migration | `20260823000000_foundry_participant_apply_windows_v1.sql` — applied by the Founder |
| Live proof record | event `4d1b2375` · progress `95c4adf6` · apply window `6435c742` · learner `d0b1af49` |

---

## 1. What R2 set out to do

Carry the learner's **own Action Decision** out of the training and into the working week, without
turning it into a task, a score, or a claim that they did it.

The learner writes one sentence at completion. Today shows that sentence back to them for seven
days. The follow-up asks, later, what actually happened. **Nothing in that chain may establish
APPLIED** — only the learner's own later report can.

---

## 2. The proven contract

### Host

```
Manager intent
  → Builder (Step 1 title, distinct from problem)
  → v23 ProgramAuthorship generation
  → reviewed proposal (server-computed digest)
  → digest-bound adoption
  → frozen grounded journey  (insert-only module_snapshot)
  → assigned session
```

### Learner

```
Required learning
  → document engagement (server-marked reading gate)
  → completion check
  → explicit learner Action Decision
  → authenticated completion
  → My Learning: "What I decided"
  → evidence: Learned · Reflected · Decided
  → Today: APPLY THIS WEEK
  → (7 days later) follow-up asks what happened
  → only then can APPLIED exist
```

### The four negative invariants — each proven, not assumed

| Claim | How it is enforced |
|---|---|
| Creating the Apply Window does **not** establish APPLIED | `applied` requires `completed && appliedReported`; `appliedReported` is sourced **only** from the learner's follow-up outcome. The window is not an input to the ladder at all. |
| Rendering Today does **not** establish APPLIED | The whole Today path is `select` + a read-only RPC. Measured live: `progress.updated_at` still equals `completed_at` after every Today open. |
| Opening the Apply card does **not** establish APPLIED | The card is an `<a>` to `?tab=me&view=my-learning`. Measured live after the Founder's tap: **zero drift across 20 compared fields**. |
| Opening My Learning does **not** establish APPLIED | `learnerEvidenceService` and `/api/bty/foundry/evidence/mine` contain no `insert`/`update`/`upsert`/`delete`. |

**APPLIED remains dependent on later learner self-report through the follow-up.** On the live
record the follow-up is `PENDING`, `outcome: null` — so the ladder correctly stops at DECIDED.

---

## 3. Defect history — preserved, not rewritten

Each of these was found by measurement, and several were found *after* a green test suite said
otherwise. That pattern is the most useful thing in this document.

| Slice | Defect | Root cause | Repair |
|---|---|---|---|
| **R2** | — (build) | Action Decision had nowhere to live after completion | New sibling obligation table `foundry_participant_apply_windows` (never `bty_action_contracts`, never a widened follow-up); pure `computeApplyWindow`/`classifyApplyWindow`; Today projection at strictly lowest priority |
| **R2 (env)** | Single-environment migration constraint | staging **is** production for this app; no isolated tree to rehearse on | Migration written idempotent + ordered, applied by the Founder under explicit authorization, verified by a GET-only script whose invalid-INSERT probes are rejected as proof |
| **R2.1** | Builder Step 1 conflated title and problem | No independent title field | `TITLE_MAX`, `title?`, sanitizer entry; **no migration** — the schema already allowed it. Split `stepBlocker` (source-only) from `stepBlockers`, after putting `title_required` in the shared gate broke 44 tests by collapsing `availableEvidenceLevels` |
| **R2.2** | "Where is Your decision?" | Assumption that a lexical gate guaranteed it | Measurement showed the guarantee is **structural**: `deriveContent(kind) ?? content.value` discards the model's sentence for instructional kinds. Two of my own tests failed and corrected me |
| **R2.3** | Host `completionPrompt` lost in generation; malformed Apply-It prose | `CONSTRUCT_PHRASE` matched across a preposition | `resolveCompletionCheck` + `ProgramContracts.completionPrompt`; `CONSTRUCT_HEAD`/`DETERMINER`/`NON_MODIFIER` + backward `constructPhraseAt` walk. Fixed structurally — no phrase special-casing, no React patch, no regex post-process |
| **R2.3-R2** | The fix deployed and the Founder still saw the broken sentence | APPLY IT rendered from `proposal.operationalConstruct`, **stored at generation time** by the older extractor | `contractsFromProposal` re-derives the construct from the Host's answers |
| **R2.3-R3** | Re-deriving at apply time violated digest attestation | Three required sections rendered different bytes than the digest attests; the claim reached `proposal_mismatch`, which strips the marker but **still writes the journey** | Bumped `PROGRAM_AUTHORSHIP_VERSION` v22 → **v23**, routing old proposals to `proposal_no_longer_valid` — a **zero-write** 409. History untouched |
| **R2.4** | Apply reported success on a zero-write failure | Non-ok response set no reason; `clearCachedProposal` ran unconditionally; a missing outcome defaulted to "adopted" | Refusal reason surfaced, cache preserved on failure, missing/thrown outcome becomes a visible failed state. (A test that pinned the optimism was fixed too) |
| **R2.5** | Learner could not complete: "Complete training" did nothing | 3.2M-1 shipped YOUR DECISION to the YouTube client and the document **service** — never to `FoundryDocumentClient` (0 references vs the sibling's 37). Server refused `decision_required`; `onComplete` had no branch and fell through to a silent `load()` | Ported the decision section (never prefilled, required, same frozen journey the server gates on) + the missing error branch. The reading gate was never the blocker |
| **R2.6** | Today card showed no training title and no timing | **(a)** R2's Apply-card tests targeted `TodayPersonalBrief`, which is **mounted nowhere**; the shell renders `TodayHome`, whose `normalizeTodayItems` map narrowed `note` away. **(b)** The writer selected `foundry_events.organization_id`, a column that does not exist → `42703` failed the whole statement → title silently fell back to `"Foundry training"`, org lost | Carry `note`; render the card hierarchy; select only real columns and take org from the assignment; teach the fixture the real column sets and 42703 semantics |
| **R2.6-R1** | Wrong provenance on the live row; redundant chip | The stored title was a snapshot taken while the defect was live; "This week" repeated the eyebrow | Authorized one-row backfill (2 columns, 12 protected fields unchanged, table has no `updated_at`); chip suppressed for `active` |

### Recurring lesson

**Three of these defects — R2.5, R2.6(a), R2.6(b) — are the same mistake.** Something real existed
upstream and was silently dropped downstream: a field the sibling client had, a `note` the server
sent, a column the fixture invented. Green tests did not catch any of them because the tests were
pointed at the wrong surface or built on a fixture that could not fail. Before trusting a suite,
check that it is aimed at the mounted surface and the real schema.

---

## 4. Live proof record (read-only, at closure)

```
progress 95c4adf6   completed_at 2026-08-15T12:30:35.355-07:00
                    updated_at   2026-08-15T12:30:35.355-07:00   (never moved since completion)
                    linked_user_id d0b1af49
                    response_text  "One clear owner and one clear deadline."
                    decision_response_text
                      "At my next huddle, I will name one owner and one deadline
                       for every open action item before we end."

apply window 6435c742   exactly 1 row in the table
                    completion_bty_day 2026-08-15 → due_bty_day 2026-08-22
                    due_at 2026-08-22T05:00:00-07:00      (BTY 05:00 boundary)
                    user d0b1af49 · assignment d516bbd6 · event 4d1b2375
                    source_training_title "Establishing Action Ownership in Huddles"
                    organization_id c373f116
                    decision free text: NOT stored here

follow-up c034bbf0  PENDING · outcome null · updated_at == created_at
observations        0 rows            → OBSERVED / SUSTAINED unreachable
audit               foundry_shared_review_audit: 7 rows, all other events, newest 2026-08-04
```

**Adoption history preserved, unmutated:**

- `4b16dbd1` — `program_authorship_v23`, `success`, **`applied_at 2026-08-15T11:21:23.09-07:00`**,
  digest `program_proposal_digest_v1:0f2f09d2…9065`
- `d36c5309` — `program_authorship_v22`, `success`, **`applied_at null`**,
  digest `program_proposal_digest_v1:073b4582…b3d5`

**Frozen journey digest recomputed at closure** from the live `module_snapshot` over the six
required kinds (`why_it_matters, observable_standard, action_decision, field_application,
completion_check, follow_up`): **identical to the adopted v23 digest.** The published journey is
byte-for-byte the proposal the Founder reviewed.

---

## 5. Proof status — device vs test

Stated separately on purpose. The second list is real coverage, but it is not device evidence.

### DEVICE-PROVEN (Founder, on the physical app)

- Generation → adoption → publish → assigned session
- Learner decision capture and authenticated completion
- My Learning: "What I decided" projection
- Today: the APPLY THIS WEEK card (eyebrow / decision / training title, no chip)
- Today → My Learning deep-link
- **No "Applied"** anywhere on either surface
- Absence of checkbox, Done, XP, percent, streak, red state

### TEST-PROVEN, **NOT** DEVICE-PROVEN

- **Simultaneous multi-Apply cards.** Needs a second completed training; only one exists.
- **Day-7 suppression on 2026-08-22.** The date has not arrived. Server and shell both pin it
  (`todayApplyDue.test.ts`, `TodayHome.applyCard.test.tsx`), and it remains unobserved in the world.

Neither should be described as device-tested until it is.

---

## 6. Verification gates at closure

| Gate | Result |
|---|---|
| Full unit | 1007 files / 10497 tests · 8 failed files / 17 failed / **10472 passed** |
| vs pre-R2 baseline | identical failing set — **0 new failures** across the entire R2 arc |
| tsc | clean |
| terminology | 44 (baseline) |
| build | 331/331 |
| cf:build | clean |

ESLint does not start in this environment (`ajv` failure inside `@eslint/eslintrc` under Node 24) —
pre-existing and unrelated.

---

## 7. Open / deliberately not done

- **The follow-up leg is unexercised.** On 2026-08-22 the follow-up becomes due, the Apply card
  should disappear, and answering it is the only path to APPLIED. That is the natural next
  observation, and it needs no code.
- **A closed window with no follow-up configured** leaves Today and nothing replaces it. Reported
  in R2 rather than invented; still an open product question.
- `TodayPersonalBrief` remains in the tree, unmounted. It is now wired to the shared chip authority
  so it cannot drift, but **it renders to no one** — do not treat its tests as surface coverage.

---

**BTY R2 — PASS / CLOSED. R3 NOT STARTED.**
