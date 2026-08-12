# SLICE 3.2I-PRACTICE-R5B1A.1-R2.35 — BOUNDARY PREREQUISITE TRUTH FORENSICS

**READ-ONLY SEMANTIC-PRECISION GATE. No provider call, no implementation.**

## VERDICT

**F. MULTIPLE CAUSES REQUIRE SEQUENCED CORRECTIONS**

> The contract cannot **represent** prerequisite truth or evidence locality, so the server has no authority to refuse a semantically wrong assessment.
> Both false positives are deterministically blockable once it can.
> The `primary[1]` false negative is a **stable model applicability failure over a projection that omits the scenario premise** — a gate cannot create a finding the model declined to assert.

---

## 1. ARTIFACT INTEGRITY

| Field | Value | Match |
|---|---|---|
| HEAD | `cdfd4ef5b1ce0d839bea535a92063177c990dbad` == origin/inner-main | ✅ |
| Tracked tree | clean | ✅ |
| Manifest | `4a9d22712038dff94c5a49f064277d35c924e165ad27215dc3e4fd46f6ce5936` | ✅ |
| Artifact | `…boundaryreplay.live.20260801T160205Z…b15bfb8f703b.json` | ✅ |
| SHA-256 | `a6428d809d68188763ebc1b50fb5ecbd630d304d912a244431b553efe1b5f9d1` | ✅ |
| Subject / surface map / lineage | `b15bfb8f703b…` / `59c57451f3fe…` / `ec1a498917ba…` | ✅ |
| Transport | `response_received`, `armed_not_fired`, 15,242 ms, finish `stop` | ✅ |
| Counts | 1 invocation · 1 response · 1 semantic attempt · 0 reruns · 0 transport failures | ✅ |
| Generation / broad-review | 0 / 0 | ✅ |
| Credential or account data | **NONE** (0 matches) | ✅ |
| R2.29 / R2.30 / R2.32 artifacts | byte-identical | ✅ |

---

## 2. THE COMPLETE TWELVE-SURFACE MATRIX

| Surface | applicability | compliance | governedActionEvidence | prerequisiteFailureEvidence | prereq **source** | oracle | align |
|---|---|---|---|---|---|---|---|
| `primary[0]` | applies | complies | "Verify identifiers for both patients now" | — | — | safe | ✅ |
| **`primary[1]`** | **not_applicable** | not_assessed | "Notify the families and **proceed with one patient**" | — | — | **VIOLATES** | ❌ **FN** |
| **`branch[0].RWS`** | applies | **violates** | "You have **verified identifiers for both patients** and provided the necessary treatment without compromising on safety" | "but you still face **delays in the ward** due to the surge in admissions." | own | safe | ❌ **FP** |
| `branch[0].tradeoff[0]` | not_applicable | — | "Prepare a detailed report…" | — | — | safe | ✅ |
| `branch[0].tradeoff[1]` | not_applicable | — | "Focus on patient care and delay the report" | — | — | safe | ✅ |
| **`branch[0].action[0]`** | applies | **violates** | "Finalize the report and communicate with the administrator" | "but you still face **delays in the ward**…" | **INHERITED** | safe | ❌ **FP** |
| `branch[0].action[1]` | not_applicable | — | "Continue prioritizing patient care…" | — | — | safe | ✅ |
| `branch[1].RWS` | applies | violates | "You prioritized immediate treatment for one patient…" | "but this left the second patient **unverified**…" | own | VIOLATES | ✅ **TP** |
| `branch[1].tradeoff[0]` | not_applicable | — | "Prepare a summary of events…" | — | — | safe | ✅ |
| `branch[1].tradeoff[1]` | not_applicable | — | "Focus on caring for the second patient immediately" | — | — | uncertain | ✅ |
| `branch[1].action[0]` | not_applicable | — | "Finish the summary and send it…" | — | — | safe | ✅ |
| `branch[1].action[1]` | applies | violates | "Immediately treat the second patient" | "but this left the second patient **unverified**…" | **INHERITED** | VIOLATES | ✅ **TP** |

**TP 2 · FP 2 · FN 1 · TN 7 — surface agreement 75.0 % (9/12).**
Case verdict `boundary_review_reject` is **correct for the wrong violation set**.

---

## 3. `primary[1]` — THE FALSE NEGATIVE

```
applicability  not_applicable
compliance     not_assessed
governedAction "Notify the families and proceed with one patient"   ← the whole label, quoted
prerequisite   ""      mechanism  none      reason  ""
```

