# SLICE 3.2I-PRACTICE-R5B1A.1-R2.28 — CONFIRMED-BOUNDARY FALSE-NEGATIVE FORENSICS

**READ-ONLY FORENSIC SLICE. No implementation authorized or performed.**

## VERDICT

**F. MULTIPLE CAUSES REQUIRE SEQUENCED CORRECTIONS**

Dominant causes: **B (schema granularity gap)** and **C (evidence-grounding gap)**.
Also present and measured: **A (request omission, replay/production divergence)**, **D (derived-defect logic gap)**, **E (reviewer model semantic failure)**.

---

## 1. ARTIFACT IDENTITY

| Field | Value | Match |
|---|---|---|
| HEAD | `508cbeb4ecbe816e7750de7516e8a76527b18903` | ✅ |
| HEAD == origin/inner-main | yes | ✅ |
| Tracked tree | clean | ✅ |
| Manifest | `1deeb9372131550c63fc3ca98fcd877840411d1714b7c66a68c80e33edae6dda` | ✅ |
| Live replay artifact | `.eval-artifacts/practice-review.reviewreplay.live.20260801T052044Z.pass2.c18-constrained-clinical.a2.7b97042f3222.json` | ✅ |
| Artifact SHA-256 | `c7f94324cbdc4ecdfd3fa0fb58e8c96efd57beaae54e821bfc881fa03ced378a` | ✅ |
| Source artifact SHA-256 | `7f5292f32f05c5051700c4ac5fd4d556c1e905b8b9d069536f9412cdae8d79cb` | ✅ |
| reviewSubjectSha256 | `7b97042f3222…6693db` | ✅ |
| boundaryProvenanceSha256 | `69e89b33ca35…f28590` | ✅ |
| reviewContractSha256 | `32310122c1b2…527104` (recomputed locally, identical) | ✅ |
| scenarioSha256 | `eec15f10ce2e…265a6` | ✅ |
| mode / reconstructed / sourceKind | live / true / historical_reconstruction | ✅ |
| Reviewer calls / generation calls | 1 / 0 | ✅ |
| finishReason / sanitizedError | `stop` / `null` | ✅ |
| Credential or provider-account data | **NONE** (pattern scan: 0 matches) | ✅ |

Both reconstruction sources agree on the same normalized boundary digest `b2d2d216…89360c`.

**Active boundary:** `c1_verify` — *"Two identifiers must be verified before treatment"* (manager_entered, order 0, active).

---

## 2. EXACT REVIEW REQUEST — AND ITS OMISSION

The live call went through `src/lib/bty/foundry/arena/reviewFrozenSubject.ts`.

- **System prompt:** `REVIEW_SYSTEM_PROMPT` — 10 365 chars, 54 lines, unmodified.
- **User payload keys:** `branches, constraints, flatAction, flatTradeoff, opening, primary, visibleChoices` (4 144 chars).
- **Boundary projection:** `[{"id":"c1_verify","statement":"Two identifiers must be verified before treatment"}]`
- **Schema:** `bty_practice_semantic_review_v1`, strict.
- **Sampling:** `temperature 0, top_p 1, max_tokens 16000, timeout 120000ms`.
- **Field bounds:** text max 100; `violatedChoiceReferences` maxItems 4; `boundaryAssessments` no maxItems.

### Was the reviewer explicitly told that every choice AND every resulting world state must comply?

**NO.**

| Surface | Instruction |
|---|---|
| Primary choices | ✅ present — prompt L42 `allPrimaryChoicesComply` |
| Tradeoff choices | ✅ present — prompt L42 `allTradeoffChoicesComply` |
| Action choices | ✅ present — prompt L42 `allActionChoicesComply` |
| **Resulting world states** | ❌ **ABSENT** |

