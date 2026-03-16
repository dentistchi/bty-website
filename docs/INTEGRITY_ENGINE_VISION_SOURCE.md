# The Integrity Engine — Vision Source & Implementation Goal

## Big picture source

**The_Integrity_Engine.pptx** is the primary source for understanding the Integrity Engine at a glance.  
That presentation gives the **easiest-to-understand big picture** of what we are building.

**File location (local):**

```text
/Users/hanbit/Documents/web_development/bty arena/presentation/*The_Integrity_Engine.pptx
```

**Implementation goal:** Our goal is to **implement the Integrity Engine** as described in that presentation—i.e. the BTY Deterministic Leadership Engine that preserves leadership integrity at scale, converts intention into action, and prevents cultural drift through deterministic, automated mechanisms (AIR, TII, Forced Reset, Mirror, Certification, Arena/Foundry/Center).

---

## How this connects to repo docs

| Purpose | Document |
|--------|-----------|
| **Big picture (vision)** | The_Integrity_Engine.pptx (see path above) |
| **Executive narrative & concepts** | [BTY_DETERMINISTIC_LEADERSHIP_ENGINE_BRIEF.md](spec/BTY_DETERMINISTIC_LEADERSHIP_ENGINE_BRIEF.md) — Deterministic Leadership, 4 states, AIR, Reset, TII, Mirror, Certification, cultural drift, implementation summary |
| **Single source of truth (rules, formulas, API)** | `bty-app/docs/LEADERSHIP_ENGINE_SPEC.md` |
| **Phased implementation plan** | `bty-app/docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` (P1–P8, Cursor roles) |

When in doubt about *what* we are building, refer to the presentation. When implementing *how* (logic, data, UI), use the Brief and the technical spec.

---

## Note on slide content

The pptx slides are image-based; slide text is not machine-extractable from the file. **Screenshot or image of slides can be read** by the agent (via image description). For written narrative and definitions, use the Executive Brief and the spec. For visuals and flow, use the presentation directly.

---

## Slide-derived summary (from The Integrity Engine slides)

Below is a condensed summary of concepts taken from the presentation slides. Use it to align implementation with the “big picture.”

### Blueprint

- **Flow:** Strategic Intention Input → Integrity Protocol Processor ↔ Behavioral Dataset / Decision Engine → Verifiable Action Output.
- **Loops:** Leadership standard preservation, scalable cultural standards, deterministic rules, executive feedback (blue); cultural drift observed, operational feedback (orange).
- **Components:** Behavioral distortion detectors, team alignment protocols, cultural drift checkpoints.
- **Tagline:** “This is not a motivation problem. It is a systems problem.”

### Neuro-behavioral loop (action-conditioning, not gamification)

- **Cycle:** User Performs Task (ACTION) → Digital/Physical Confirmation (VERIFICATION, e.g. QR) → System Records & Displays (SCORE UPDATE) → Dopamine pathway activation → Identity Reinforcement (status/self-perception) → back to ACTION.
- **Supporting mechanisms:** Leaderboard leverages TII and social proof; Dynamic Certification is a **leased status** (re-earned, not owned); QR verification forces physical or highly specific digital action to break passive click-through.

### 90-Day MVP Protocol

- **Phase 1 (Day 1–38):** Leadership AIR Acquisition — target 80%+ Leader Cert rate; baseline established.
- **Phase 2 (Day 38–68):** Conditional Certification & Friction Testing — target &lt;5% Reset abandonment; certification gate.
- **Phase 3 (Day 68–98):** System Integrity Validation & Broader Rollout Prep — decrease in subjective complaints; organization rollout.
- **Success metrics:** 80%+ Leader Certification rate, &lt;5% Reset abandonment.
- **Cultural shift indicators:** Decrease in subjective HR complaints, increase in self-initiated corrective actions, standardized team meetings.

### Deterministic vs AI

- Deterministic: **Action X always equals Consequence Y**; auditable rule-based transitions; state machine logic; **zero subjectivity** (managers cannot override or fudge to protect favored personnel).

### Reset protocol (from slides)

- **Trigger:** 2 of 4 consecutive critical activation windows failed.
- **48-hour window;** non-dismissible (managers cannot cancel, waive, or postpone).
- **Post-compliance:** AIR recovers via 2x Reset action weight; user regains momentum; state returns to baseline.
- **If ignored:** AIR locks into accelerated decay; **Certified status lost instantly**; escalation triggers Mirror (perspective shift).

### TII (from slides)

- **Formula:** TII = (Avg AIR × 60%) + (Micro Win Density × 25%) + (Team Stability × 15%).
- **Individual AIR:** Strictly private (no toxic internal competition).
- **Only aggregated TII** is visible on leaderboards.
- **Decoding:** e.g. TII 0.62 = team completing 62% of actions required for baseline; intervention at leadership layer. **Threshold:** &gt;0.70 warning; below = “Leadership intervention required.”

### Mirror (perspective balancing)

- **Trigger:** Repeated behavioral distortions.
- **Mechanism:** Unannounced perspective flip; UI and operational demands change without warning; leaders experience staff friction, staff experience leadership accountability.
- **Framing:** “Empathy cannot be lectured; it must be experienced.” Deterministic viewpoint balancing to resolve blind spots, not psychological manipulation.

### Three pillars & user flow

- **ARENA (Execution):** Scenario engine, real-time engagement, QR activations, public dashboard/leaderboard.
- **FOUNDRY (Development):** Philosophy and training, delayed-reward conditioning, advanced models unlocked by consistency.
- **CENTER (Calibration):** Private diagnostic hub; reflection; **Integrity Reset protocol** execution.
- **Flow:** User executes in Arena → consistency unlocks Foundry → if AIR drops or distortions occur, **ejected to Center** → must complete structural Reset in Center to regain Arena access.