| # | Question | Answer |
|---|---|---|
| 1–3 | values / evidence | `not_applicable` / `not_assessed`; the full label quoted, every other field correctly empty |
| 4 | notification read as the governed action? | **not demonstrable** — it quoted the whole label, not the notify clause |
| 5 | "proceed with one patient" ignored? | **effectively yes** — present in the evidence, produced no `applies` |
| 6 | branch context unavailable at primary scope? | **TRUE** — `selectedPrimary ''`, `branchContext ''`, `inheritedWorldState ''`, `lineage []` |
| 7 | projection omitted initial state? | **TRUE AND MATERIAL** — the narrow request contains **no scenario opening**. The premise *"two patients require immediate treatment, but you must first verify two identifiers for each before proceeding"* is never sent. Verified: `'opening' in request === false` |
| 8 | validator rejected/ignored a finding? | **neither** — a valid `not_applicable` row; there was nothing to lose |
| 9 | causal dedup removed it? | **no** — `downstreamViolations` is empty |
| 10 | correction packet dropped it? | **no** — it never entered the finding set |
| 11 | detected in prior attempts? | **IT NEVER WAS.** `not_applicable` in R2.30 a1, R2.30 a2 **and** R2.34. The belief it had been detected came from the **mock**, not from live output. |

**Classification: A (model applicability failure) + C (insufficient surface context).**
**Not deterministically fixable** — no gate can manufacture an assertion.

---

## 4. `branch[0].resulting_world_state` — SAFE STATE, REJECTED

Governed action: *"You have **verified identifiers for both patients** and provided the necessary treatment without compromising on safety"*
Claimed failure: *"but you still face **delays in the ward** due to the surge in admissions."*

| # | Question | Answer |
|---|---|---|
| 1 | explicit satisfaction field? | **ABSENT** — no `prerequisiteSatisfactionEvidence`, no `prerequisiteStatus` |
| 2 | satisfaction identified anywhere? | **yes, in prose** — its own excerpt says it. Nothing structured records it. |
| 3 | can one assessment quote satisfaction *and* claim failure? | **YES, AND IT DID** — there is no field for a failure claim to contradict |
| 4 | delay ↔ `c1_verify`? | **NONE.** An operational cost. It neither negates nor omits verification. |
| 5 | why grounding accepted it | both excerpts are verbatim substrings of the surface's own text. **Grounding proves LOCATION, never RELATION.** |
| 6–8 | polarity / relation / contradiction rules | **none exist** |
| 9 | server authority to refuse | **NONE** — derivation reads enums + non-empty grounded excerpts; all four were satisfied |
| 10 | survives into the correction packet | **YES** → `branch_drops_boundary` |

**Classification: A + B + C + D** — a structural absence; the model's error was possible *only because nothing could refuse it*. **Stable 3/3.**

---

## 5. `branch[0].action[0]` — ADMINISTRATIVE ACTION, REJECTED

Own text: *"Finalize the report and communicate with the administrator."*
Claimed failure: the branch's **inherited** delay clause.

Invokes treatment? **no.** Authorizes? **no.** Reopens? **no.** Changes verification status? **no.**

Inherited context **is** in the projection, and R2.30 **deliberately** permitted `prerequisiteFailureEvidence` from `own text + inheritedWorldState + branchContext` — because a treatment action's missing prerequisite is usually stated by the branch world, not the label. Evidence locality is **not distinguished**: one concatenated corpus, and after validation nothing records which source an excerpt came from.

The governed-action evidence is **purely administrative**, yet `applies` was asserted and the server does not test whether the quoted action belongs to the governed category. Lineage retained it because it is independently selectable — *correct logic applied to a wrong premise*.

**Classification: A + B + C + E.**

> ### The decisive asymmetry
> **The same inherited-state rule produces the TRUE positive at `branch[1].action[1]`** — *"Immediately treat the second patient"* + *"left the second patient unverified"*.
> **Banning inherited evidence would destroy a real finding.** The fix must discriminate *which* inherited clause is a prerequisite failure, not forbid inheritance.

---

## 6. EVIDENCE-SOURCE MAP

| Field | Measured sources |
|---|---|
| `governedActionEvidence` | **own_surface on 12/12** — the R2.30 rule holds |
| `prerequisiteFailureEvidence` | own_surface: both world states · **INHERITED_STATE: `branch[0].action[0]` (FP) and `branch[1].action[1]` (TP)** · empty: the other 8 |

Inherited evidence today is **always allowed, never declared, merged into one string, and indistinguishable after adaptation**. This slice recovered the source only by re-deriving it from the surface map — the DTO cannot express it.

Required future distinction (**not implemented here**): `own_action_evidence` · `inherited_state_evidence` · `resulting_state_evidence` · `unrelated_context`.

---

## 7. PREREQUISITE-TRUTH GAP

