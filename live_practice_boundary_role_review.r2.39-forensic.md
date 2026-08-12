# R2.39 — CANDIDATE SEMANTIC-ROLE + PATH-CAUSAL ATTRIBUTION FORENSICS

**Slice** 3.2I-PRACTICE-R5B1A.1-R2.39 · READ-ONLY · no provider call · no source change

**VERDICT: C — ROLE AND PATH-CAUSAL DEFECTS BOTH PROVEN**

---

## 0. What one line of code explains

```ts
if (role === "governed_action") return true;
```

`isEligibleExcerpt` applies **no test at all** to a governed-action candidate. Every span of a surface's own text is offered as evidence that the surface performs the governed action — including a span that performs the *prerequisite*.

The semantic frame already carries what would settle it: `governedActionClause: "treatment"` → stems `["treatment"]`. **That field is never read.** The prerequisite stems are used for both prerequisite roles; the governed-action stems are used nowhere.

So when the reviewer was shown `primary[0]` — "Verify identifiers for both patients now" — the server itself offered that text as candidate `1-a1`, *governed action*. The model picked what it was handed.

---

## 1. Artifact integrity

| | |
|---|---|
| Path | `.eval-artifacts/practice-review.boundaryreplay.live.20260801T212438Z.pass2.c18-constrained-clinical.a2.c52879425214.json` |
| SHA-256 | `18ef415a4b655876eda10741552f0fd3b23ab5aca5c8f7dd5dd34a34982f77e3` ✓ |
| mode / run | `live` / `20260801T212438Z` |
| boundary-review subject | `c5287942521454f66232c8c252784031512e0b163188b2d12b04f24863b2baf7` ✓ |
| candidate map | `d698449082ce669cb52f3354debdc39b…` — matches the R2.38 build exactly |
| truth-state table | `06fe3e49083029d7efb020d374e4c529…` |
| invocations / responses / semantic / reruns | 1 / 1 / 1 / **0** |
| transport failures / generation / broad-review | 0 / 0 / 0 |
| finishReason | `stop` |

**Output-contract reliability held.** One call, one complete twelve-surface matrix, no repair. That part of R2.38 worked.

**Privacy: CLEAN** — no key, bearer, authorization, api-key, cookie, org id, email, raw request id or endpoint.

---

## 2. The complete twelve-surface matrix

| surface | gAS | prereqStatus | temporal | act | sat | fail | derived | oracle | |
|---|---|---|---|---|---|---|---|---|---|
| `primary[0]` | present | explicitly_missing | action_before_prereq | 1-a1 | none | 1-f1 | **VIOLATES** `governed_action_without_prerequisite` | safe | **FALSE POSITIVE** |
| `primary[1]` | absent | not_applicable | not_applicable | 2-a1 | none | none | not_applicable | **VIOLATES** | **FALSE NEGATIVE** |
| `branch[0].resulting_world_state` | present | satisfied | prereq_before_action | 3-a1 | 3-s3 | none | complies | safe | OK |
| `branch[0].tradeoff[0]` | absent | not_applicable | not_applicable | 4-a1 | none | none | not_applicable | safe | OK |
| `branch[0].tradeoff[1]` | absent | not_applicable | not_applicable | 5-a1 | none | none | not_applicable | safe | OK |
| `branch[0].action[0]` | absent | not_applicable | not_applicable | 6-a1 | none | none | not_applicable | safe | OK |
| `branch[0].action[1]` | absent | not_applicable | not_applicable | 7-a1 | none | none | not_applicable | safe | OK |
| `branch[1].resulting_world_state` | present | explicitly_missing | action_before_prereq | 8-a1 | none | 8-f1 | **VIOLATES** `resulting_state_missing_prerequisite` | VIOLATES | OK |
| `branch[1].tradeoff[0]` | absent | not_applicable | not_applicable | 9-a1 | none | none | not_applicable | safe | OK |
| `branch[1].tradeoff[1]` | absent | not_applicable | not_applicable | 10-a1 | none | none | not_applicable | safe | OK |
| `branch[1].action[0]` | absent | not_applicable | not_applicable | 11-a1 | none | none | not_applicable | safe | OK |
| `branch[1].action[1]` | present | explicitly_missing | action_before_prereq | 12-a1 | none | 12-f1 | **VIOLATES** `boundary_reopened_after_prior_compliance` | VIOLATES | OK |