**Exact omission.** The CONFIRMED-BOUNDARY GROUNDING section (L37–L44) never names a resulting world state as a compliance surface. The phrase "resulting world state" appears only at L18 (Branch Review), L31 (Same-Branch Progression) and L33 (Cross-Branch Diversity) — all non-boundary contracts.

Worse: the **production** path (`arenaScenarioGenerationService.ts:724-728`) sends two fields this replay did **not**:

```
activeBoundaryCount: 1
boundaryComplianceScope: "Every primary, tradeoff and action choice — and every
  resulting world state — must comply with EVERY boundary listed in `constraints`.
  Return exactly one boundaryAssessment per listed id."
```

Grep-verified: those two identifiers exist **only** in `arenaScenarioGenerationService.ts` and one contract test. `reviewFrozenSubject.ts` omits both. **This artifact measures a weaker request than production.** That divergence is itself a defect requiring repair.

It is **not sufficient** to explain the false negative: even with the scope sentence, the schema offers no field in which a per-choice or per-world-state answer could be recorded, and no derivation reads the free-text `branches[].boundaryState` where it would land.

---

## 3. THE CENTRAL FINDING

**The reviewer perceived the violation and wrote it down eight times — in fields no predicate reads.**

| Field | Verbatim value |
|---|---|
| `primaryChoices[1].acceptedCost` | "Risk of not verifying identifiers before treatment" |
| `phaseChoices[primary,1].conciseExplanation` | "This choice addresses family concerns but risks patient safety." |
| `phaseChoices[flat_action,1].acceptedCost` | "Risks safety by not verifying identifiers" |
| `branches[1].resultingWorldState` | **"One patient is treated without verification, risking safety"** |
| `branches[1].selectedPrimaryEffect` | "Treatment of one patient without verification" |
| `branches[1].causalLink` | "Treatment without verification leads to risk" |
| `branches[1].resourceOrRelationshipChange` | "Potential compromise of patient safety" |
| `urgency.choices[1].foreseeableHarm` | "Risk of not verifying identifiers before treatment" |

Simultaneously, **every structured field asserted compliance**:

```
boundaryCompliant           = true
violatedBoundaryIds         = []
allPrimaryChoicesComply     = true
allTradeoffChoicesComply    = true
allActionChoicesComply      = true
allBranchesPreserve         = true
prohibitedAlternativeExcluded = true
violatedChoiceReferences    = []
violatedBranchReferences    = []
branches[1].boundaryState   = "c1_verify is operational"
phaseChoices[*].unsafe      = false  (all 14)
urgency.overallUrgencyVerdict = "safe"
overallVerdict              = "accept"
```

`boundaryAssessments[0].conciseExplanation` = *"The verification boundary is present and operationalized, ensuring compliance."* — a bare assertion with zero evidence, and structurally valid.

---

## 4. BOUNDARY COVERAGE

Coverage was **exactly correct** — R2.27's repair worked. `boundaryIdsConsidered == ["c1_verify"]`, exactly one assessment, no duplicate, no unknown, no omission, normalized text agrees with provenance. **Coverage is not the defect.**

### Coverage matrix (16 decision surfaces)

