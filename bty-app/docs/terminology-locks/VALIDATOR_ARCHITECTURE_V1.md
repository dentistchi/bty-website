# VALIDATOR_ARCHITECTURE_V1

Contract validation pipeline for **Action Contracts** (`action_contracts`). Subordinate to **`PATTERN_ACTION_MODEL_V1.md`**, **`UX_FLOW_LOCK_V1.md`**, and **`PHILOSOPHY_LOCK_V1.md`**.

---

## Section 1 — Validator Scope and Boundaries

**The validator does:**

- It evaluates whether an **action contract** meets the **definition of action** (measurable external change, directed at the **avoided reality** for the contract’s pattern family), per **`PHILOSOPHY_LOCK_V1.md`** and **`PATTERN_ACTION_MODEL_V1.md`**.
- It operates on the **`action_contracts`** record **after** `status` transitions to **`submitted`**.
- It produces **exactly one** outcome per evaluation: **`approve`** / **`revise`** / **`reject`** / **`escalate`**.

**The validator does not:**

- It does **not** evaluate the **quality**, **wisdom**, or **likely effectiveness** of the action.
- It does **not** rewrite or suggest alternative actions.
- It does **not** store evaluation rationale in **user-visible** fields (rationale is server-side only).

**Outcome semantics (locked mapping):**

| Outcome | Trigger (summary) |
| --- | --- |
| **`revise`** | Triggered by **Layer 1 failure only** — the contract is returned to the user for **structural** correction. |
| **`reject`** | Triggered by **Layer 2 failure only** — the contract passes structure but **fails** the action definition (not a punishment). |
| **`escalate`** | Triggered when **Layer 2 confidence** is **below threshold** — **not** a failure state; automated decision is deferred. |
| **`approve`** | Layer 1 pass and Layer 2 pass with sufficient confidence on **all** semantic criteria. |

---

## Section 2 — Layer 1: Rule-Based Validation

Layer 1 evaluates **only** the structured fields (and supporting presence checks) for **structural** conformance. Failures **never** invoke Layer 2.

### Rule set (mandatory)

| Rule | Field evaluated | Pass condition | Fail condition | Fail outcome | Client signal (structural only) |
| --- | --- | --- | --- | --- | --- |
| **R1** | `who` | Names a **specific identifiable person** or **identifiable group** (role + scope acceptable if verifiable per pattern lock) | Missing specificity (e.g., bare “they,” “everyone,” “my team” without identifiable scope) | **`revise`** | Who must name a specific person or group |
| **R2** | `what` | Contains a **main action verb** with a bounded object | No clear action verb / no bounded act | **`revise`** | What must describe a specific action |
| **R3** | `when` | Contains a **concrete time expression** (specific datetime, date, clock time, or bounded window per pattern lock) | Not anchored to clock/calendar/window as required | **`revise`** | When must be a specific time or date |
| **R4** | `how` | References an **outcome** or **method** in the world | Pure affect, intention, or internal state **without** external mechanism/outcome | **`revise`** | How must describe an outcome or method |
| **R5** | `when` | Uses only **concrete** time language | Contains vague deferral terms: **soon,** **eventually,** **later,** **when I get a chance,** **in the near future,** **someday** (case-insensitive token match per implementation policy) | **`revise`** | When must be a specific time or date |

### Additional mandatory rule (derived from locked contract shape)

| Rule | Field evaluated | Pass condition | Fail condition | Fail outcome | Client signal (structural only) |
| --- | --- | --- | --- | --- | --- |
| **R6** | `who`, `what`, `how`, `when`, `raw_text` | All required fields **non-empty** after trim; `raw_text` present for audit | Any required field empty or whitespace-only | **`revise`** | Each field is required |

### Evaluation mode

**All Layer 1 rules are evaluated in one pass; every failure is collected and returned together** (not fail-fast on the first rule).

**Rationale:** Step 6 UX permits **summary** structural feedback (`UX_FLOW_LOCK_V1.md` §2 Step 6), and surfacing **all** field defects at once reduces unnecessary resubmit cycles while staying strictly non-evaluative.

---

## Section 3 — Layer 2: Semantic Validation

Layer 2 runs **only** if Layer 1 produces **zero** failures. It does **not** run in parallel with Layer 1.

### 3.1 — Evaluation criteria

The three semantic tests from **`PATTERN_ACTION_MODEL_V1.md` §5**, stated as **evaluable questions**:

1. **Re-entry direction test:** Does the action **move toward the reality the pattern family avoided** (and the family’s **re-entry direction**), not away from it, compensate abstractly, or substitute reflection for contact with that reality?
2. **Action definition test:** Does the action **produce measurable change in external reality** (per **`PHILOSOPHY_LOCK_V1.md`**), rather than solely internal processing, narrative, or planning?
3. **Non-cosmetic test:** Does the action contain **real cost or discomfort** — relational, reputational, or logistical — appropriate to the scenario band, and **not** a purely symbolic or cosmetic gesture?

**Routing from criterion outcomes:**