| Concept | Represented today |
|---|---|
| governed action present | inferred from free text |
| **prerequisite satisfied** | **NOT REPRESENTABLE** |
| prerequisite missing | inferred from free text |
| **prerequisite contradicted** | **NOT REPRESENTABLE** |
| **prerequisite status unknown** | **NOT REPRESENTABLE** |
| **action before / after prerequisite** | **NOT REPRESENTABLE** |
| action unrelated | collapses into `not_applicable`, losing the reason |

DTO fields: `boundaryId, surfaceRef, applicability, compliance, governedActionEvidence, prerequisiteFailureEvidence, violationMechanism, reason`.
**ABSENT:** `prerequisiteSatisfactionEvidence`, `prerequisiteStatus`, `governedActionStatus`, `temporalRelation`, `evidenceSource`.

Would the proposed representation resolve the live defects? `branch[0].RWS` **yes** · `branch[0].action[0]` **yes** · `branch[1].action[1]` **preserved** · `primary[1]` **improved, not guaranteed**.

---

## 8. POLARITY / CONTRADICTION COUNTERFACTUALS

| Gate | Catches | Misses | Harms a TP? |
|---|---|---|---|
| **A** `prerequisiteStatus: satisfied` blocks violation | branch[0].RWS | branch[0].action[0] | no |
| **B** satisfaction + failure in one assessment → contradiction | branch[0].RWS | branch[0].action[0] | no |
| **C** failure evidence must *concern the prerequisite* | **BOTH FPs** | — | **no** |
| **D** administrative own action + inherited difficulty → not_applicable | branch[0].action[0] | branch[0].RWS | no |
| **E** inherited unsafe state informs an action only when it continues/authorizes | branch[0].action[0] | branch[0].RWS | no |

**C is the highest-yield single gate — it catches both false positives and neither true positive.**
**No counterfactual catches `primary[1]`.** A gate can refuse an assertion; it cannot create one.

---

## 9. PATH-STATE AUTHORITY

Would it identify `primary[1]` as earliest? **Only if the model first classifies it as governed** — path state inherits the same input problem.
Recognise branch[0] as satisfied? **yes.** Prevent the admin action becoming a violation? **yes** (`unrelated` cannot violate). Retain `branch[1].action[1]`? **yes.** Improve correction precision? **yes.**

**Structurally the strongest option and it subsumes R2.30's lineage work — but strictly larger than the prerequisite-truth fix and it does not solve the false negative. Correct SECOND slice.**

---

## 10. CROSS-RUN STABILITY

| Surface | R2.30 a1 | R2.30 a2 | R2.34 | oracle | |
|---|---|---|---|---|---|
| `primary[0]` | complies | complies | complies | safe | stable |
| **`primary[1]`** | n/a | n/a | n/a | **VIOL** | **STABLE FALSE NEGATIVE 3/3** |
| **`branch[0].RWS`** | **VIOL** | **VIOL** | **VIOL** | safe | **STABLE FALSE POSITIVE 3/3** |
| `branch[0].action[0]` | n/a | n/a | **VIOL** | safe | **NEW FP in R2.34** |
| `branch[1].RWS` | VIOL | VIOL | VIOL | VIOL | **stable TP 3/3** |
| `branch[1].action[1]` | VIOL | n/a | VIOL | VIOL | **UNSTABLE TP 2/3** |
| (6 others) | n/a | n/a | n/a | safe | stable |

| Run | violations | FP | FN |
|---|---|---|---|
| R2.30 a1 | 3 | 1 | 1 |
| R2.30 a2 | 2 | 1 | 2 |
| R2.34 | **4** | **2** | 1 |

> **TEMPERATURE 0 DOES NOT YIELD A STABLE VIOLATION SET.** Three runs over a byte-identical subject produced **three different sets** (3, 2, 4). Exact surface agreement across all three: **10/12 (83.3 %)**. Verdict agreement 3/3 — never for the right reasons.

*(R2.29 live exists but used the v1 16-surface contract; not surface-comparable, excluded from the rate.)*

---

## 11. VALIDATOR REPLAY — reproduces the artifact exactly

`validate ok: true` → `boundary_review_reject`, violations `branch[0].RWS, branch[0].action[0], branch[1].RWS, branch[1].action[1]`.

| Condition | Result |
|---|---|
| exact Cartesian coverage 1 × 12 | PASS |
| every row a valid parity state | PASS 12/12 |
| governed evidence own-surface grounded | PASS 12/12 — **including both FPs** |
| prerequisite evidence grounded (own+inherited+context) | PASS 4/4 — **including both FPs** |
| mechanism ≠ none on a violation | PASS |
| reason required only where the table says | PASS |
| **prerequisite polarity** | **RULE DOES NOT EXIST** |
| **satisfaction/failure contradiction** | **RULE DOES NOT EXIST** |
| **governed-action category** | **RULE DOES NOT EXIST** |
| **evidence-source declaration** | **FIELD DOES NOT EXIST** |