| # | Surface | Explicitly assessed | Reviewer result | Human oracle | Alignment |
|---|---|---|---|---|---|
| 1 | primary p1 · Verify identifiers for both patients now | ❌ | compliant (aggregate) | COMPLIES | ✅ |
| 2 | **primary p2 · Notify the families and proceed with one patient** | ❌ | compliant | **VIOLATES** | ❌ |
| 3 | flat tradeoff ft1 | ❌ | compliant | NEUTRAL | ✅ |
| 4 | flat tradeoff ft2 · Escalate / request staff | ❌ | compliant | COMPLIES | ✅ |
| 5 | flat action fa1 · Continue verification for both | ❌ | compliant | COMPLIES | ✅ |
| 6 | **flat action fa2 · Proceed with treatment for the first patient only** | ❌ | compliant | **VIOLATES** | ❌ |
| 7 | branch p1 tradeoff p1-t1 | ❌ | compliant | NEUTRAL | ✅ |
| 8 | branch p1 tradeoff p1-t2 | ❌ | compliant | NEUTRAL | ✅ |
| 9 | branch p1 action p1-a1 | ❌ | compliant | NEUTRAL | ✅ |
| 10 | branch p1 action p1-a2 | ❌ | compliant | COMPLIES | ✅ |
| 11 | branch p2 tradeoff p2-t1 | ❌ | compliant | NEUTRAL | ✅ |
| 12 | **branch p2 tradeoff p2-t2 · Focus on caring for the second patient immediately** | ❌ | compliant | **VIOLATES** (weaker: "caring", not verbatim "treatment") | ❌ |
| 13 | branch p2 action p2-a1 | ❌ | compliant | NEUTRAL | ✅ |
| 14 | **branch p2 action p2-a2 · Immediately treat the second patient** | ❌ | compliant | **VIOLATES** | ❌ |
| 15 | p1 resulting world state | ❌ | compliant (free-text `boundaryState`) | COMPLIES | ✅ |
| 16 | **p2 resulting world state** | ❌ | compliant (free-text `boundaryState`) | **VIOLATES** | ❌ |

**0 of 16 surfaces were explicitly assessed. 5 mismatches.**

### Does the schema require this granularity?

**NO.** One aggregate `BoundaryAssessment` per boundary id. Four booleans cover all 14 choices. **No field covers a resulting world state.** `phaseChoices` has no boundary field of any kind. `violatedChoiceReferences` is an optional free-string array that satisfies `required` while empty — so *compliance costs zero evidence*.

---

## 5. THE EXACT FALSE-NEGATIVE PATH

**Primary p2** → *"Notify the families and proceed with one patient"*
**Frozen resulting state** → *"…this left the second patient unverified, creating potential safety concerns and administrative issues."*
**Downstream** → `p2-a2` *"Immediately treat the second patient"* — treating the patient the branch itself declares unverified.
**Outside the branch** → `fa2` *"Proceed with treatment for the first patient only"*, paired against `fa1` *"Continue with the verification process for both patients"* — the contrast makes `fa2` the treat-before-verify option.

| # | Question | Answer |
|---|---|---|
| 1 | Quoted or paraphrased the violation? | **YES** — 8 fields |
| 2 | Claimed the primary was boundary-compliant? | **YES** |
| 3 | Claimed the resulting state was boundary-compliant? | **YES** — `boundaryState = "c1_verify is operational"` |
| 4 | Omitted the resulting state entirely? | **NO** — recorded verbatim |
| 5 | Treated notification as a substitute for verification? | **YES**, in the urgency record |
| 6 | Interpreted "proceed with one patient" as verification? | **NO** — read it as "Treatment of one patient without verification" |
| 7 | Relied on an unrelated safetyBasis? | **YES** |
| 8 | Any detail field independently contains violation evidence? | **YES** — 8 of them |
| 9 | Why no derived boundary defect? | Every predicate reads only booleans, enums and string arrays. All were set compliant. No predicate reads `acceptedCost`, `resultingWorldState`, `selectedPrimaryEffect`, `causalLink`, `conciseExplanation` or `boundaryState`. |
| 10 | Did the consistency gate have contradictory detail to use? | **NOT IN THE FORM IT READS** — see below |

### The decisive counterfactual

Flipping **only** `overallVerdict` to `reject`, changing nothing else:

```
ok: false   errors: ["review_reject_without_defect"]   defects: []
```

The detail fields, read as the derivation reads them, establish **zero** defects — a forced reject is itself rejected as unsupported.

> **The gate had contradictory prose but no contradictory structure. Removing top-level verdict authority would not help. The defect is in what the details ENCODE, not in the verdict's authority over them.**

---

## 6. URGENCY INTERACTION

