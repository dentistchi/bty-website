# SLICE 3.2I-PRACTICE-R5B1A.1-R2.31 — BOUNDARY REASON-MISSING FORENSICS

**READ-ONLY OUTPUT-CONTRACT GATE. No implementation authorized or performed.**

## VERDICT

**A. REASON-MISSING ROOT CAUSE PROVEN · NEXT CORRECTION MEASURED**

> The validator requires a non-empty `reason` on all twelve assessments, unconditionally.
> The strict schema has **no `minLength`**, so `""` is schema-valid.
> The prompt mentions `reason` **once**, and only for `other_grounded_violation`.
>
> **The model obeyed the contract it was given. The contract disagreed with itself.**
> This is a prompt/schema/validator parity defect introduced in R2.30 — not a model failure.

---

## 1. ARTIFACT INTEGRITY

| Field | Value | Match |
|---|---|---|
| HEAD | `d7210517d61eae901a2aadb451961350d96db97d` == origin/inner-main | ✅ |
| Tracked tree | clean | ✅ |
| Manifest | `25cb0451a20791053d6a6861236f3eed2097eb5662bdd80c9b4276fff8ba2895` | ✅ |
| Live artifact | `…boundaryreplay.live.20260801T142606Z.pass2.c18-constrained-clinical.a2.eeffd9ccf60c.json` | ✅ |
| SHA-256 | `bd904d61412aa9c47832485c4e96b0b588210034a8251c701b64f3e4f407210d` | ✅ |
| Boundary-review subject | `eeffd9ccf60c…` (identical across both attempts) | ✅ |
| Surface map | `59c57451f3fe…` — **rebuilt locally, matches** | ✅ |
| Lineage | `ec1a498917ba…` | ✅ |
| Reachable / excluded | 12 / 4 | ✅ |
| Generation / broad-review calls | 0 / 0 | ✅ |
| R2.29 live + generation source artifacts | byte-identical | ✅ |
| Credential / account metadata | **NONE** (0 pattern matches) | ✅ |

---

## 2. THE DECISIVE MEASUREMENT

`reason` is **present on 24/24 rows** across both attempts (strict output guarantees presence). It is **exactly `""`** on some. The distribution is not random:

| | attempt 1 | attempt 2 |
|---|---|---|
| `applies` rows | 4 | 3 |
| …with **empty** reason | **4 / 4 (100%)** | **3 / 3 (100%)** |
| `not_applicable` rows | 8 | 9 |
| …with empty reason | **0 / 8** | **0 / 9** |
| `reason` property absent | 0 | 0 |
| finishReason | `stop` | `stop` |

**Across both attempts: `applies` → reason empty 7/7. `not_applicable` → reason non-empty 17/17.**

### Attempt 1 — the four failing rows (all `applies`)

| Surface | compliance | governedActionEvidence | prerequisiteFailureEvidence | reason |
|---|---|---|---|---|
| `primary[0]` | complies | "Verify identifiers for both patients now" | `""` | **`""`** |
| `branch[0].resulting_world_state` | violates | "You have verified identifiers for both patients and provided the necessary treatment…" | "but you still face delays in the ward…" | **`""`** |
| `branch[1].resulting_world_state` | violates | "You prioritized immediate treatment for one patient while notifying the family" | "but this left the second patient unverified…" | **`""`** |
| `branch[1].action[1]` | violates | "Immediately treat the second patient" | "but this left the second patient unverified…" | **`""`** |

Every other required field is present, grounded and correct.

---

## 3. CLASSIFICATION — FORM **B: PRESENT AS EMPTY STRING**

| Candidate | Result |
|---|---|
| A property absent | ❌ present on 24/24 |
| **B empty string** | ✅ **CONFIRMED** |
| C whitespace only | ❌ exactly `""` |
| D below minimum length | ❌ no minimum exists; the test is `!a.reason.trim()` |
| E dropped in adaptation | ❌ adapter is `str(o.reason)`; non-empty values survive in the same array |
| F different field name | ❌ property set is exactly the 8 schema names |
| G validator wrong path | ❌ local replay reproduces the artifact exactly |
| H serialization loss | ❌ non-empty reasons serialize fine alongside |

