# Arena System Specification

**Status:** Canonical (single source of truth for engineering)  
**Audience:** All engineers (C2 / C3 / C4)  
**Scope:** Training-game platform “Arena” and its relationship to Foundry, Center, and the action loop.

---

## 1. System Overview

Arena is the **practice field** of the platform: a **training game**, not a knowledge quiz. Sessions present realistic tensions and choices. The system measures **how the user orients**, not whether they pick a single keyed “correct” option.

The purpose of Arena is **behavior change** over time. Scores, labels, and progression exist to support **reflection and repetition**, not to rank users on right/wrong trivia. Success means the user **acts differently in real contexts**, not that they maximize points on a screen.

Arena operates inside a larger loop: **scenario practice → reflection → committed action → real-world attempt**, with optional paths through **Foundry** (rehearsal and programs) and **Center** (recovery and reset). This document defines **what must always be true** so that implementation cannot drift into a quiz product or a pure game leaderboard.

---

## 2. Core Axes (CRITICAL)

The platform separates four axes. Confusing them is a **specification error**.

### 2.1 Level (Content Gate)

- **Definition:** The **content access band** tied **only** to **tenure** (time-in-role / program phase as defined by product) and **job function** (or equivalent organizational role class).
- **Effect:** Determines **which scenarios and scenario families** may appear in selection.
- **MUST NOT** be raised, lowered, or bypassed by **XP**, **weekly performance**, **leaderboard rank**, or **session score**.

### 2.2 State (User Readiness)

- **Definition:** A **readiness / load** classification for the current period: **steady**, **tight**, or **stuck**.
- **Derivation:** From **behavior signals** (e.g. choice patterns, escalation markers, recovery flags—exact signals are specified in domain rules, not here).
- **Effect:** Adjusts **difficulty and variant** **within** the same Level. State **does not** change which Level band is accessible.

### 2.3 Core XP / Tier / Code Name

- **Definition:** **Long-term progression** and **identity** (tier bands, code name, cosmetic or identity-facing unlocks as defined by product).
- **Effect:** Motivation, identity continuity, and **non-content** unlocks where explicitly allowed.
- **MUST NOT** act as the **primary key** that **unlocks scenario content** or **Level**. Content gates remain **Level + job function** (see 2.1).

### 2.4 Action Loop

- **Definition:** The closed path: **Scenario (Arena)** → **Reflection** → **Action** (commitment) → **Real-world attempt** (reported or inferred).
- **Includes:** **Foundry** (structured rehearsal and programs), **Center** (recovery and reset), and **QR** (or equivalent) for **real-world action logging** where product defines it.
- **MUST:** Each phase has a clear **contract**; Arena **does not** replace Foundry or Center; it **connects** to them.

---

## 3. Invariants (MUST / MUST NOT)

### MUST

- **Level gates content** — no scenario outside the allowed set for the user’s Level and job function.
- **State adjusts difficulty** — selection and variant within Level follow State rules (section 4, 8).
- **Actions connect to real-world behavior** — committed actions are **small, executable**, and traceable to scenarios (section 7).
- **Domain truth lives in domain/engine** — business rules are **not** reimplemented in UI for XP, Level, State, or selection.

### MUST NOT

- **XP unlock scenarios** — Core XP **must not** be used to open scenario content that Level forbids.
- **UI override domain logic** — presentation **must not** compute or override selection, Level, State, or scoring rules.
- **Foundry replace real action** — Foundry **rehearses**; it **must not** be defined as sufficient “real” behavior change without the action loop completing outside rehearsal where the product requires it.
- **State or XP replace Level** — neither State nor XP may widen Level-accessible content.

---

## 4. Scenario Selection Logic

Selection **must** apply rules in this order unless a higher product contract explicitly overrides (e.g. experience-first Arena contract for delivery ordering):

1. **Filter by Level** — discard any scenario not in the allowed set for tenure + job function.
2. **Adjust by State** — narrow to variants and difficulty appropriate to **steady / tight / stuck** (section 4.1).
3. **Avoid repetition** — do not present the **same learning tension** back-to-back in a way that violates the product’s repetition contract (see Arena experience contract where applicable).
4. **Prefer relevant tension** — within the pool, prefer scenarios that match **current pattern memory** or recovery needs without exposing raw history to the user.

