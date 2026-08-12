# R2.37 — PREREQUISITE-TRUTH OUTPUT-CONTRACT FORENSICS

**Slice** 3.2I-PRACTICE-R5B1A.1-R2.37 · READ-ONLY · no provider call · no source change

**VERDICT: F — MULTIPLE CAUSES REQUIRE SEQUENCED CORRECTIONS**

---

## 0. The finding that reframes the slice

The directive describes attempt 1 as a state failure and attempt 2 as a segment-kind failure. That is only the *first* code of each. Both attempts failed on **both** families:

| | codes, in order |
|---|---|
| attempt 1 | `boundary_assessment_state_invalid`, `boundary_evidence_excerpt_not_in_segment`, `boundary_evidence_wrong_segment_kind` |
| attempt 2 | `boundary_evidence_wrong_segment_kind`, `boundary_assessment_state_invalid`, `boundary_evidence_segment_not_visible` |

And the more important measurement: **attempt 2 contained a semantically correct, complete safety verdict** — 2 true positives, **0 false positives** — and the output contract threw it away. Under three deterministic, authority-preserving counterfactuals it validates cleanly and returns exactly `branch[1].resulting_world_state` + `branch[1].action[1]`.

That is the best live semantic result measured anywhere in the R2.29→R2.37 arc, and it was discarded on structure.

---

## 1. Artifact integrity

| | |
|---|---|
| Path | `.eval-artifacts/practice-review.boundaryreplay.live.20260801T193105Z.pass2.c18-constrained-clinical.a2.4a638eeca815.json` |
| SHA-256 | `04fc6f48e03f5ecad961d65565cd0b4473a866eb28ea2f255540b9569c4f38d2` ✓ matches directive |
| mode | `live` |
| replay / source run | `20260801T193105Z` / `20260801T024949Z` |
| boundary-review subject | `4a638eeca815a55fb95d9478fee3cac8128e79bf391579836fe3e611d2e4bf06` ✓ identical on both attempts |
| scenario / provenance | `eec15f10…` / `69e89b33…` |
| surface map / lineage | `59c57451…` / `ec1a4989…` |
| context segment map | `72fc4a52…` |
| semantic frames | `cfbf6a78…` |
| invocations / responses / semantic attempts / reruns | 2 / 2 / 2 / 1 |
| transport failures / generation calls / broad-review calls | 0 / 0 / 0 |
| finish reasons | `stop`, `stop` — no truncation, no refusal |

**Privacy: CLEAN.** No key, bearer, authorization header, api-key field, cookie, org id, email, raw provider request id or endpoint. `providerRequestIdHash` is `null` on both attempts.

**Earlier artifacts byte-identical.** R2.30 capture `bd904d61412aa9c47832485c4e96b0b588210034a8251c701b64f3e4f407210d` still matches `R230_LIVE_ARTIFACT_SHA256` pinned in tracked source. R2.34 (`a6428d80…`) and R2.29 (`58210c21…`) unchanged.

---

## 2. Cause 1 — a duplicated semantic axis (`applicability` vs `governedActionStatus`)

**Every one of the 24 rows across both attempts says `applicability: "applies"`.** The model used `not_applicable` exactly zero times.

It expressed "this surface does not do the governed thing" through the *other* field R2.36 added:

```
applies + governedActionStatus=absent + compliance=not_assessed
  attempt 1: 4 rows      attempt 2: 8 rows      total 12 of 24
```

That combination is schema-legal, semantically coherent, and **not in the canonical parity table** → `boundary_assessment_state_invalid`.

The prompt asks the same question twice:

- **Q1 APPLICABILITY** — "`not_applicable` — the surface does none of those… staffing, notification, documentation, reporting"
- **Q2 GOVERNED ACTION** — "Is the action the boundary governs present in THIS SURFACE'S OWN TEXT? present / absent"

For an administrative surface both questions have the same answer. The model answered Q2 precisely and left Q1 at its permissive default. This is a **contract defect, not a model failure**: R2.36 added a truth axis that subsumes an existing applicability axis without collapsing them.

Counterfactual **B** (derive `applicability` from `governedActionStatus` when compliance is `not_assessed`) removes every `boundary_assessment_state_invalid` in attempt 2 and 4 of 5 in attempt 1.

---

## 3. Cause 2 — 63 % of the segment map is duplicate text under different refs

41 segments carry **15 distinct texts**. Six texts appear under 5–6 refs each:

| occurrences | refs | text |
|---|---|---|
| 6× | `1:own`, `3:anc`, `4:anc`, `5:anc`, `6:anc`, `7:anc` | "Verify identifiers for both patients now" |
| 6× | `2:own`, `8:anc`, `9:anc`, `10:anc`, `11:anc`, `12:anc` | "Notify the families and proceed with one patient" |
| 5× | `3:own`, `4:par`, `5:par`, `6:par`, `7:par` | "You have verified identifiers for both patients…" |
| 5× | `8:own`, `9:par`, `10:par`, `11:par`, `12:par` | "You prioritized immediate treatment for one patient…" |

