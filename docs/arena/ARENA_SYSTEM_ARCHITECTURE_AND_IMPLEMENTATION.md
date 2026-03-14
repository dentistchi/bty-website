# BTY Arena Leadership Simulation — System Architecture & Implementation Guide

**Version:** 1.0  
**Purpose:** Single source of truth for implementing the Arena behavioral simulation.  
**Audience:** Development agents and engineers implementing Scenario, Behavior, Delayed Outcome, Perspective Switch, Memory, AIR, and Reputation engines.

---

## Part 1 — Content & Classification Architecture

### 1.1 Content Funnel

```
50 Real Scenarios (raw stories)
    ↓ classification
8 Conflict Archetypes (tagging)
    ↓ selection & dedup
30 Core Arena Scenarios (playable base set)
    ↓ POV expansion
Perspective Switch (same base × 4 POVs = up to 120 experiences)
    ↓
12 Foundry Lessons (leader philosophy training)
    ↓
Action QR System (concrete next actions)
```

### 1.2 Eight Conflict Archetypes

| ID | Archetype | Core Question | Key Signals |
|----|-----------|---------------|-------------|
| 1 | Skill Gap Misinterpretation | Is this a learning gap, not attitude? | New staff, "still learning," mistake read as incompetence, "why don't they know" |
| 2 | Authority Challenge | Is authority being tested? | Ignoring lead/manager/doctor, public pushback, sarcasm, "why are they like this now," rallying others |
| 3 | Hero Trap | Did the leader solve it while robbing the team of learning? | "I'll just do it myself," direct fix, no delegation, team growth stalls |
| 4 | Protection Failure | Did the leader stay neutral/avoid when they should have protected? | Manager neutral, doctor unsupported, "I wasn't in the op," no public support |
| 5 | Patient Pressure | Did the conflict start with the patient? | Complaint, wait time, crown sensitivity, filling pain, cleaning quality, Medicaid pressure |
| 6 | Training Breakdown | Is the core problem collapsed training? | "I already showed you many times," no time to teach, onboarding failure, repeated mistakes, no system |
| 7 | Blame Chain | Is responsibility shifting down/ sideways? | Doctor→assistant, assistant→admin, admin→SSO, "system confusion" |
| 8 | Leadership Burnout | Is the core problem leader depletion? | Doing it all alone, exhaustion, withdrawal, "it's not worth it" |

### 1.3 Classification Rule: Leader Pattern Over Surface Event

- **Do not** classify by surface event (e.g. crown complaint, admin mistake).
- **Do** classify by **repeating leader response pattern** (e.g. "I'll fix it" → Hero Trap).
- Same trigger can map to different archetypes depending on how the leader consistently responds.

### 1.4 Extracted Fields (for auto-classification)

Each scenario is parsed into:

| Field | Type | Description |
|-------|------|--------------|
| `actors` | string[] | doctor, manager, assistant, admin, DSO, patient |
| `trigger` | enum | mistake, complaint, disrespect, delay, overload, neutrality |
| `leader_response` | enum | fix, confront, avoid, delegate, blame, protect |
| `emotional_core` | enum | distrust, shame, anger, exhaustion, confusion, unfairness |
| `training_signal` | boolean | Training/learning context present |
| `patient_signal` | boolean | Patient-driven conflict |
| `authority_signal` | boolean | Authority being challenged |
| `blame_signal` | boolean | Blame transfer present |
| `protection_signal` | boolean | Protection/neutrality moment |

### 1.5 Classification Scoring & Output

- Score each of 8 archetypes 0–5 (keyword + pattern + `leader_response` weight).
- **Primary:** highest score.
- **Secondary:** assign if second-highest ≥ threshold (e.g. 70% of primary or absolute ≥ 3).
- **Tie-break:** prefer archetype that matches `leader_response` (e.g. "fix" → Hero Trap over Skill Gap).

### 1.6 30 Core Arena Scenario Distribution (Reference)

- Skill Gap Misinterpretation: 1–4  
- Authority Challenge: 5–8  
- Hero Trap: 9–12  
- Protection Failure: 13–15  
- Patient Pressure: 16–19  
- Training Breakdown: 20–22  
- Blame Chain: 23–26  
- Leadership Burnout: 27–30  