### 4.1 Difficulty behavior by State (within Level)

| State   | Difficulty behavior |
|---------|---------------------|
| **steady** | Slightly **harder** variants **allowed** within the Level band. |
| **tight** | **Same** difficulty band as baseline for the Level; no upward nudge. |
| **stuck** | **Easier variant** within the same Level (simpler tension, clearer stakes, or reduced ambiguity as defined by content rules). |

**Invariant:** **Level band does not change**; only **intensity / variant within the band** changes.

---

## 5. State System

### 5.1 Values

- **steady** — User can absorb stretch; practice can increase load slightly within Level.
- **tight** — User is loaded; practice holds difficulty steady.
- **stuck** — User is overloaded or looping; practice reduces intensity within Level and may trigger Center pathways.

### 5.2 Signals

- State is derived from **behavior signals** defined in domain rules (e.g. repeated escalation types, recovery triggers, abstention patterns).  
- **MUST NOT** be derived from **vanity metrics** unrelated to behavior (e.g. raw click counts without semantic mapping).

### 5.3 Presentation

- State is **not** a moral judgment and **must not** be framed as “you are bad/good.”
- Any user-facing label **must** be **once per decision context** (or as product specifies), **after** the user has committed a choice in that step—not as a permanent banner of worth.

---

## 6. Intervention System

### 6.1 Foundry

- **Purpose:** **Behavior rehearsal** — programs, drills, and structured practice.
- **Optional:** Entry is gated by product rules; it **must not** be mandatory for every user every cycle unless product explicitly requires it.
- **When used:** User is **capable but hesitant** (e.g. knows the move but avoids applying it). Foundry **reduces hesitation**, not pathology.

### 6.2 Center

- **Purpose:** **Reset and recovery** — emotional load, integrity slips, or system-level blockers.
- **When used:** User is **stuck**, **negative spiral**, or **blocked** from safe practice until recovery criteria are met.
- **MUST NOT** be used as generic “help”—it is a **defined recovery channel**.

---

## 7. Action System

- **Active actions:** At most **three** concurrent **active** commitments (product may define “active” precisely; the cap is **three**).
- **Origin:** Actions **come from** scenario and reflection outputs (user-chosen or system-suggested within rules)—not arbitrary free text buckets unless product extends the contract.
- **Shape:** Each action **must** be **small** and **executable** within a short horizon (e.g. one conversation, one meeting move, one boundary)—exact bounds are content-tiered, not UI copy here.

---

## 8. Adaptive Difficulty

Rules **within** a fixed Level:

| Event | Effect on intensity |
|-------|---------------------|
| **Success** (behavior success as defined by domain) | **Increase slightly** allowed on next practice in **steady**; in **tight**, hold; in **stuck**, do not increase. |
| **Foundry engagement** (completion as defined) | **Maintain** difficulty band (no automatic upward drift solely because Foundry was opened). |
| **Center engagement** (recovery completion as defined) | **Decrease** difficulty variant within Level until State improves. |

**MUST:** **Level** does **not** change from adaptive difficulty. **Only** intensity within Level changes.

---

## 9. Behavior Pattern Memory

- **Stores:** **Patterns**, not raw transcripts of user text (unless a separate compliance store exists; the **selection and adaptation** layer uses **patterns**).
- **Cardinality:** **Five to seven** **core** patterns per user (or per product partition) at steady state; merging and decay rules are domain-defined.
- **Use:** Patterns **subtly** bias **which tensions** and **which variants** appear next—**without** exposing internal pattern IDs to the user as surveillance.

---

## 10. Experience Philosophy

- There is **no single “correct answer”** that wins the scenario; there are **consequences** and **learning**, not a keyed exam key.
- **No heavy-handed coaching** — guidance is **minimal** and **contextual**.
- **Natural guidance only** — the user should feel the situation could be **their** workplace or clinic, not a cartoon morality play.
- **Target feeling:** *“This feels like my real situation.”*

---

## FINAL RULE

This document is a **product constitution** for Arena and its axes. Implementations **must** satisfy every **MUST** and **MUST NOT** above. Where this document conflicts with incidental code or UI behavior, **this document wins** until formally amended.

**Excluded from this spec:** UI strings, visual design, framework choice, and database schema. Those are governed by separate technical documents.