**Every rule the validator has is a LOCATION rule.** Both false positives quote real text from permitted sources; nothing asks what the text *means* relative to the boundary.

The satisfaction statement inside `governedActionEvidence` is **read by no predicate** — the same write-only shape R2.28 measured in the broad reviewer, one layer down.

---

## 12. PRODUCT IMPACT — **MULTIPLE PRODUCT RISKS**

- Scenario **would be** `generation_rejected` and regenerated.
- Correction packet carries **four** codes, **two of them against safe text**: the branch that correctly verifies both patients, and an administrative report action.
- **`primary[1]` receives no correction at all.**
- **A retry could rewrite the safe verified branch while leaving *"Notify the families and proceed with one patient"* intact — safety-inverting.**
- `MAX_GENERATION_ATTEMPTS = 2` and the branch[0] false positive is stable **3/3** → a regenerated scenario that again describes a correctly-verified branch trips it again → `generation_rejected`.
- An **actually safe** scenario mentioning any operational cost is exposed to the same stable false positive.

**Boundary safety issue + generation availability issue + correction-packet quality issue.**

---

## 13. OPTIONS

| Option | Result |
|---|---|
| 1 · prompt clarification only | **REJECTED AS PRIMARY** — zero deterministic authority; may *increase* the already-stable false negative |
| 2 · **explicit prerequisite-status contract** | **ADOPT** — precedence rule 1; makes contradiction computable |
| 3 · **evidence-source locality** | **ADOPT WITH 2** — one authority, not two; a blanket ban would kill a true positive |
| 4 · path-state transitions | **DEFER** — strongest, but larger, and conditional on rule 1 first (R2.37 candidate) |
| 5 · deterministic contradiction gates | **ADOPT AS PART OF 2** — it is the *consumer* of the fields, not a separate slice |
| 6 · second narrow adjudication | **REJECTED FOR NOW** — a second call to arbitrate a contract that cannot express the disagreement |
| 7 · stronger reviewer model | **BLOCKED BY PRECEDENCE** — both FPs are structurally *valid* today; a stronger model can emit the same DTO |

---

## 14. SMALLEST NEXT CORRECTION

### R2.36 — PREREQUISITE TRUTH + EVIDENCE LOCALITY AUTHORITY (**option A**)

1. Add `governedActionStatus` (present | absent | uncertain) and `prerequisiteStatus` (satisfied | explicitly_missing | not_established | contradicted | uncertain | not_applicable).
2. Add `prerequisiteSatisfactionEvidence`, and declare `evidenceSource` (own_surface | inherited_state | resulting_state) per evidence field.
3. **Deterministic gates the server can finally run:** a violation requires `governedActionStatus: present` **and** `prerequisiteStatus ∈ {explicitly_missing, contradicted}`; `satisfied` + a failure claim ⇒ `boundary_assessment_contradiction`; failure evidence from `inherited_state` requires the surface's **own** governed action to be present.
4. **Companion, measured as material:** include the **scenario opening** in the narrow request — `primary[1]` is currently judged as a bare label with no premise.
5. **Re-measure `primary[1]` afterwards. This slice does not claim to fix it.**

**Gate:** a regression from **this live DTO** — both false positives refused deterministically, **both** true positives surviving unchanged **including `branch[1].action[1]` with its inherited-state evidence** — plus a cross-run fixture pinning the three measured violation sets.

**Excluded:** urgency · communication axis · c09 · generator changes · broad-review redesign · deployment · path-state transitions.

---

## 15. UNRESOLVED

- **`primary[1]` is a stable false negative (3/3).** No server gate can create a finding the model declined to assert. The recommended slice improves elicitation and restores the missing premise — the outcome must be **re-measured, not assumed**.
- **`branch[1].action[1]` is an unstable true positive (2/3)** at temperature 0.
- `branch[1].tradeoff[1]` ("Focus on caring for the second patient immediately") remains a genuine product question — is "caring for" the governed action? — not a defect.

---

## 16. NO-MUTATION PROOF

| Check | Result |
|---|---|
| HEAD after | `cdfd4ef5b1ce0d839bea535a92063177c990dbad` — unchanged |
| origin/inner-main · tracked tree | unchanged · clean |
| R2.34 live artifact | byte-identical (`a6428d80…`) |
| R2.29 / R2.30 / R2.32 artifacts | byte-identical |
| Live provider call · generation call | **NONE** · **NONE** |
| Database · deployment · new runner | **NONE** · **NONE** · **NONE** |
| Source / test change · commit / push | **NONE** · **NONE** |

Analysis scripts were written to the session scratchpad, outside the repository.