(Exact titles per slot to be filled from classified 50; dedup by primary + trigger + leader_response.)

### 1.7 8 × 12 Foundry Mapping

| Archetype | Linked Foundry (primary) |
|-----------|--------------------------|
| 1 Skill Gap | Teaching vs Showing, Trust Before Competence |
| 2 Authority | Authority vs Respect, Leadership Presence |
| 3 Hero Trap | Responsibility Architecture, Teaching vs Showing |
| 4 Protection | Integrity Under Pressure, Protection vs Neutrality |
| 5 Patient Pressure | Clinical Pressure Leadership, Decision Under Pressure |
| 6 Training Breakdown | Teaching System Design, Responsibility Architecture |
| 7 Blame Chain | Ownership vs Blame, System Thinking |
| 8 Leadership Burnout | Sustainable Leadership, The Loneliness of Leadership |

**Secondary Foundry:** For Hero Trap and Training Breakdown, also recommend *Sustainable Leadership* when burnout pattern appears.

### 1.8 Twelve Foundry Programs (IDs for linking)

1. Teaching vs Showing  
2. Trust Before Competence  
3. Authority vs Respect  
4. Leadership Presence  
5. Responsibility Architecture  
6. Integrity Under Pressure  
7. Protection vs Neutrality  
8. Clinical Pressure Leadership  
9. Decision Under Pressure  
10. Teaching System Design  
11. Ownership vs Blame  
12. The Loneliness of Leadership  

*(Optional 13th: Perspective Awareness — for Perspective Switch–driven unlocks.)*

---

## Part 2 — Arena Scenario Engine

### 2.1 Scenario Identity

- **Base Scenario ID:** e.g. `BASE-{archetype_id}-{index}` or `A-{nn}` (e.g. `A-07`).
- **POV Scenario ID:** `{base_id}-{POV}` e.g. `A-07-Doctor`, `A-07-Manager`, `A-07-Assistant`, `A-07-Admin`.
- One base scenario can produce up to 4 POV scenarios (same trigger, different choices/outcomes/emotions per role).

### 2.2 Arena Engine Format (per POV scenario)

Every playable scenario document MUST have this structure:

```yaml
scenario_id: string          # POV scenario ID
base_scenario_id: string     # Base for Perspective Switch linking
title: string
primary_archetype: number    # 1–8
secondary_archetype: number | null

pov: enum                   # Doctor | Manager | Assistant | Admin | DSO

trigger: string             # One-sentence event start
situation_context: string[] # Bullet points (e.g. busy Medicaid clinic, doctor doing cleaning)

choices:
  - id: A
    label: string           # Short label
    text: string            # What the leader says/does
  - id: B
    label: string
    text: string
  - id: C
    label: string
    text: string
  - id: D
    label: string
    text: string

immediate_outcomes:         # Per choice
  A: string
  B: string
  C: string
  D: string

delayed_outcomes:           # At least distinguish "default failure path" (e.g. A) vs others
  A: string                 # Typical negative delayed outcome for this choice
  B: string
  C: string
  D: string

hidden_emotion_layer:
  doctor: string
  manager: string
  assistant: string
  admin: string

mirror_question: string     # Reflection question
foundry_trigger: string[]   # Foundry program IDs (1–2)

# Optional: for Delayed Outcome Engine
behavior_flags_per_choice:
  A: [HERO_TRAP]            # Which flags this choice increments
  B: [TRUST_BUILD]
  C: [WITHDRAWAL]
  D: [BLAME_SHIFT]
```

### 2.3 Human Review Checklist (post–auto-conversion)

- [ ] Trigger is one clear sentence.  
- [ ] Choices A–D are distinct (no overlap).  
- [ ] Immediate outcomes map 1:1 to choices.  
- [ ] Delayed outcomes reflect the scenario’s repeating pattern (at least A vs non-A differ).  
- [ ] Mirror question matches primary archetype and Foundry.  
- [ ] Foundry trigger has 1–2 programs.

---

## Part 3 — Behavior Engine