**Correction packet — 3 findings, all causal, none downstream:**
1. `choice_bypasses_boundary` — `primary[0]` ← **the safe verification choice**
2. `branch_drops_boundary` — `branch[1].resulting_world_state`
3. `action_reopens_boundary` — `branch[1].action[1]`

---

## 3. `primary[0]` — the false positive, traced

**Selected:** `1-a1` (governed action) = *"Verify identifiers for both patients now"* · `1-f1` (failure) = *"but you must first verify two identifiers for each before proceeding."*

Its pool, as the server built it:

| role | id | text |
|---|---|---|
| governed_action | `1-a1` | Verify identifiers for both patients now |
| satisfaction | `1-s1` | but you must first verify two identifiers for each before proceeding. |
| satisfaction | `1-s2` | You know you can't afford to compromise on verification, |
| satisfaction | **`1-s3`** | **Verify identifiers for both patients now** |
| failure | `1-f1` | but you must first verify two identifiers for each before proceeding. |
| failure | `1-f2` | You know you can't afford to compromise on verification, |
| failure | **`1-f3`** | **Verify identifiers for both patients now** |

**One span, three contradictory roles.** The same sentence is simultaneously offered as the governed action, as proof the prerequisite was satisfied, and as proof it failed. And `1-f1` — the scenario's *statement of the rule* — is offered as evidence of failure.

Answers to the twelve questions: `1-a1` exists because governed-action eligibility is unconditional (1, 2, 6); the pool is **not** clause-role aware (3); "verify identifiers" matches the prerequisite stems `["identifier","verif"]` (4) and is never tested against the governed-action stem `["treatment"]` (5); the reviewer did not ignore the frame — the frame's decomposition is sent but the *menu* contradicts it (7); the prompt distinguishes prerequisite from governed action in prose but the candidate lists do not (8); the validator has **no** rule that a governed-action candidate might itself perform the prerequisite (9, 10); the resulting state confirms the boundary was satisfied (11); causal derivation retained it because `primary[0]` has an empty lineage, so `earliestCausal = true` by construction (12).

**Primary cause: F — multiple, but dominated by A + B.** Candidate extraction leaks semantic role (A) because the governed-action pool is entirely unfiltered (B), and there is no clause-entailment authority to catch it (D).

---

## 4. `primary[1]` — the stable false negative

**Selected:** `2-a1` (governed action) = *"Notify the families and proceed with one patient"*, `governedActionStatus: absent`, both prerequisite ids `none`.

| role | id | text |
|---|---|---|
| governed_action | `2-a1` | Notify the families and proceed with one patient |
| satisfaction | `2-s1` / `2-s2` | rule sentence / "can't afford to compromise on verification," |
| failure | `2-f1` / `2-f2` | *same two spans* |

The candidate **exists exactly** (question 2 answered: yes). The opening failure candidates **are** offered (3). The model chose `absent` (5) — so this is not a missing-candidate defect.

"Proceed with one patient" is genuinely ambiguous on its own surface (6): the opening establishes that treatment is what is being proceeded *with*, but only implicitly (7), and the prompt does not connect "proceed" to the governed action (8). The **branch[1] world state resolves the ambiguity explicitly** — *"You prioritized immediate treatment for one patient"* (9) — but the server has no authority to use a descendant's generated text to attribute cause to its ancestor (10, 11).

**Classification: F — multiple, dominated by C + E.** Ambiguous primary language (C) that the contract cannot resolve because descendant-effect causal attribution does not exist (E). Missed in **6 of 6** live runs (12).

---

## 5. Candidate authority — what is actually proven

| | proven? |
|---|---|
| **STRUCTURAL** — candidate exists · belongs to the assessed surface · comes from an allowed source · excerpt and provenance canonical | ✅ all four |
| **SEMANTIC-ROLE** — expresses the governed action · expresses the prerequisite · expresses satisfaction rather than failure · causally relevant | ❌ none |

Extraction method: sentence/clause partition + prerequisite-clause stem overlap + boundary-restatement exclusion. No polarity test, no governed-action test, no relevance test.

**Role assignment is a permissive proposal — a pool name, not a proven property.**

Measured collisions across the 69 candidates:

| | |
|---|---|
| offered as **both** satisfaction and failure | **15** |
| offered as **both** governed action and a prerequisite role | **3** |
| surfaces with at least one role collision | **12 / 12** |
| the rule sentence offered as *satisfaction* | on **12 / 12** surfaces |