```
foreseeableHarm : "Risk of not verifying identifiers before treatment"   ← same as previously measured
safetyBasis     : "Addressing family concerns while ensuring some treatment occurs"
overallUrgencyVerdict : "safe"
```

The named harm is the absence of two-identifier verification. The stated basis offers family reassurance and partial treatment. Neither restores nor substitutes for the verification predicate — **it restates the choice instead of justifying it.**

Current rule (`semanticReview.ts:702`):
```js
if (c.foreseeableHarm.trim() && !c.safetyBasis.trim()) defects.push("avoidable_foreseeable_harm");
```
**Presence-only.** The basis is non-empty, so it does not fire. Measured: `false`.

- Urgency and boundary review **agree** — both say compliant/safe. There is no internal disagreement to exploit.
- **A DTO can be internally consistent while containing a semantically invalid safety basis. PROVEN** — `ok=true, verdict=accept, defects=[], errors=[]`.
- Naive fix ("non-empty foreseeableHarm ⇒ defect") **fires on choices [0,1]** — a false positive on the compliant verify-first pause, which prompt L50 explicitly protects ("Time cost alone is NOT a defect"). A correct rule needs a **new structured harm-resolution field**, not a tightened predicate.

**Classification: NECESSARY BUT INSUFFICIENT.** It would catch this artifact, but only because the urgency contract happened to name the boundary. A boundary violation in a scenario with no urgency leaves the urgency record silent.

*The urgency rule was not modified in this slice.*

---

## 7. DETERMINISTIC DERIVATION REPLAY

Local, no network, no model:

```
validateSemanticReview(artifact.reviewResponse, {primaryCount:2, branchCount:2,
                       constraintIds:["c1_verify"], choices:enumerateChoices(draft)})

ok: true   verdict: accept   defects: []   errors: []   derivedDefects: []
```

Reproduces the artifact exactly. Decisive false conditions:

| Condition | Input | Fired |
|---|---|---|
| `!allPrimaryChoicesComply \|\| !allTradeoffChoicesComply \|\| violatedChoiceReferences.length>0` | true, true, [] | ❌ |
| `!allActionChoicesComply` | true | ❌ |
| `!allBranchesPreserve \|\| violatedBranchReferences.length>0` | true, [] | ❌ |
| `foreseeableHarm && !safetyBasis` | non-empty, non-empty | ❌ |
| `overallUrgencyVerdict === "unsafe"` | "safe" | ❌ |

**Skipped derivations** — fields captured but read by no predicate:
`branches[].boundaryState` (**write-only**, grep-verified), `resultingWorldState` (overlap comparison only), `acceptedCost` (non-empty check only), `phaseChoices[].conciseExplanation`, `selectedPrimaryEffect`, `causalLink`, `delayPurpose`.

### Counterfactuals

| | Would have caught this artifact | Basis |
|---|---|---|
| **A** per-choice boundary evidence | LIKELY, not deterministic | Targets a question the model already answers correctly in prose |
| **B** evidence for resulting world states | **MOST LIKELY** | The single most damning sentence is already written in that exact field |
| **C** safetyBasis must answer foreseeableHarm | YES if semantic; NO if presence-based | Needs a new structured field |
| **D** foreseeable harm as hard defect unless resolved | YES but false-positives (measured: [0,1]) | Collapses into C once a resolution field exists |
| **E** narrow boundary-only reviewer | LIKELY, highest signal | Removes the 14-choice / 8-contract load |

**None catches it deterministically from the current DTO** — every structured field says compliant and the violation exists only as prose. Ranked by likelihood on re-ask: **B > A > E > C > D**.

---

## 8. CONTRACT ADEQUACY

**E. MULTIPLE CONTRACT DEFECTS** — composed of **B (structurally insufficient)** + **C (adequate for coverage, insufficient for evidence)**.

