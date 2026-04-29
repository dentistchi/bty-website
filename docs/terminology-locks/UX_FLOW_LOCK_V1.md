# UX_FLOW_LOCK_V1

**Status:** normative for **shipped user-facing copy** in `bty-app` (Elite / Action Contract / Arena flows and shared UI).  
**Related:** `VALIDATOR_ARCHITECTURE_V1.md` (validator copy), `SCENARIO_ARCHITECTURE_V1.md` (scenario run copy), `QA_INTEGRITY_FRAMEWORK_V1.md` §5 (gate G-B09). **§6** — scenario pool activation QA (escalation / second-choice constraints).

---

## Section 1 — Global principles

1. **Non-evaluative:** Surface **structure**, **state**, and **next steps** — not judgments of the user’s character, intelligence, or worth.
2. **Non-punitive:** Reject/escalate/revise signals describe **what the system needs** or **what failed structurally**, not blame.
3. **Semantic vs structural:** **Layer 2** (semantic) outcomes must **not** use copy that implies the user should “try again” or “do better” in a **moral or evaluative** sense; **Layer 1** (structural) may invite correction of **form** in neutral terms (see §2 Step 6).
4. **Verbatim where locked:** Step 7 and contract surfaces that require **byte-for-byte** audit text remain governed by engine rules — no summarization in user-visible contract fields.

---

## Section 2 — Step-level UX (summary)

| Step | Copy constraint (summary) |
| --- | --- |
| **Step 3** | Escalation — situation update; **Continue** only; factual, observational copy; no back navigation or auto-advance. |
| **Step 4** | Forced Trade-off — escalated context + **second_choices** with visible **cost**; **≥2** choices; no softening; binary (2) canonical. |
| **Step 5** | Pattern Mirror — **Continue** only; no auto-advance; control labels per product spec. |
| **Step 6** | Structural feedback only — **all** Layer 1 defects may be listed; **no** evaluative or punitive framing (**§5**). |
| **Step 7** | Execution Gate — factual lock copy; QR / verification when eligible; **verbatim** contract text. |

*(Engine routing and persistence: code comments and `ENGINE_ARCHITECTURE_V1.md`.)*

### Step 3 — Escalation

| Field | Content |
| --- | --- |
| **Screen name** | Escalation |
| **What is displayed** | `escalation_text` from `escalationBranches[primaryChoiceId]` — a situation update showing how the context has changed as a consequence of the first choice |
| **User action(s) available** | Single **Continue** control only. No other input. |
| **What is NOT available** | Back navigation; auto-advance; any copy referencing the user's prior choice explicitly (“because you chose…”); evaluative framing; coaching language |
| **Transition behavior** | On **Continue** → `escalation_acknowledged_at` recorded → Step 4 |
| **Lock/gate condition** | None — display step only |
| **Copy tone guidance** | Factual, present-tense, observational. The situation has changed. The system describes it. The system does not interpret it, attribute it, or evaluate the user's role in it. |

### Step 4 — Forced Trade-off

| Field | Content |
| --- | --- |
| **Screen name** | Forced Trade-off |
| **What is displayed** | The escalated context (brief) + `second_choices` array, each with its **cost** field visible |
| **User action(s) available** | Select one second choice. Each choice must display its cost. |
| **What is NOT available** | Any choice without a visible cost; choices with unequal visual weight; hover states implying one option is safer; copy softening the trade-off; skip or defer option |
| **Transition behavior** | On selection → choice locked, other options dimmed → `second_choice_id` recorded → pattern signal recorded (step 4) → Step 5 |
| **Lock/gate condition** | `second_choices` must have length **≥ 2**. If branch has **< 2** second choices, safe degradation to legacy flow. |
| **Copy tone guidance** | No softening. Both options have real costs. The system presents them equally. The user must choose. No subtext implies one choice is correct. |

### Step 5 — Pattern Mirror

| Field | Content |
| --- | --- |
| **Screen name** | Pattern Mirror |
| **What is displayed** | Pattern mirror content per scenario spec |
| **User action(s) available** | Single **Continue** control only; control labels per product spec. |
| **What is NOT available** | Auto-advance; timer-driven advance without explicit **Continue**; skipping the mirror step |
| **Transition behavior** | On **Continue** → Step 6 |
| **Lock/gate condition** | None — display step only (no auto-advance before explicit **Continue**). |
| **Copy tone guidance** | Structural mirror; neutral; no evaluative framing (**§5**). |

### Step 6 — Action Contract (Consolidation)