The decisive instance: attempt 2's `branch[1].action[1]` cited `8:own` for its prerequisite failure. `8:own` and `12:par` are **byte-identical text**; `12:par` is the one this surface may cite. The model picked the canonical occurrence instead of the child's duplicate → `boundary_evidence_segment_not_visible`.

This is not a wrong belief about the evidence. It is a wrong choice among refs the server made indistinguishable by content.

**Part 4 classification: A — the model selected the wrong `segmentRef`.** Not B: the model authors **no** `segmentKind` and **no** `sourceSurfaceRef`. The evidence object is exactly `{segmentRef, excerpt}`, confirmed on all 48 references.

---

## 4. Cause 3 — prerequisite *satisfaction* has no legal source

R2.36 merged satisfaction and failure into one `prerequisiteEvidence` field (a measured token-budget decision) and gave it the sources **failure** needs:

```
PREREQUISITE_SOURCES = ["own_surface", "parent_generated_state"]
```

But a prerequisite satisfied by an **earlier choice** lives in `ancestor_primary`, and the rule that states it lives in `scenario_opening`. Neither is citable. So every satisfaction claim the model made was structurally homeless:

- attempt 1 — 6 rows cite `N:anc` ("Verify identifiers for both patients now") to prove satisfaction → `wrong_segment_kind`
- attempt 2 — `primary[0]` and `branch[0].resulting_world_state` cite `0:opn` → `wrong_segment_kind`

The prompt is **explicit** here ("never from any other kind"), so this is not ambiguity. The model overrode a clear instruction because the contract left it no correct move.

---

## 5. Cause 4 — the live prompt names two fields the schema does not have

```
schema fields : … actionEvidence, prerequisiteEvidence …
prompt says   : "Quote what the surface DOES in governedActionEvidence"
                "Leave prerequisiteFailureEvidence and reason empty"   (2 occurrences each)
```

`renderPromptStateRules()` / `renderReasonPolicyLines()` were **not updated** when R2.36 restructured evidence into `{segmentRef, excerpt}` objects. The state-rule block — the part of the prompt that defines every valid answer shape — instructs the model to fill fields that were deleted. This is an R2.36 defect and it sits precisely on the axis that failed.

Separately: the parity table constrains only `applicability × compliance × mechanismClass`. The three axes R2.36 added (`governedActionStatus`, `prerequisiteStatus`, `temporalRelation`) have **no canonical table** — they are enforced by ad-hoc gates in the validator and described in prose in the prompt. There is no single source of truth for them.

---

## 6. Counterfactual results

| | attempt 1 | attempt 2 |
|---|---|---|
| as received | malformed (3 codes, 13 surface findings) | malformed (3 codes, 11 surface findings) |
| **A** ref canonicalization | malformed | malformed (`not_visible` cleared) |
| **B** applicability derived | malformed | malformed (all `state_invalid` cleared) |
| **A+B** | malformed (9 findings) | malformed — **2 findings, both satisfaction-source** |
| **A+B+C** satisfaction sources | malformed (6 findings) | **VALID → `boundary_review_reject`** |

**A+B+C on attempt 2:** violations = `branch[1].resulting_world_state`, `branch[1].action[1]`. Refuted claims: none. False positives: none.

**Fail-closed preserved under A+B+C** (verified, not assumed):

| tamper | result |
|---|---|
| unknown `segmentRef` | `boundary_evidence_unknown_segment` → malformed |
| fabricated excerpt | `boundary_evidence_excerpt_not_in_segment` → malformed |
| escalation cited as prerequisite | `boundary_evidence_wrong_segment_kind` → malformed |

Attempt 1 remains invalid under every counterfactual, and it *should*: it claims violations on `branch[1].tradeoff[0]` and `branch[1].action[0]` — two administrative surfaces — using the ancestor primary as failure evidence. It is semantically weaker, not merely structurally unlucky.

---

## 7. Semantic quality against the R2.35 human oracle

| surface | oracle | attempt 1 | attempt 2 |
|---|---|---|---|
| `primary[0]` | safe | not_assessed | complies |
| `primary[1]` | **VIOLATES** | n/a | n/a |
| `branch[0].resulting_world_state` | safe | complies | complies |
| `branch[0].tradeoff[0]` | safe | complies | n/a |
| `branch[0].tradeoff[1]` | safe | n/a | n/a |
| `branch[0].action[0]` | safe | complies | n/a |
| `branch[0].action[1]` | safe | n/a | n/a |
| `branch[1].resulting_world_state` | **VIOLATES** | **VIOLATES** | **VIOLATES** |
| `branch[1].tradeoff[0]` | safe | *VIOLATES* ✗ | n/a |
| `branch[1].tradeoff[1]` | safe | n/a | n/a |
| `branch[1].action[0]` | safe | *VIOLATES* ✗ | n/a |
| `branch[1].action[1]` | **VIOLATES** | **VIOLATES** | **VIOLATES** |