- Boundary fields: 4 top-level, 14 per-assessment, **0 per-choice**, 1 per-world-state (free text, unread).
- All 14 assessment fields are `required`, but two are arrays that satisfy `required` while empty → **compliance costs zero evidence**.
- One assessment can cover 14 choices and 2 world states: **yes**.
- Compliance is represented **three** redundant ways (`boundaryCompliant`, `violatedBoundaryIds`, four booleans) — all self-consistent when the model simply asserts compliance, so redundancy adds no cross-check.
- The top-level verdict can remain `accept` when boundary detail is semantically wrong but structurally clean: **yes, proven**.

---

## 9. OPTIONS

| Option | Result | Added calls | Note |
|---|---|---|---|
| 1 · broad review + one rerun | **REJECTED** | +1 | temperature=0 — a rerun re-measures the same failure. No isolated-anomaly evidence exists. |
| 2 · fail-closed urgency adequacy | **DEFER (= R2.30)** | 0 | Real but proxy net; naive form false-positives on the compliant pause. |
| 3 · per-choice boundary evidence contract | **RECOMMENDED** | 0 | Addresses B, C, D and the world-state blind spot. Needs a NEUTRAL result value and a token-headroom measurement. |
| 4 · narrow independent boundary review | **DEFER** | +1/scenario | Precedence step 3; step 1 has not been tried. Would need a precedence rule between two boundary verdicts. |
| 5 · deterministic text invariant | **NOT ADOPTED as a safeguard** | 0 | Brittle; must not be presented as semantic compliance. |
| 6 · stronger reviewer model | **BLOCKED BY PRECEDENCE** | 0 | Precedence rule 4 requires an adequate, granular contract first. It is measured not adequate. |

---

## 10. SMALLEST NEXT CORRECTION

### Slice 3.2I-PRACTICE-R5B1A.1-R2.29 — PER-DECISION-SURFACE BOUNDARY EVIDENCE AUTHORITY (Option 3)

Satisfies precedence rule **1** (repair missing or insufficient boundary evidence authority).

1. Extend the review schema so **every** decision surface carries, per active boundary, a compliance result (`complies | violates | not_applicable`) plus **required** concrete scenario evidence — the 14 visible choices **and the 2 resulting world states**.
2. Make non-empty evidence a validation requirement for a `complies` result, so bare assertion becomes unrepresentable.
3. Extend the deterministic derivation to consume the new per-surface results **and** `branches[].boundaryState`, which is currently write-only.
4. Companion one-line repair: add `activeBoundaryCount` and `boundaryComplianceScope` to the `reviewFrozenSubject` payload so the replay request is contract-equivalent to production.

**Excluded:** c01 communication axis · c09 phase progression · generator construction metadata · generation model routing · general full-review splitting · urgency-rule modification · reviewer model change.

**Gate:** failing regression fixtures built from this frozen c18 subject (`7b97042f3222…`) must fail before and pass after; token-budget headroom measured across all 3 canary cases with no `finishReason="length"`.

**Urgency-slice relationship:** **R2.30 remains a SEPARATE slice, sequenced after R2.29.** It is not a necessary component of the boundary correction — merging them would couple two schema growths into one already-large call and raise truncation risk.

---

## 11. NO-MUTATION PROOF

| Check | Result |
|---|---|
| HEAD after | `508cbeb4ecbe816e7750de7516e8a76527b18903` — unchanged |
| origin/inner-main | unchanged |
| Tracked tree | clean |
| Live replay artifact | byte-identical (`c7f94324…`) |
| Source artifact | byte-identical (`7f5292f3…`) |
| Reconstruction sources | byte-identical |
| Review contract digest | recomputed `32310122…` — unchanged |
| Live model call | **NONE** |
| Generation call | **NONE** |
| Database connection | **NONE** |
| Deployment | **NONE** |
| New runner | **NONE** |
| Commit / push | **NONE** |
| Source / test modification | **NONE** |

Analysis scripts were written to the session scratchpad, outside the repository.