**Affected:** 4 (attempt 1) / 3 (attempt 2) of 12. **Not every assessment failed — one poisons the whole response.**
**Same surfaces both attempts:** `primary[0]`, `branch[0].resulting_world_state`, `branch[1].resulting_world_state`. Attempt 2's set is a strict subset of attempt 1's. **The recurrence is deterministic in the `applies` state, not stochastic.**

---

## 4. SCHEMA AUTHORITY

```json
"reason": { "type": "string", "maxLength": 100 }
```

| Property | Value |
|---|---|
| required (presence) | **yes** |
| `minLength` | **ABSENT** |
| `pattern` | **ABSENT** |
| empty string schema-valid | **YES** |
| whitespace-only representable | yes |
| requirements differ by state | **no** |
| strict output guarantees | **property presence only, never non-emptiness** |
| provider schema validation | **PASSED** before local validation |

**The schema permits the exact live failure shape.**

No `if` / `then` / `allOf` anywhere. Four rules are logically required by the validator and **unrepresentable** in the strict schema: non-empty `reason`; non-empty `governedActionEvidence`; `prerequisiteFailureEvidence` non-empty **iff** violates; `violationMechanism != none` **iff** violates.

---

## 5. PROMPT / SCHEMA / VALIDATOR PARITY

The prompt mentions `reason` **exactly once**:

```
L7   uncertain — …Name the exact ambiguity.
L14  uncertain — …Name the exact ambiguity.
L24  other_grounded_violation — a real mechanism none of the above names; explain it in reason.
```

**It never states that `reason` must be non-empty for all twelve surfaces.**

| State | Prompt demands reason? | Schema | Validator | Live | Mismatch |
|---|---|---|---|---|---|
| `not_applicable` | ❌ (asks only "show what the surface does") | presence | **non-empty** | supplied 17/17 | model volunteered |
| applicability `uncertain` | ✅ "name the ambiguity" | presence | non-empty | never produced | — |
| `applies` + `complies` | ❌ | presence | **non-empty** | **empty 2/2** | ⚠️ **PARITY DEFECT** |
| `applies` + `violates` | ❌ (only for `other_grounded_violation`) | presence | **non-empty** | **empty 5/5** | ⚠️ **PARITY DEFECT** |
| `applies` + compliance `uncertain` | ✅ | presence | non-empty | never produced | — |

---

## 6. IS `reason` LOAD-BEARING?

| State | Independent information? | Server-derivable? |
|---|---|---|
| `not_applicable` | ❌ — reason "…it prepares a report" paraphrases evidence "Prepare a detailed report for the administrator" | ✅ |
| `applies` + `complies` | ❌ | ✅ |
| `applies` + `violates` | ❌ — mechanism + governed action + prerequisite failure fully encode it | ✅ |
| **applicability `uncertain`** | ✅ **the ambiguity is encoded nowhere else** | ❌ |
| **`other_grounded_violation`** | ✅ the enum deliberately delegates to prose | ❌ |

**The verdict never depended on `reason`.** Counterfactual replay — supply the missing reasons, change nothing else:

```
attempt 1 → boundary_review_reject   (3 grounded violations, 3 causal)
attempt 2 → boundary_review_reject   (2 grounded violations, 2 causal)
```

---

## 7. MOCK vs LIVE — WHY CI DID NOT PREDICT THIS

- The mock hardcodes a non-empty reason on **every** path (4 literals). It **never** emits an empty reason.
- The mock proves **validator wiring only**.
- Assessment count and field count are identical between mock and live — the shapes agree; only the *values* differ.
- **`boundary_reason_missing` has ZERO test references** outside its own definition (`narrowBoundaryReview.ts:158`) and the single rule (`:324`).
- Fixtures were authored from the **validator's** expectations, not from the **prompt's** instructions — so the gap between them was invisible by construction. No test compares prompt-demanded fields against validator-required fields.

---

## 8. OUTPUT BURDEN — **NOT CAUSAL**

