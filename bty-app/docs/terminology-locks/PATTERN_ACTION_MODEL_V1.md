## Section 1 — What a Pattern Is

A **pattern** is a **directional behavioral signal** extracted from a **recorded scenario choice**—not a personality label, not a character assessment, and not a stable “type” the user is said to *be*.

Patterns are **directional**:

- They move **toward action** (**system entry**) when the choice commits the user to **external, executable** next moves consistent with `PHILOSOPHY_LOCK_V1` and `SCENARIO_ARCHITECTURE_V1` (Steps 2–4 choice surfaces in particular).
- They move **away from action** (**system exit**) when the choice substitutes **reflection, explanation, deferral, deflection, or avoidance** for **measurable external change**.

**Definitions (engine terms):**

| Concept | Definition |
| --- | --- |
| **Pattern signal** | The **directional value** recorded for **one** committed choice on **one** scenario step: **binary `entry` or `exit`**. Optionally, when `exit`, exactly **one** **pattern_family** label is attached by the classifier. A single choice produces **at most one** pattern signal for pattern-engine purposes (see note below). |
| **Pattern family** | A **named category of exit behavior** the system recognizes **across multiple scenario runs** under pressure (e.g., `ownership_escape`). Families describe **what the user did to avoid acting**, not who they are. |
| **Pattern state** | The **current accumulation** of pattern signals and family tags for a user—rolling windows, counts per family, and timestamps—used to decide whether a **threshold** has been crossed and whether an **Action Contract** must be forced in the scenario flow. |

**Note (choice granularity):** Steps **2, 3, and 4** each require a committed choice and each **must** emit **one** pattern signal. Other steps may emit entry/exit flags for **mirror and audit** (e.g., Step 7 abandonment) per `SCENARIO_ARCHITECTURE_V1`, but **MVP family-based thresholding** applies to signals from **Steps 2–4** only. C3 must not double-count multiple substeps inside one logical step.

**Explicit lock:** A **pattern family is NOT a personality type.** It is a **behavioral tendency under pressure** in context. The **same user** may trigger **different** families in **different** scenarios; mixed history is expected and healthy.

**Upstream alignment:** Pattern language must stay consistent with **Difficulty** as **consequence weight** (`DIFFICULTY_LEVEL_MODEL_V1`): harder bands increase **stakes**, not puzzle trickiness; classifiers must not treat “harder scenario” as “more exit signals expected.” MVP trigger numerics are **fixed** in Section 3; **future** versions may tune counts **per difficulty band**—not in this lock.

---

## Section 2 — Pattern Family Definitions

Minimum **five** families; each covers a **distinct** avoidance type. Canonical ids are **snake_case**.

### `ownership_escape`

| Field | Required | Content |
| --- | --- | --- |
| Family name (snake_case) | Yes | `ownership_escape` |
| Plain-language description | Yes | The user **locates cause outside themselves** so they do not have to **stand in** a specific outcome as **theirs to fix or answer for**. |
| The behavior it detects (what the user does) | Yes | Chooses language or options that **attribute results** to luck, policy, others’ failures, or circumstances while **avoiding a first-person claim** on a concrete deliverable or harm. |
| The reality it avoids (what the user does not do) | Yes | **Direct accountability**: naming **their** slice of causation and **their** next move that changes the outcome. |
| Example exit choice that would generate this signal | Yes | “**The timeline slipped because dependencies weren’t clear**” (selected as the main move) **instead of** naming **what they will do today** to recover **their** commitment. |
| The re-entry direction (what action would move back into system) | Yes | **Own a named slice** of the outcome and commit to an **externally visible** corrective move **they** perform (message, decision, handoff, or repair **they** initiate). |

### `repair_avoidance`

| Field | Required | Content |
| --- | --- | --- |
| Family name (snake_case) | Yes | `repair_avoidance` |
| Plain-language description | Yes | The user **acknowledges** tension or hurt **without** taking the **repair action** that would address the other party’s reality. |
| The behavior it detects (what the user does) | Yes | Selects **empathy, apology in the abstract**, or “we should talk someday” paths while **omitting** a **specific repair behavior** toward a **named** person or group. |
| The reality it avoids (what the user does not do) | Yes | **Relational repair work**: the **uncomfortable** message, meeting, or restitution that **lands** with the affected party. |
| Example exit choice that would generate this signal | Yes | “**I’ll be more mindful going forward**” **without** scheduling or sending the **hard conversation** the scenario pressures. |
| The re-entry direction (what action would move back into system) | Yes | A **concrete repair act** directed at a **named** person (or named group representative) with **observable** follow-through. |

### `explanation_substitution`