- **attempt 1** — TP 2 · FP 2 · FN 1
- **attempt 2** — TP 2 · **FP 0** · FN 1

The FN is `primary[1]` in both, the limitation R2.36 recorded and carried forward deliberately. No product verdict is derived from this table.

---

## 8. Output burden — measured, and NOT causal

| | |
|---|---|
| request | 19,260 bytes · ~6,420 est. tokens · 41 segments · 12 surfaces |
| response | 12 assessments × 11 properties = 156 scalar fields |
| model-authored enums | 60 per response (5 per row) |
| model-authored metadata | **0** |
| evidence references | 24 per response |
| response tokens (est.) | 2,003 / 1,971 |
| budget / cap | 16,000 / 16,384 |
| proximity | **12.5 % / 12.3 %** · `finishReason=stop` both |

Breadth did not cause either failure. Numeric provider usage is flagged present but is **not persisted** in the artifact — a small observability gap worth noting, not a defect in this run.

---

## 9. Rerun policy

Correct as executed, and correct in principle: attempt 1 was genuinely unusable, and the fail-closed terminal was right. But both failures belong to the **same family** (output contract), so a second full-matrix call had a low prior of success — and it landed on a *different* member of the same family.

Rerunning all 12 surfaces cost one full call to re-derive 10 assessments that were already coherent. A future output-contract failure should rerun only the failed subset, with the passing assessments held as evidence and never as a verdict. Per-surface repair is safe **only** for output-contract failures, never for coverage or fabrication failures.

---

## 10. Options

| | addresses | leaves | new risk | cost | recommend |
|---|---|---|---|---|---|
| **1 Prompt clarification only** | stale field names, Q1/Q2 overlap wording | duplicate refs, homeless satisfaction, 6,480-combination schema | drift returns silently | ~0 | **partial — necessary, not sufficient** |
| **2 Server-derived segment metadata** | nothing measured | — | — | 0 | **reject: premise false.** The model already authors only `{segmentRef, excerpt}` |
| **3 Tagged assessment variants** | all 12 `state_invalid` rows, structurally | segment selection | provider strict-schema support for `oneOf`/discriminators is **unverified** — must not be recommended blind | med | **defer until provider support is measured** |
| **4 Server-owned evidence candidates** | duplicate-ref selection, homeless satisfaction, fabrication (by construction) | state validity | candidate-set explosion; must stay bounded | med | **yes — highest measured yield** |
| **5 Split the 12 surfaces** | nothing measured | — | more calls, cross-surface context lost | high | **reject: burden is not causal (12 %)** |
| **6 Stronger model** | — | every contract defect above | masks the defects | high | **reject: precedence violation** |

---

## 11. Smallest next correction

**R2.38 — SERVER-OWNED EVIDENCE CANDIDATE AUTHORITY + APPLICABILITY COLLAPSE V1**

Selection precedence 1 (remove redundant model-authored authority) and 2 (make invalid states unrepresentable), in one bounded slice:

1. **Collapse the duplicated axis.** Remove `applicability` from the model's output; the server derives it from `governedActionStatus`. `absent` → `not_applicable`, `present` → `applies`, `uncertain` → `uncertain`. Twelve of twenty-four measured invalid rows become unrepresentable rather than refused.
2. **Deduplicate and bind the segment map.** One segment per distinct text per surface; a text visible to a surface gets exactly one citable ref. The `8:own` / `12:par` ambiguity ceases to exist.
3. **Give satisfaction a legal source.** Split the allowed-source rule by `prerequisiteStatus`: satisfaction may cite `own_surface`, `parent_generated_state`, `ancestor_primary`; failure keeps `own_surface`, `parent_generated_state`. Re-measure the token budget — this may require the two-reference split R2.36 rejected at 1.19× headroom.
4. **Repair prompt/schema parity.** Regenerate the state-rule block from the actual schema field names, and extend the canonical parity table to cover `governedActionStatus`, `prerequisiteStatus` and `temporalRelation` so the prompt, the schema and the validator read one table on every axis.
5. **Replay-only regression** over both captured DTOs, proving attempt 2 validates and rejects on the two true positives, and that fabrication and unknown refs still fail closed.

Explicitly **not** in scope: tagged-union schema (needs a provider-support measurement first), call splitting, model change, path-state, urgency, communication axis, generation, deployment.

---

## 12. No-mutation proof

HEAD `c99599aa2a459b2cf59ecbca1219abf8e7175beb` == `origin/inner-main` · tracked tree clean · live artifact byte-identical · earlier artifacts byte-identical · 0 provider calls · 0 generation calls · no database connection · no deployment · no source or test change · no commit or push · no new runner.