| | attempt 1 | attempt 2 |
|---|---|---|
| assessments × required props | 12 × 8 = **96 scalar fields** | same |
| repeated free-text fields | 36 | 36 |
| output bytes / est. tokens | 4,337 / **1,446** | 4,150 / **1,384** |
| budget | 16,000 | 16,000 |
| **utilisation** | **9.0 %** | **8.6 %** |
| finishReason | `stop` | `stop` |
| longest reason / bound | 77 / 100 | 95 / 100 |
| longest evidence / bound | 115 / 120 | 115 / 120 |
| any field at bound | no | no |

Request: 8,229 bytes / 2,743 est. tokens.

**Under 10% of budget, clean `stop`, every other field filled including 115-char excerpts. The omission is state-correlated, not size-correlated.** Contract breadth is **not** a plausible causal factor.

---

## 9. VALIDATOR REPLAY (local, no network)

```
attempt 1  ok:false  codes:["boundary_reason_missing"]  findings:4  → boundary_review_malformed  REPRODUCED
attempt 2  ok:false  codes:["boundary_reason_missing"]  findings:3  → boundary_review_malformed  REPRODUCED
```

**First failing rule:** `narrowBoundaryReview.ts:324` — `if (!a.reason.trim()) push("boundary_reason_missing");`
It runs **first** in the per-assessment loop, before applicability/compliance coherence and before every evidence check. Unconditional and state-independent.

**Valid evidence discarded:** yes — all 12 assessments, including 3 fully grounded violations with correct mechanisms and both excerpts.

**Should one invalid assessment invalidate the whole response?** For a safety matrix, yes on coverage grounds — a partially answered matrix is not a boundary verdict. **The fail-closed behaviour is correct; the field it fires on is not load-bearing.**

**Was rerunning the whole reviewer correct?** Correct under the contract — but **guaranteed to fail**, because the cause is deterministic in the prompt, not stochastic in the model. Two calls re-measured the same defect.

---

## 10. TERMINAL CLASSIFICATION

`boundary_reviewer_terminal_failure` with `scenarioUnjudged: true` is the **correct class** and stays properly distinct from reject / generation_rejected / semantic false negative / transport failure (sanitizedError `null`, finish `stop`) / schema failure (the provider schema **passed**) / product-quality failure.

**But it is insufficiently precise** — it conflates a truncated response, a coverage failure, and a response that was complete and schema-valid yet refused on a server-side field rule.

**Recommended subcode: `boundary_output_contract_failure`.** (`boundary_reason_authority_failure` is narrower than the general case; `boundary_assessment_incomplete` wrongly implies missing coverage — coverage passed.)

---

## 11. ALLOWED-OUTCOMES REPORTING DEFECT (secondary)

Printed list omits **`boundary_reviewer_terminal_failure`** — the actual result — and `boundary_review_not_applicable`.

- **Source:** `practice-c18-narrow-boundary-replay-runner.ts:326-329`, a hand-written `printf` block. **Manually duplicated.**
- **Canonical enum exists and is not used:** `BOUNDARY_STAGE_OUTCOMES` (6 values), `boundaryReviewStage.ts:39`.
- Artifact schema contains the value ✅ · aggregate metrics classify it correctly ✅ (`boundaryReviewerTerminalFailureCount: 1`, `boundaryMetricsPass: false`) · **exit code 4 correct** ✅

**Cosmetic. It did not affect the verdict, artifact, metrics or exit code.** Fix by deriving the list from one enumeration.

### Two further observability gaps
1. `accumulateBoundaryMetrics` reads applicability counters from the last **non-malformed** evidence; with both attempts malformed it reported `applicable/notApplicable/uncertain = 0/0/0` although the artifact holds `4/8/0` and `3/9/0`.
2. `boundary_reason_missing` is in neither `UNGROUNDED_CODES` nor `UNSUPPORTED_VIOLATION_CODES`, so both precision counters stayed 0 for a two-attempt output-contract failure.

---

## 12. OPTIONS