| Field | Required | Content |
| --- | --- | --- |
| Family name (snake_case) | Yes | `explanation_substitution` |
| Plain-language description | Yes | The user **trades action for narrative**—long-form **justification** or “clarity” that **feels** like progress but **does not** change the world. |
| The behavior it detects (what the user does) | Yes | Chooses options that **extend explanation**, analysis, or self-story **as the output** of the step instead of a **commitment that produces external change**. |
| The reality it avoids (what the user does not do) | Yes | **Executing** a **bounded** act that **closes the loop** in reality (decision communicated, object shipped, boundary set). |
| Example exit choice that would generate this signal | Yes | “**Let me outline why this happened**” / “**I need to process this first**” as the **terminal** move for the step. |
| The re-entry direction (what action would move back into system) | Yes | Replace explanation with a **single** **externally measurable** act **with a deadline**—even if small—**without** using the explanation as the substitute for that act. |

### `delegation_deflection`

| Field | Required | Content |
| --- | --- | --- |
| Family name (snake_case) | Yes | `delegation_deflection` |
| Plain-language description | Yes | The user **reassigns ownership** of the hard part so **they** do not have to **engage directly** with the pressured move. |
| The behavior it detects (what the user does) | Yes | Selects “**someone else should handle**,” “**HR/legal/them**,” or “**we need a process**” paths that **remove their body** from the **front-line** act. |
| The reality it avoids (what the user does not do) | Yes | **Direct engagement**: **they** are the **actor** on the **specific** behavior the scenario demands (not only a coordinator). |
| Example exit choice that would generate this signal | Yes | “**I’ll ask my manager to escalate**” when the scenario requires **them** to **speak** to the peer **directly**. |
| The re-entry direction (what action would move back into system) | Yes | **They** perform the **first** **high-friction** interaction **personally** (or explicitly **co-present** with the delegatee in a way that **verification** can capture—product-defined), **without** disappearing behind a handoff. |

### `future_deferral`

| Field | Required | Content |
| --- | --- | --- |
| Family name (snake_case) | Yes | `future_deferral` |
| Plain-language description | Yes | The user **buys calm now** by **promising later** without a **binding** **when** that the system can treat as **concrete**. |
| The behavior it detects (what the user does) | Yes | Chooses “**later**,” “**when things calm down**,” “**I’ll circle back**,” or **unbounded** future intent **instead of** a **dated** or **time-bounded** act in the **present planning horizon**. |
| The reality it avoids (what the user does not do) | Yes | **Committing** to an act **anchored in clock/calendar** that **obligates** them **now** (per Philosophy Lock: intention is not execution, but here the **avoidance** is **unbounded** deferral). |
| Example exit choice that would generate this signal | Yes | “**I’ll deal with this when I have bandwidth**” **without** a **specific** time or **end-of-week** window. |
| The re-entry direction (what action would move back into system) | Yes | A **time-bound** move **they** will do **by** a **specific** datetime or **clear** window (per Action Contract **when** rules in Section 4–5). |

---

## Section 3 — Threshold and Trigger Rules

These rules are **fixed** for the current system. **MVP numerics (7-run window, 3-of-7 same-family)** may be **revisited in a future version** only by explicit spec revision; C3 **must** implement **exactly** what follows for MVP.

### Detection window

- The engine examines the user’s **last 7 scenario runs**, ordered by **`run_started_at`** (most recent first).
- A **scenario run** counts as **in-window** if it **entered Step 2** at minimum (so at least one choice-bearing step could have produced a signal). Runs that **never reached Step 2** are **excluded** from the window **slot count** (they do not consume one of the seven slots).
- **Difficulty band calibration (MVP):** The **7** and **3** are **global** across bands. **Carry-forward:** Scenario **library tags** differentiate **M/M** bands per `DIFFICULTY_LEVEL_MODEL_V1`; C3 **must** persist **band tag** on each run for **mirror and future per-band thresholds**—but **must not** change the **3-of-7** math in MVP without a new lock revision.

### Trigger condition (when an Action Contract is **required**)

- Let **F** be a pattern family.
- **Fire** when **≥ 3** distinct in-window runs each contribute **at least one** `exit` signal **tagged `F`** from **Steps 2, 3, or 4**.
- **Counting rule:** Multiple exit signals **for the same F** in **one** run count as **one** toward the **3** (per-run cap **1** per family for threshold counting).

### Multi-family behavior (tie-break)

- If **two or more** families **F1, F2, …** simultaneously satisfy the trigger on the same evaluation tick:
  - **Select exactly one** family: the one whose **most recent qualifying signal** (exit + family tag) has the **latest timestamp** (**highest recency**).
  - Generate **one** Action Contract for **that** family only on this tick.

### Post-trigger behavior (counter reset)