- **All three** resolve to **pass** with confidence **≥ threshold** → contribute to **`approve`** (with global gating per §3.4).
- **Any one** resolves to **fail** with confidence **≥ threshold** → **`reject`**.
- **Any one** resolves as **ambiguous** **or** confidence **< threshold** → **`escalate`** (see §3.4).

### 3.2 — Pattern family context injection

The validator **must** read **`pattern_family`** and **`pattern_state_snapshot`** from the contract record.

- **`pattern_state_snapshot`:** Used **server-side** for **audit**, **traceability**, and **human escalation** review. It is **not** passed to the semantic model if it contains run identifiers or other fields that could support **re-identification**; only **non-identifying** subsets may be included in model context if product policy explicitly allows.
- **Family-specific avoided reality:** Resolved via **server-side lookup** from the canonical pattern family registry aligned to **`PATTERN_ACTION_MODEL_V1.md` §2** (for each family: **“The reality it avoids”** and **“The re-entry direction”**). The model receives a **structured context object** (JSON-serializable) embedded in the prompt, e.g. `{ "pattern_family": "<id>", "avoided_reality": "<canonical text>", "re_entry_direction": "<canonical text>" }`, plus the **authored contract text** (§3.3).

**Re-entry direction test (criterion 1)** is scored **only** against that family’s **avoided reality** and **re-entry direction** as locked in **`PATTERN_ACTION_MODEL_V1.md` §6**.

### 3.3 — AI model invocation

**Model**

- **Primary:** A **single fixed production model** designated in deployment config (e.g., a current **frontier-class** general model with strong instruction-following and JSON adherence), with a **documented fallback** of the same **tier class** if the primary is unavailable.
- **Selection criteria (if variable):** Only **compliance-style** models that support **structured JSON output** and **low-temperature** operation; no per-user model routing.

**Prompt structure (order and framing)**

1. **System / policy preamble:** Role = contract semantic validator; definitions of **Action**, **external measurability**, **non-cosmetic cost**, and **non-goals** (no rewriting, no suggestions, no moral judgment).
2. **Structured pattern context:** The object from §3.2 (`pattern_family`, `avoided_reality`, `re_entry_direction`).
3. **Contract payload — structured fields** in fixed order: `who`, `what`, `how`, `when`.
4. **Contract payload — `raw_text`:** Full verbatim Step 6 capture.
5. **Framing instruction:** Answer the **three evaluable questions** (§3.1); for each, output **one** of `pass` | `fail` | `ambiguous` and a **numeric confidence** in **[0, 1]**; base judgment **only** on supplied text and pattern context; do not infer user identity or off-contract facts.

**Content passed:** **Both** structured fields **and** `raw_text` — to detect inconsistencies and to honor the lossless audit field while keeping the model grounded in the same surface the user submitted.

**Output format (strict)**

Structured JSON, e.g.:

```json
{
  "re_entry_direction": { "outcome": "pass|fail|ambiguous", "confidence": 0.0 },
  "external_measurability": { "outcome": "pass|fail|ambiguous", "confidence": 0.0 },
  "non_cosmetic": { "outcome": "pass|fail|ambiguous", "confidence": 0.0 }
}
```

No free-text rationale fields are required in the model response; any optional internal logging strings stay **server-side** and **never** surface to the client.

**Temperature / determinism**

- **Temperature:** **0.2** (low) for consistency across evaluations.
- **Recommendation:** Enable **deterministic decoding** where the stack supports it (e.g., seed + low top‑p); if not supported, keep temperature at **0.2** and log model version for audit.

### 3.4 — Confidence threshold and escalation

**Threshold:** For **each** criterion, if `confidence < 0.7`, treat that criterion as **insufficiently certain** for automated **approve** or **reject** → **`escalate`** (even if the point estimate outcome is pass or fail).

If Layer 2 returns mixed signals across criteria — any criterion at confidence < 0.7 regardless of outcomes on other criteria — the entire evaluation routes to escalate. Partial-ambiguous combined with partial-fail = escalate, not reject. The ambiguous criterion takes precedence.

**Rationale:** **0.7** balances false rejects against operational load; tuning requires a new lock revision and empirical calibration.

**Aggregate routing (after parsing three criteria):**

- If **any** criterion is **ambiguous** **or** `confidence < 0.7` → **`escalate`**.
- Else if **any** criterion is **fail** → **`reject`**.
- Else (**all pass**) → **`approve`**.

### 3.5 — Escalation handling

**Who performs secondary review**

- **Primary:** **Human reviewer queue** (authoritative disposition).
- **Optional:** A **secondary AI** may **triage** or **pre-label** queue items but **cannot** alone move a contract to **`approved`** without human sign-off unless product policy adds a **separate** lock (default: **human required** for escalation resolution).

**What the user sees (`escalated`)**

- Align with **`UX_FLOW_LOCK_V1.md` §3** — **System locked — pending re-trigger (contract in submitted / escalated state):** neutral workflow position (e.g., **“Under review”** / **“Additional confirmation required”** per product taxonomy); **no** evaluative or punitive framing; **no** “try again” for semantic outcomes.