| Option | Result |
|---|---|
| 1 · add `minLength`/`pattern` | **REJECTED as primary** — the prompt still never asks for a reason on `applies`; this converts a server refusal into a provider retry loop against an instruction never given, and invites filler. Valid only as a companion once `reason` is scoped. |
| 2 · **server-derive the reason** | **ADOPT** for not_applicable / complies / violates. Every input is already present and grounded; the counterfactual proves the verdict is unaffected. |
| 3 · **conditionally require reason** | **ADOPT** for uncertain (both levels) + `other_grounded_violation` — the only states carrying information the server cannot derive. |
| 4 · preserve partial assessments | **REJECTED** — a partially covered boundary matrix is not a verdict; mixed-contract authority is what R2.28–R2.30 removed. |
| 5 · split the twelve surfaces | **REJECTED** — burden measured **not** causal (9% of budget). |
| 6 · change the model | **BLOCKED BY PRECEDENCE** — the model supplied every field the prompt demanded, correctly grounded. Contract adequacy must be proven first; it is measured inadequate. |

Options 2 and 3 are **one coherent correction**, not two.

---

## 13. SMALLEST NEXT CORRECTION

### R2.32 — SERVER-DERIVED BOUNDARY EXPLANATION AUTHORITY V1

Satisfies precedence rule **1** (remove redundant model-authored authority).

1. Remove `reason` from pass/fail authority for `not_applicable`, `applies+complies`, `applies+violates`. The server composes the explanation from applicability, compliance, `violationMechanism`, `governedActionEvidence`, `prerequisiteFailureEvidence` — all already required and grounded.
2. **Keep** `reason` required — and **say so in the prompt** — for exactly: applicability `uncertain`, compliance `uncertain`, `other_grounded_violation`.
3. Repair parity **in both directions**: the prompt states which states require prose; the validator requires it in exactly those states and no others.
4. Add subcode **`boundary_output_contract_failure`**.
5. *Secondary:* derive the runner's Allowed-outcomes list from `BOUNDARY_STAGE_OUTCOMES`; count applicability from the last **parsed** evidence; add the output-contract codes to a precision counter.

**Gate:** a regression built from **both captured live DTOs** — must fail before, produce a grounded reject after — plus a **prompt/validator parity test** enumerating all five assessment states and asserting the required-field sets agree. That test class is precisely what was missing.

**Excluded:** urgency safety-basis · communication-axis · c09 progression · generator changes · broad-review redesign · model change.

---

## 14. UNRESOLVED — SEMANTIC QUALITY IS STILL UNMEASURED

Fixing the reason contract yields a verdict. It does not make that verdict right. Two things the evidence shows and R2.32 does not touch:

1. **Probable false positive on the compliant branch.** Attempt 1 flags `branch[0].resulting_world_state` — *"You have verified identifiers for both patients and provided the necessary treatment without compromising on safety"* — as `resulting_state_missing_prerequisite`, using *"but you still face delays in the ward"* as the prerequisite-failure excerpt. **A delay is not a verification failure.** It survives grounding because the excerpt genuinely comes from the surface.
2. **Applicability is unstable at temperature 0.** `branch[1].action[1]` *"Immediately treat the second patient"* was `applies + violates` in attempt 1 and `not_applicable` (*"it treats a patient"*) in attempt 2, over a byte-identical subject. Treating **is** the governed action; the attempt-2 answer is wrong.

Neither caused the terminal failure. Both must be re-measured once a live verdict is obtainable.

Also: provider token usage is not captured in the replay artifact; completion size was estimated from the serialized DTO.

---

## 15. NO-MUTATION PROOF

| Check | Result |
|---|---|
| HEAD after | `d7210517d61eae901a2aadb451961350d96db97d` — unchanged |
| origin/inner-main | unchanged |
| Tracked tree | clean |
| Live artifact | byte-identical (`bd904d61…`) |
| R2.29 live + generation source artifacts | byte-identical |
| Live model call | **NONE** |
| Generation call | **NONE** |
| Database connection | **NONE** |
| Deployment | **NONE** |
| New runner | **NONE** |
| Source / test modification | **NONE** |
| Commit / push | **NONE** |

Analysis scripts were written to the session scratchpad, outside the repository.