- After an Action Contract is **generated** for family **F**:
  - **Reset to 0** the **threshold counter** for **F** within the **current** rolling window—i.e., the **three** qualifying runs that caused the fire are **cleared** from **F**’s count.
  - The **7-run window** itself **does not** reset; it **continues rolling** as new runs complete.
  - New `exit` signals for **F** **accumulate fresh** toward the next possible fire.

### Re-trigger prevention

- A **new** Action Contract for the **same** family **F** **must not** be generated while an existing contract with `pattern_family == F` exists in **any** state **other than** terminal **`complete_verified`** (aligned with `SCENARIO_ARCHITECTURE_V1` completion: **execution + verification**).
- Equivalently: **no second fire for F** until the prior F-tied contract’s scenario path reaches **`complete_verified`** for that contract’s run (C3: link contract ↔ run IDs).

### Evaluation timing

- Re-evaluate triggers **after every scenario run** that **produces or updates** pattern signals (minimum: after Steps **2–4** each, and **on run terminal events** such as Step 7 abandonment for **state**, though family threshold counts remain per rules above).

---

## Section 4 — Action Contract Structure

This is the **exact** payload Step **6** must produce and Step **7** must verify. It is **behavioral spec**, not code.

| Field | Type / form | Required | Semantics |
| --- | --- | --- | --- |
| `pattern_family` | snake_case enum (registered families + future registry) | Yes | Which family **triggered** this contract (from Section 3). |
| `pattern_state_snapshot` | structured record (JSON-shaped in implementation) | Yes | **Immutable audit** of the signals that satisfied the trigger: run IDs, step indices, signal directions, family tags, timestamps—sufficient to reproduce **why** the engine fired. |
| `who` | string | Yes | **User-authored:** specific **person** or **identifiable group** the action is directed at. |
| `what` | string | Yes | **User-authored:** specific **behavior** the user commits to **execute** (must contain an **action verb** per Section 5). |
| `how` | string | Yes | **User-authored:** intended **method** and/or **observable outcome** (not a feeling). |
| `when` | string | Yes | **User-authored:** **concrete** time or deadline (date, time, or **bounded** window). **Invalid:** “soon,” “later,” “eventually,” “when I can.” |
| `raw_text` | string | Yes | **Complete unedited** user input as entered in the Step 6 surface **before** or **alongside** structured parsing (lossless for audit). |
| `authored_at` | timestamp | Yes | Contract creation time (Step 6 submit). |
| `status` | enum | Yes | `pending` → `submitted` → `approved` **or** `rejected` **or** `escalated` (per Section 5). |
| `verified_at` | timestamp \| null | Yes | **Non-null** only when execution is **verified** and status is **`approved`**; otherwise **null**. |

**Lock:** The system **may** validate **format** (e.g., is **`when`** concrete? is **`who`** named?) and **may** **reject or revise** per Section 5. It **must never** **replace** user-authored **`who` / `what` / `how` / `when`** with **system-generated** substitute text. Suggestions **outside** the stored contract fields are allowed only if they **do not** overwrite `raw_text` or the four authored fields.

**Status semantics (contract lifecycle, not scenario run state):**

- `pending` — created internally when trigger fires, before user fills Step 6.
- `submitted` — user submitted Step 6; awaiting validation / verification pipeline.
- `approved` — passed validation **and** Step 7 **execution verified** (`verified_at` set).
- `rejected` — failed semantic validation (Section 5); **not** punishment—**non-conforming as Action**.
- `escalated` — ambiguous semantic evaluation; **human** or **secondary model** review required before approve/reject.

---

## Section 5 — Action Contract Validation Rules

Two layers. Outcomes are **exactly** four: **`approve`**, **`revise`**, **`reject`**, **`escalate`**.

### Layer 1 — Rule-based (structural)

| Rule | Requirement |
| --- | --- |
| **who** | Must name a **specific** person **or** **identifiable group** (role + scope is acceptable if **verifiable**, e.g., “**Alex Kim (PM on Project Orion)**”). **Invalid alone:** bare “my team,” “everyone,” “they” **without** identification sufficient for verification. |
| **what** | Must contain a **main action verb** with **bounded** object (what is being done). |
| **when** | Must be a **specific** datetime, **date**, **clock time**, or **bounded window** (“**by Friday 18:00**,” “**between 9–10am tomorrow**”). **Invalid:** “eventually,” “soon,” “later,” “when possible,” “ASAP” **without** anchor. |
| **how** | Must reference **method** and/or **observable outcome** in the world. **Invalid:** **pure** affect (“feel better,” “be at peace”) **without** external mechanism. |

**Layer 1 outcome:** If **any** rule fails → outcome **`revise`** (user **must** edit and resubmit). **Do not** run Layer 2 until Layer 1 passes.