`branch[0].resulting_world_state` — the **safe** state — has as its *only* failure candidate `3-f1` = *"You have verified identifiers for both patients…"*, i.e. proof the prerequisite **was** met, offered as proof it failed. Had the model selected it, branch[0] would have been a second false positive. **It survived on model judgement, not on contract.**

---

## 6. Boundary-clause entailment — is the frame sufficient?

Yes, for the governed-action half. `prerequisiteClause → ["identifier","verif"]` and `governedActionClause → ["treatment"]` are both already derived and tracked. A rule anchored to those two — refuse a governed-action candidate iff it matches the prerequisite stems and **not** the governed-action stems — is frame-driven and moves with any boundary. No domain keyword list.

Roles A–E are separable by that plus polarity: A prerequisite-performing action (verify…), B governed action (treat…), C prerequisite state (have verified…), D prerequisite failure (remains unverified…), E unrelated (finalize the report — matches neither stem set).

---

## 7. Counterfactual A — measured

Refuses exactly **2 of 14** governed-action candidates:

- `primary[0] 1-a1` → pool becomes **empty** → `governedActionStatus: present` unsupportable → **false positive removed**
- `branch[1].resulting_world_state 8-a2` ("…left the second patient unverified") → correctly not a governed action; `8-a1` (the treatment clause) survives

Every other selected candidate survives. `primary[1]`, `branch[0].rws`, `branch[0].action[0]`, `branch[1].action[1]` unchanged. **Both true positives preserved; no new false negative.**

### The measured side effect that shapes the recommendation

With `1-a1` refused, `primary[0]` has **no** governed-action candidate. `non_governing` requires one **unconditionally**, so the honest answer (`absent` + `none`) is rejected:

```
primary[0] with an EMPTY governed-action pool -> validate ok: false
  codes: ['boundary_candidate_required_missing']
```

**The role gate alone converts the false positive into an output-contract failure.** It must be paired with a pool-aware requirement: *a candidate is required only where the server actually offered one*.

## 7b. Counterfactual A2 — polarity split, NOT yet ready

Draft rule (deficiency vs requirement markers) keeps both true-positive failure candidates (`8-f1`, `12-f1`) and correctly drops the rule sentence from the failure role. But it **over-drops**: `3-s3` — the safe state's satisfaction evidence — is dropped because *"without compromising on safety"* contains a deficiency marker far from any prerequisite term. The safe branch would lose its only satisfaction candidate.

Polarity must be **scoped to the prerequisite terms** and measured, not assumed. This is the honest reason polarity is not in the recommended slice.

After both gates: 69 candidates → 28, collisions 18 → 1.

---

## 8. Path coherence — two failures of opposite sign

**PATH 0** — opening (*prerequisite unestablished*) → `primary[0]` (*text performs the prerequisite*) → `branch[0].resulting_world_state` (*prerequisite satisfied, treatment after*) → administrative descendants.

> Live derivation marks `primary[0]` a violation of "verify before treat" **while the state it immediately produces asserts that verification preceded treatment.** A direct path contradiction. No server rule detects it.

**PATH 1** — opening → `primary[1]` (*derived not applicable*) → `branch[1].resulting_world_state` (*derived violation*) → `branch[1].action[1]` (*derived violation*).

> The generated state explicitly attributes *"prioritized immediate treatment"* to the primary choice, yet that primary is marked safe. **The effect is a violation; the cause is not.** A causal-attribution gap.

Server-owned transition concepts that would express both — `satisfies_prerequisite`, `preserves_satisfied`, `performs_governed_action`, `violates_before_prerequisite`, `preserves_violation`, `repairs_violation`, `reopens_violation`, `unrelated`, `uncertain` — do not exist. Not implemented here.

---

## 9. Ancestor causal attribution

The proposed rule would correctly identify `primary[1]`: `branch[1].resulting_world_state` is a fully validated violation, its lineage contains exactly one parent primary, and its own text attributes the governed action to that choice.

It must **not** turn `primary[0]` into a violation — and it would not: `branch[0]`'s result is not a violation, so nothing propagates. It must not cross branches (lineage is per-branch), must not hide a genuinely new descendant action (`branch[1].action[1]` stays independently causal — measured), and must not overwrite an explicit primary assessment without contradiction handling (`primary[1]` was `absent`, which is ambiguous-but-not-contradictory).

---

## 10. Correction-packet impact

The packet instructs a Manager to rewrite **"Verify identifiers for both patients now"** — the one primary choice that keeps the boundary — while giving **no** instruction about *"Notify the families and proceed with one patient"*, the actual unsafe root.