**Maximum time before escalation must be resolved**

- **72 hours** from **`escalated_at`** (calendar time), unless superseded by a future operational SLA lock.

**If escalation expires unresolved**

- **Not** force-approved.
- Contract **`status`** transitions **`escalated` → `pending`** (or product-equivalent **pre–Step 7** state that returns the user to **Action Contract** edit/resubmit per policy), with **neutral** copy describing that the review window ended and **updated submission** is required — framed as **structural / workflow** revision, not personal fault.

**After escalation resolves**

- **Secondary approve:** `escalated` → **`approved`** (validator terminal for validation; Step 7 gate / QR generation proceeds per architecture).
- **Secondary reject:** `escalated` → **`rejected`** (user returned to Step 6 for **reauthoring** per §4; copy per **`UX_FLOW_LOCK_V1.md` §2 Step 6 / §5**).

---

## Section 4 — Outcome Routing

Complete routing table for validation outcomes. (Scenario run / verification gates outside this document remain governed by **`SCENARIO_ARCHITECTURE_V1.md`** and **`UX_FLOW_LOCK_V1.md`**.)

| Outcome | Trigger condition | Status transition | User-facing signal | Next system action |
| --- | --- | --- | --- | --- |
| **`revise`** | Layer 1 fails | `submitted` → `pending` | Structural field error(s) (§2 client signals) | Contract returned to **Step 6** input; user edits and resubmits |
| **`approve`** | Layer 1 pass **and** Layer 2 pass (all criteria **pass**, all confidences **≥ 0.7**) | `submitted` → `approved` | None (gate opens; no praise) | **Step 7** QR / handoff generated; execution verification flow begins |
| **`reject`** | Layer 1 pass **and** Layer 2 **fail** (any criterion **fail**, all confidences **≥ 0.7**) | `submitted` → `rejected` | Non-punitive **reject** signal — **structurally neutral**, aligned with **`UX_FLOW_LOCK_V1.md` §2 Step 6** (form / definition language only; forbidden evaluative patterns per §1 / §5) | Contract returned to **Step 6** for **reauthoring** |
| **`escalate`** | Layer 1 pass **and** Layer 2 **ambiguous** or **any** criterion **confidence < 0.7** | `submitted` → `escalated` | Neutral wait state (§3.5) | **Escalation queue** entry created; human (± secondary AI) review |

**Escalation resolution (additions)**

| Resolution | Trigger | Status transition | User-facing signal | Next system action |
| --- | --- | --- | --- | --- |
| **Secondary approve** | Human reviewer (policy) approves after escalation | `escalated` → `approved` | Neutral confirmation of clearance (no correctness praise) | Step 7 as for direct **`approve`** |
| **Secondary reject** | Human reviewer rejects after escalation | `escalated` → `rejected` | Same constraints as direct **`reject`** | Step 6 reauthoring as for direct **`reject`** |

---

## Section 5 — Validator Constraints (Non-Negotiable)

1. The validator **never** rewrites user-authored content.
2. The validator **never** suggests alternative actions.
3. **Evaluation rationale** is stored **server-side only** — **never** returned to the client in **user-readable** form.
4. **`reject`** copy surfaced to the user must be **structurally neutral** — derived from **`UX_FLOW_LOCK_V1.md` §2 Step 6** constraints (and global UX principles / forbidden patterns in §1 and §5 of that lock).
5. The validator does **not** evaluate **intent** — only the **authored contract text** and its alignment with the **action definition** and **pattern family context**.
6. A contract that reaches **`approved`** state **cannot** be re-evaluated by this validator — **`approved`** is **terminal** for **validation** purposes (downstream verification lifecycle is separate).
7. **Layer 1** must **complete** before **Layer 2** is invoked — **no** parallel execution of layers.
8. The **semantic evaluator** must **not** be invoked with **user identity** data — evaluation input is **contract text** plus **pattern family context** (§3.2), constructed to exclude re-identifying fields from the model payload.

---

## Section 6 — Terminology Lock Addendum

*Extends **`PHILOSOPHY_LOCK_V1.md` §6**; does **not** replace existing rows.*

| Term | Locked Definition | Forbidden Substitutions |
| --- | --- | --- |
| **Revise** | System signal that the contract **fails structural requirements**; returned to the user for **correction** | Retry, try again, error, invalid |
| **Reject** | System signal that the contract **fails the action definition**; **not** a punishment | Fail, wrong, denied, blocked |
| **Escalate** | System signal that **semantic confidence** is **insufficient** for an automated decision | Flag, review, hold, pending review. **Annotation:** "pending review" — forbidden in system/API naming only; user-facing procedural copy is governed by **`UX_FLOW_LOCK_V1.md` §3**. |
| **Approve** | System confirmation that the contract **meets the action definition** and **re-entry direction** | Pass, correct, validated, accepted |

---

*End of VALIDATOR_ARCHITECTURE_V1*