### Layer 2 — Semantic (AI-evaluated)

All **must** be **true** for **`approve`** (after Layer 1 passes):

1. **System entry:** The action **moves the user into** the system—toward the **reality the pattern avoided** (Section 6), not away from it.
2. **External measurability:** The action **produces measurable change in external reality** per `PHILOSOPHY_LOCK_V1` (not **solely** internal processing).
3. **Real discomfort:** The action entails **credible** **relational, reputational, or logistical** cost appropriate to the scenario band—not a **purely symbolic** or **cosmetic** gesture.

**Mapping to outcomes:**

| Outcome | Condition |
| --- | --- |
| **`approve`** | Layer 1 **pass** **and** Layer 2 **pass** (clear yes on all three checks). |
| **`revise`** | Layer 1 **fail** (structural fix required). |
| **`reject`** | Layer 1 **pass** **and** Layer 2 **fail** (action is **avoidant**, **cosmetic**, or **purely internal**). |
| **`escalate`** | Layer 1 **pass** **and** Layer 2 **ambiguous** (model confidence below policy threshold **or** conflict between checks). |

**Explicit lock:** **`reject` is not a punishment.** It is a **system signal** that the submitted text **does not meet the definition of Action** in the Philosophy Lock. Copy and UI must **not** frame it as moral failure.

---

## Section 6 — Pattern → Action Mapping Principles

### Governing principle

Mapping is **not** a lookup table of prescribed actions. The user **authors** their own **`what`**. The engine **evaluates** whether the authored action moves in the correct **re-entry direction**:

**The action must engage the reality the pattern avoided**—not its **opposite** in the abstract, not a **compensatory** self-image gesture, and not **reflection on the pattern** as a substitute for **contacting** the avoided reality.

**Valid:** **Concrete**, **externally verifiable** engagement with the **same** reality domain the exit choice sidestepped (person, outcome slice, time obligation, repair object).

**Invalid (semantic reject):** “**Be better**,” “**journal about**,” “**plan to**,” “**understand** why I avoid X” **without** an **external** act that **collides** with the avoided reality.

### Mapping examples (one per family)

**Pattern family:** `ownership_escape`  
**Avoided reality:** direct accountability for a **specific** outcome slice  
**Valid action direction:** user **names their contribution** and performs a **visible** corrective **they** own (e.g., sends the **corrected** deliverable **they** committed to).  
**Invalid action direction (reject):** user writes a plan to “**be more accountable in the future**” **without** **owning** a **named** deliverable **now**.

**Pattern family:** `repair_avoidance`  
**Avoided reality:** **repair** toward a **named** harmed or strained party  
**Valid action direction:** user **initiates** the **specific** conversation or restitution **with that party** (time-boxed).  
**Invalid action direction (reject):** user commits to “**feel remorse**” or “**reflect on the relationship**” **without** **contacting** the person.

**Pattern family:** `explanation_substitution`  
**Avoided reality:** **closing the loop** in the world **instead of** explaining why the loop is open  
**Valid action direction:** user performs **one** **bounded** **external** closure act (send decision, ship artifact, set boundary in writing).  
**Invalid action direction (reject):** user submits an **essay** explaining the situation **as** the “action.”

**Pattern family:** `delegation_deflection`  
**Avoided reality:** **direct** engagement **by the user** with the pressured party or object  
**Valid action direction:** user is the **sender** of the hard message or the **decider** who **personally** communicates the decision.  
**Invalid action direction (reject):** user **only** “**asks** someone else to handle it” with **no** **personal** execution step they verify.

**Pattern family:** `future_deferral`  
**Avoided reality:** **present** obligation with **clock** anchor  
**Valid action direction:** user anchors the same behavioral class to a **specific** **by-when** and executes **verification** against that window.  
**Invalid action direction (reject):** user re-commits to “**when I have time**” or “**next quarter**” **without** **calendar** binding.

---

## Section 7 — Terminology Lock Addendum

*Extends `PHILOSOPHY_LOCK_V1.md` Section 6; does **not** replace it.*

| Term | Locked Definition | Forbidden Substitutions |
| --- | --- | --- |
| Pattern signal | Directional behavioral value per choice (**`entry` / `exit`**) | Score, rating, data point |
| Pattern family | Named category of **exit** behavior under pressure | Personality type, trait, style |
| Pattern state | Accumulated signal record for a user | Profile, score, assessment |
| Action Contract | User-authored commitment **triggered by pattern threshold** (plus audit fields) | Goal, plan, task, challenge |
| Threshold | Minimum **same-family** signal count within **detection window** to trigger contract | Score, limit, cap |
| Re-entry direction | Behavioral move that returns user **into** the **avoided reality** | Solution, fix, improvement |