### 3.1 Behavior Flags (six)

| Flag | Meaning |
|------|--------|
| HERO_TRAP | Leader fixes personally instead of developing team |
| TRUST_BUILD | Leader creates space for team learning |
| AUTHORITY_BUILD | Leader establishes boundaries and clarity |
| BLAME_SHIFT | Leader shifts responsibility |
| PROTECTION | Leader supports team under pressure |
| WITHDRAWAL | Leader avoids responsibility or conflict |

### 3.2 Flag Assignment Rule

- Each player **choice** (A/B/C/D) maps to **one or more** flags (see `behavior_flags_per_choice` in scenario).
- On submit: persist `(user_id, session_id, scenario_id, choice_id, flags[])` and pass to Memory Engine.

---

## Part 4 — Delayed Outcome Engine

### 4.1 Principle

- Consequences appear **later**, not in the same scenario.
- Flow: **Choice → Behavior Flag → Accumulation → Delayed Outcome Scenario** (1–3 scenarios after threshold).

### 4.2 State (per user/session)

- **Sliding window:** last `WINDOW_SIZE` scenarios (e.g. 6).
- **Per-flag counts within window:** e.g. `HERO_TRAP: 3`, `WITHDRAWAL: 2`.
- **Scenario history:** `[{ scenario_id, choice_id, flags[] }, ...]` for the window.

### 4.3 Thresholds and Triggers

- **Threshold:** e.g. any flag count ≥ 2 in the window.
- **When:** After each scenario completion, recompute windowed counts.
- **If threshold met:** Schedule a **Delayed Outcome Scenario** to appear **1–3 scenarios later** (e.g. next slot, or after 1 more normal scenario).
- **Which outcome:** Dominant flag (highest count, or most recently incremented) determines which Delayed Outcome narrative + Mirror + Foundry to show.

### 4.4 Delayed Outcome Content (by flag)

- **HERO_TRAP:** Team dependency ↑, initiative ↓, leader workload ↑.  
- **TRUST_BUILD:** Staff initiative ↑, learning accelerates.  
- **BLAME_SHIFT:** Blame culture develops.  
- **WITHDRAWAL:** Authority erodes.  
- **PROTECTION:** Trust in leadership ↑.  
- **AUTHORITY_BUILD:** (Positive outcome narrative.)

### 4.5 Outcome Dimensions (for narrative shaping)

All delayed outcomes should reference at least one of:

1. Skill Development  
2. Authority Stability  
3. Team Trust  
4. Leader Burnout  

### 4.6 Short-Session Path

- If user has played only 1–2 scenarios and no flag ≥ 2: show a **soft “early signal”** message (e.g. “Your last choice often leads to …”) instead of full Delayed Outcome Scenario, so short sessions still get pattern feedback.

---

## Part 5 — Perspective Switch Engine

### 5.1 Two Layers

| Layer | Description |
|-------|-------------|
| **Within-scenario** | After the player’s choice, show **Hidden Perspectives** (all four roles’ inner thoughts). Optionally show right after choice or after Immediate Outcome. |
| **Cross-scenario** | Same **base_scenario_id** played from a **different POV** later (e.g. Scenario 12 Manager → Scenario 18 Assistant, same base). |

### 5.2 Data Requirement

- Every scenario has `hidden_emotion_layer` (doctor, manager, assistant, admin).
- Base scenario has 1–4 POV variants (`base_scenario_id` + `pov`). Replay = offering another POV of the same base.

### 5.3 Replay Logic

- **Condition:** User has completed scenario with `base_scenario_id = X` in POV `Manager`. After N more scenarios (e.g. 2–4), add to pool: same base X with POV `Assistant` (or Doctor/Admin).
- **Framing:** “See the same moment through [Role]’s eyes” — present as new experience (different choices/outcomes), not repetition.

### 5.4 Mirror After Perspective

- When user completes a **replay** (same base, different POV), show a perspective-specific Mirror, e.g.:
  - “What pressure was invisible to you when you were [previous POV]?”
  - “Did your interpretation change after seeing another perspective?”
  - “Who in this situation felt unsupported?”

### 5.5 Foundry After Perspective