| Field | Content |
| --- | --- |
| **Screen name** | Action Contract (Consolidation) |
| **What is displayed** | Four structural fields; Layer 1 feedback may list **all** defects at once where applicable |
| **User action(s) available** | Submit / revise per validation pipeline |
| **What is NOT available** | Evaluative or punitive framing; semantic “try again” tied to Layer 2 (**§5** F3) |
| **Transition behavior** | On passing validation pipeline → Step 7 (Execution Gate) |
| **Lock/gate condition** | Layer 1 structural rules before Layer 2; contract state machine per **PATTERN_ACTION_MODEL_V1** / **VALIDATOR_ARCHITECTURE_V1** |
| **Copy tone guidance** | Structural feedback only — **no** evaluative or punitive framing (**§5**). |

### Step 7 — Execution Gate

| Field | Content |
| --- | --- |
| **Screen name** | Execution Gate |
| **What is displayed** | Factual lock copy; QR / verification when eligible; **verbatim** contract text where engine-locked |
| **User action(s) available** | Per product verification / completion flow |
| **What is NOT available** | Paraphrase of user-visible contract fields where **verbatim** audit is required (**§1** verbatim rule) |
| **Transition behavior** | Per completion / verification contract |
| **Lock/gate condition** | Verbatim fields byte-for-byte where locked by engine |
| **Copy tone guidance** | Factual; procedural; no summarization on verbatim surfaces |

---

## Section 3 — System-locked / pending states

When a contract is **`submitted`** or **`escalated`**, user-facing copy must stay **neutral** (workflow position: e.g. “Under review”, “Additional confirmation required” per product taxonomy). **No** punitive framing; **no** “try again” for **semantic** outcomes (**VALIDATOR_ARCHITECTURE_V1.md** §3).

**Note:** The phrase **pending review** is forbidden in **system/API naming** only; procedural UI copy may use neutral review language per taxonomy **§3**.

---

## Section 5 — Forbidden patterns in shipped user-facing copy (G-B09)

**Scope:** Strings shipped to users — primarily **`src/lib/i18n.ts`**, **`src/components/**`, **`src/app/[locale]/**`**, and client-visible messages from **`src/features/**`. Exclude unit/E2E fixtures unless they are shown in production UI.

**Forbidden categories (non-exhaustive; use judgment):**

| # | Pattern | Rationale |
| --- | --- | --- |
| F1 | **Character / intelligence insults** (e.g. stupid, dumb, lazy, careless as judgment of the user) | Violates §1 non-evaluative principle |
| F2 | **Moral blame** for outcomes (“you should be ashamed”, “that was wrong of you” for semantic results) | Punitive; blurs structural vs semantic |
| F3 | **“Try again”** (or close variants) tied to **semantic / Layer 2** rejection or **escalation** outcomes | Locked per **VALIDATOR_ARCHITECTURE_V1.md** §3 — use neutral “reauthor” / structural paths only where allowed |
| F4 | **Sarcastic or mocking** tone toward the user | Inconsistent with non-punitive posture |
| F5 | **Praise/blame of wisdom or “good/bad leadership”** as **personal** judgment in system error/success paths | Validator does not evaluate quality of wisdom; UI must not pretend otherwise |

**Allowed (not §5 violations):**

- Neutral **structural** prompts (“Each field is required”, “When must be a specific time”) — Layer 1 client signals.
- **Technical** error copy (“Request failed”, “Network error”) without user character judgment.
- **Game/Arena** fiction that does **not** attack the real user (scenario role-play), if clearly in-world.

**Verification:** Run **`scripts/ux-flow-lock-gb09-sweep.mjs`** before cutover; archive output with release notes. Manual spot-check of Elite Step 6/7 and Action Contract surfaces when copy changes.

---

## Section 6 — Scenario QA constraints for pool activation

**Scope:** Scenario content and branch payloads used for **Elite** pool activation and review (e.g. `escalation_text`, `second_choices`, escalation branches). Aligned with §2 Step 3–4.

**`escalation_text` must not contain:**

- the user's prior choice label
- the word **“because”** referencing the prior choice
- coaching language
- interpretive framing (beyond factual situation update)

**Second-choice `cost`:** every `SecondChoice` must have a **non-empty** `cost` field — empty string is **invalid**.

**`second_choices` count:** minimum **2**, maximum **3**. Binary (**2**) is the canonical pattern. A third choice may exist only if it represents a **genuinely distinct** cost trade-off, not a softened version of another option.