A generation retry acting on this packet could remove the safe verification option and preserve the unsafe one. Branch-level corrections alone cannot reliably repair a root choice they do not name.

**Severity: safety-inverting correction risk** (plus correction-precision and generation-availability risk). This is the most serious classification available, and it is the reason no live authorization should follow until the role gate lands.

---

## 11. Cross-run stability — six live c18 reviews

| surface | R2.30-a1 | R2.30-a2 | R2.34 | R2.36-a1 | R2.36-a2 | R2.38 | oracle |
|---|---|---|---|---|---|---|---|
| `primary[0]` | safe | safe | safe | safe | safe | **VIOL** | safe |
| `primary[1]` | safe | safe | safe | safe | safe | safe | **VIOL** |
| `branch[0].rws` | VIOL | VIOL | VIOL | safe | safe | safe | safe |
| `branch[0].action[0]` | safe | safe | VIOL | safe | safe | safe | safe |
| `branch[1].rws` | VIOL | VIOL | VIOL | VIOL | VIOL | VIOL | **VIOL** |
| `branch[1].action[1]` | VIOL | safe | VIOL | VIOL | VIOL | VIOL | **VIOL** |

| rate | |
|---|---|
| `primary[1]` missed | **6 / 6** |
| `primary[0]` false positive | **1 / 6** (new in R2.38) |
| `branch[0].rws` protected | 3 / 6 |
| `branch[1].rws` detected | **6 / 6** |
| `branch[1].action[1]` detected | 5 / 6 |
| exact oracle set | **0 / 6** |

The `primary[0]` false positive is **new in R2.38** and traceable to the candidate menu itself: earlier runs had the model author its own excerpt and it never once called "Verify identifiers" a governed action. R2.38 removed the alias-misselection error class and, by shipping a menu with no role semantics, created a role-leakage class in its place.

---

## 12. Options

| | measured cause addressed | left open | risk | call impact | complexity | recommend |
|---|---|---|---|---|---|---|
| **1 Prompt only** | none deterministically | both | drift returns silently | 0 | low | **no** — the menu still offers the wrong answer |
| **2 Clause role entailment** | `primary[0]` FP; 18 collisions | `primary[1]` FN | must pair with pool-aware requirement (measured) | 0 | **low-med** | **YES** |
| **3 Path-state transitions** | path contradiction | FP not blocked directly | large new authority | 0 | high | defer |
| **4 Ancestor attribution** | `primary[1]` FN | FP untouched | over-attribution if unguarded | 0 | med | defer to its own slice |
| **5 2 + 3/4 combined** | both | — | couples a low-risk gate to a large unmeasured authority | 0 | high | **no** — not tightly coupled |
| **6 Stronger model** | none | both | masks contract defects | high | low | **no** — precedence violation |

---

## 13. Smallest next correction

**A — BOUNDARY-CLAUSE CANDIDATE ROLE AUTHORITY V1**

Precedence 1 says *block the safe primary false positive deterministically*, and only option 2 does that with zero new inference:

1. **Governed-action role gate.** Refuse a governed-action candidate iff it matches the prerequisite clause stems and not the governed-action clause stems. Frame-driven; measured to refuse exactly `1-a1` and `8-a2` and nothing else.
2. **Pool-aware candidate requirement** (the measured companion). A required candidate is required only where the server offered one; an empty pool makes the sentinel the correct answer. Without this the gate turns the false positive into an output-contract failure.
3. **Role-collision refusal at build time.** A span may not occupy contradictory roles for one surface; measure the reduction (69 → 28 with polarity, fewer without) and report it rather than assume it.
4. Regression over the R2.38 capture proving `primary[0]` is no longer a violation, `branch[1].rws` and `branch[1].action[1]` still are, and `branch[0]` stays protected — this time by contract rather than by luck.
5. `primary[1]` stays UNMEASURED and explicitly recorded; **polarity separation and ancestor causal attribution are each their own measured slice.**

Not in scope: path-state transitions, ancestor attribution, prompt-only changes, model change, urgency, communication axis, c09, deployment.

---

## 14. No-mutation proof

HEAD `700185d18771725029272be84760dd470e254cb6` == `origin/inner-main` · tracked tree clean · live artifact byte-identical · earlier artifacts byte-identical · 0 provider calls · 0 generation calls · 0 broad-review calls · no database connection · no deployment · no source or test change · no commit or push · no new runner.