- Map repeated perspective shifts (or specific archetypes) to Foundry; e.g. Authority conflict → Authority vs Respect; blame cycles → Ownership vs Blame. Optional: add “Perspective Awareness” as 13th Foundry for perspective-heavy usage.

---

## Part 6 — Memory Engine

### 6.1 Role

- **Cross-cutting layer:** Consumes Behavior output; stores history; detects patterns; provides **recall** and **pattern summary** to Delayed Outcome, Mirror, and (optionally) Scenario selection.

### 6.2 Stored Data

- **Scenario decisions:** `user_id, scenario_id, base_scenario_id, pov, choice_id, archetype_id, flags[], timestamp`.
- **Behavior flag history:** Same, used for windowed counts (can derive from decisions).
- **Outcome history:** `user_id, scenario_id, outcome_type: immediate | delayed, timestamp`.
- **Perspective exposure:** `user_id, base_scenario_id, pov, timestamp` (which bases were played in which POV).

### 6.3 Pattern Detection

- Over sliding window (e.g. last 6 scenarios): count flags; detect “repeated HERO_TRAP,” “repeated BLAME_SHIFT,” etc.
- Expose: `dominant_flag`, `count_per_flag`, `last_choice_by_archetype` (for recall).

### 6.4 Recall Rule (“Last time you…”)

- **Do not** show “Last time you…” on every scenario.
- **Do** show only when **current scenario’s primary archetype or main flag** matches a **recent past decision** (same archetype or same flag).
- Query: same user, same archetype or same flag, most recent scenario in window → use that scenario’s choice label/text for: “Last time you chose to [X]. Would you do the same again?”

### 6.5 Mirror / Delayed Outcome Integration

- When generating Mirror or Delayed Outcome text, pass **pattern summary** and (if applicable) **one past choice** from Memory so the copy can include behavioral recall.

---

## Part 7 — AIR Scoring System

### 7.1 Definition

- **AIR** = behavioral metric (not knowledge).
- **A — Action:** Moved toward action vs avoidance.  
- **I — Integrity:** Acted consistently with stated leadership principles.  
- **R — Responsibility:** Took ownership for team development and outcomes.

### 7.2 Flag → AIR Effect

- **Increase AIR:** TRUST_BUILD, AUTHORITY_BUILD, PROTECTION.  
- **Slight decrease:** HERO_TRAP.  
- **Decrease:** BLAME_SHIFT, WITHDRAWAL.

### 7.3 Update Rule

- AIR changes **gradually**; use **pattern** over single decision (e.g. average flag effect over last N scenarios, or running weighted sum).
- Input: Behavior flag history (from Memory). Output: numeric AIR (internal) and/or band (e.g. “Strong in supporting the team”).

### 7.4 Display (Reputation / Mirror)

- Prefer **narrative feedback** over raw number (e.g. “Your recent choices often support the team under pressure”). Raw AIR can be internal only; show bands or narrative to user.

---

## Part 8 — Reputation Engine

### 8.1 Principles

- Reputation = **visible influence** from leadership behavior over time.
- **Individual AIR:** private (only the player sees detailed behavior history).
- **Public:** Team Index ranking, team improvement trends, milestone achievements only.
- Goal: collective growth, not personal rivalry.

### 8.2 Team Index Formula

- **Components (example weights):**
  - Average AIR (participants only): 40%
  - Participation rate (e.g. % of team who played in last 30 days): 30%
  - Successful completions (e.g. scenarios completed with Mirror): 20%
  - Behavioral growth trend (e.g. team AIR trend up vs previous period): 10%
- **Scope:** “Team” = clinic/office (configurable). Only members who participated in the window count for average AIR.

### 8.3 Visibility Rules

- **Private:** Individual AIR, full behavior history, individual rank vs others.
- **Public (team-level):** Team Index, team rank/band, improvement trends, milestone badges.
- **Individual recognition:** User sees “You are in Top 5%” / “Emerging Leader”; team sees only “This team has N Certified Leaders” (no names).

### 8.4 Certified Leader

- **Criteria:** Minimum AIR threshold, minimum scenario participation in period, stable pattern (no sharp drop, limits on BLAME_SHIFT/WITHDRAWAL ratio).
- **Not permanent:** Re-evaluate every 90 days; if criteria not met, certification lapses (or probation then lapse).

### 8.5 Recognition Milestones

- **Team:** Top 5 (or top band), Most Improved, Consistent Leadership Culture.  
- **Individual:** Top 5% Leadership Certification, Emerging Leader (e.g. strong growth trend).  
- Focus on **leadership development**, not raw performance metrics.

### 8.6 Engagement Cycles

- **30-day Arena cycle:** e.g. participation and completions for Team Index.  
- **90-day leadership league:** longer cycle for Certification and sustained growth.  
- Leaderboard: prefer **bands** (e.g. Gold/Silver/Bronze) over raw rank to reduce “scoreboard” feel.

### 8.7 Integration Flow

```
Arena Scenario → Player Decision → Behavior Flag Recorded
  → AIR Score Adjusted (Behavior + Memory)
  → Memory Engine Updates Pattern
  → Team Index Updated (batch or on completion)
  → Reputation Milestones / Certification Check
```

---

## Part 9 — System Flow Summary

### 9.1 Single Scenario Play-Through

1. **Scenario Engine:** Select scenario (and POV) for user; optionally use Memory/Reputation to suggest next (e.g. replay, or archetype to reinforce).
2. **Player** submits choice (A/B/C/D).
3. **Behavior Engine:** Emit flags for that choice; persist to **Memory Engine**.
4. **Memory Engine:** Append decision; update sliding-window counts; run pattern detection; optionally prepare recall (“Last time you…”).
5. **Delayed Outcome Engine:** Check thresholds; if met, schedule Delayed Outcome Scenario 1–3 plays later; if this play is a Delayed Outcome, show narrative + Mirror + Foundry unlock.
6. **Perspective Switch Engine:** After choice, show Hidden Perspectives (within-scenario); later, may offer same base as different POV (replay).
7. **AIR:** Update from flag history (Memory).
8. **Reputation Engine:** On scenario completion, update Team Index (and check milestones/Certification) per rules.

### 9.2 Data Flow Diagram (Conceptual)

```
[Scenario Engine] ──► scenario_id, choices, behavior_flags_per_choice
        │
        ▼
[Player Choice] ──► choice_id
        │
        ▼
[Behavior Engine] ──► flags[] ──► [Memory Engine] ──► history, pattern, recall
        │                                    │
        │                                    ├──► [Delayed Outcome Engine] (threshold, inject scenario)
        │                                    ├──► [Mirror] (pattern + recall text)
        │                                    └──► [AIR] ──► [Reputation Engine] (Team Index, Certification)
        │
        └──► [Perspective Switch] (Hidden Perspectives, Replay eligibility)
```

---

## Part 10 — Implementation Checklist

- [ ] **Content:** 50 scenarios classified (primary/secondary archetype, fields); 30 Core selected; Arena Engine Format documents per POV; human review done.
- [ ] **Scenario Engine:** Load scenarios by ID; support base_scenario_id + POV; expose choices and behavior_flags_per_choice.
- [ ] **Behavior Engine:** Map choice → flags; write to Memory.
- [ ] **Memory Engine:** Store decisions and outcomes; sliding window; pattern detection; recall by archetype/flag; expose API for Mirror/Delayed Outcome.
- [ ] **Delayed Outcome Engine:** Sliding window counts; threshold check; schedule and inject Delayed Outcome Scenario; link Mirror + Foundry.
- [ ] **Perspective Switch Engine:** Hidden Perspectives block after choice; replay logic (same base, different POV); perspective Mirror + Foundry.
- [ ] **AIR:** Compute from Memory flag history; gradual/pattern-based; narrative or band for display.
- [ ] **Reputation Engine:** Team Index formula; visibility rules; Certification (90-day, criteria); milestones; leaderboard bands.
- [ ] **Integration:** Single play-through flow wired; no duplicate business logic in UI (UI only renders engine outputs).

---

*End of document. Implement engines from this spec; keep business rules in domain/service layers and UI as read-only rendering.*
