## Section 1 — Difficulty Is Not Puzzle Complexity

**Difficulty** in BTY is the **weight of consequence** the user is asked to bear and act under—not how hard the situation is to **understand**, parse, or solve like a puzzle.

A **high-difficulty** scenario is **not** “more confusing” or “more riddles.” It is **harder to act on** because stakes are **real**, **relationally costly**, and/or **difficult or impossible to walk back**. The user may grasp the scenario quickly; the pressure is in **what executing the Action Contract would cost in the world**.

C2 **explicitly separates**:

- **Cognitive load (forbidden as the primary difficulty axis)** — Reading length, trickiness, abstraction, or “brain teaser” quality must **not** be used to scale difficulty. Using cognitive load as the main dial contradicts the Philosophy Lock: the system pressures **action under consequence**, not IQ-style performance.
- **Consequence weight (the actual difficulty axis family)** — Difficulty is expressed only through the **three sanctioned axes** below. Together they describe **how heavy** the situation is **to execute through**, not how hard it is to **comprehend**.

**The three and only three difficulty axes** (no others may be introduced):

### Axis A — Complexity

*Definition:* **Number of affected parties and degree of competing legitimate interests** implicated by a committed action.

| Level | Definition | Example |
| --- | --- | --- |
| **Low** | One primary party or tightly aligned stakeholders; little genuine conflict of interest. | You commit to sending a direct, overdue message to **one** colleague who is the sole affected party; interests are aligned with clarity. |
| **Medium** | Several parties with **partial** overlap of interests; trade-offs are real but bounded. | Your action visibly affects **your manager, peer, and client**; each has a legitimate claim on your time or risk, and favoring one strains another. |
| **High** | Many parties or **strongly competing legitimate claims**; no clean “everyone wins” path. | A commitment implicates **cross-functional leadership, your team, external partners, and end users** simultaneously, with credible obligations in tension. |

### Axis B — Impact

*Definition:* **Severity of outcome on people, relationships, roles, or systems** if the user acts—or fails to act—as the scenario pressures.

| Level | Definition | Example |
| --- | --- | --- |
| **Low** | Mostly reversible inconvenience; limited relational or operational blast radius. | Missing a self-set deadline delays **your own** deliverable with **minor** coordination cost. |
| **Medium** | Meaningful stress, trust erosion, or operational harm risk; recovery is possible but non-trivial. | A committed conversation could **reshape team trust** or **delay a milestone** others depend on. |
| **High** | Severe or lasting harm risk to people, careers, or system stability; failure modes are grave. | Execution could lead to **lasting relationship breakage**, **material harm to vulnerable parties**, or **major institutional damage** if mishandled. |

### Axis C — Irreversibility

*Definition:* **Degree to which the action, once taken, cannot be undone** (or can only be undone at prohibitive cost).

| Level | Definition | Example |
| --- | --- | --- |
| **Low** | Action is **fully or trivially reversible**; easy rollback, apology, or redo. | You change a **draft** plan before it is shared; no external commitment exists yet. |
| **Medium** | Reversal is **possible but expensive**—time, credibility, money, or rework. | You **publicly commit** to a date or owner; walking it back requires explicit repair work. |
| **High** | Action is **largely irreversible** or **structurally locking** once executed. | You **sign**, **terminate**, **publish irreversibly**, or take a step that **forecloses** prior options in law, policy, or deep relational fact. |

---

## Section 2 — Level Model

**Level** is the user’s **current position** in the system: a **capacity threshold** for **how much consequence weight** scenarios may carry **before** they are assigned to that user.

### What level represents

Level represents **depth of consequence the user is trained to handle** under BTY—i.e., **demonstrated tolerance and follow-through** when Action Contracts carry **real relational, operational, or irreversible weight**. It is **not** a badge of worth, cleverness, or virtue.

### How level is determined

Level is determined by **observed behavior in the engine**, not by narrative preference or time-on-app for its own sake. Primary signals include:

- **Action completion rate** — Verified Step 7 completions vs. started runs at the **current** difficulty band.
- **Execution quality** — Whether submitted contracts meet verification and **external-change** standards (per scenario architecture), not “how good” the choice was morally or cognitively.
- **Time-in-system** — Only as **context** for statistical confidence (e.g., enough runs to infer pattern), **not** as a direct XP-style unlock.

C2 **explicitly states**:

- **Level is NOT a reward.** It does not exist to make the user feel celebrated.
- **Level is NOT a rank.** It is not for leaderboard ordering or social comparison.
- **Level is NOT unlocked by engagement volume** (sessions, taps, reading time) **alone**.
- **Level reflects demonstrated capacity to complete Action Contracts under increasing consequence weight**—verified execution under heavier synchronized axes (Section 3).

### What changes at higher levels

At higher levels, the user encounters scenarios whose **authorized difficulty profile** carries **heavier synchronized consequence weight** across **Complexity**, **Impact**, and **Irreversibility**. The **seven-step scenario structure does not change**; **mechanics do not multiply**; **rewards do not appear**. Only **scenario consequence calibration** moves.

---

## Section 3 — Difficulty–Level Mapping

**Rule:** Every band uses the **same rating on all three axes** (Low / Medium / High). **Uneven** profiles (e.g., High Irreversibility with Low Complexity) are **forbidden**—they produce **narrative and ethical incoherence** relative to the Philosophy Lock.

**Minimum four bands:** entry and exit of the progression use **Low–Low–Low** and **High–High–High**; intermediate bands advance **all three axes together** without skew.

| Level Range | Complexity | Impact | Irreversibility | Notes |
| --- | --- | --- | --- | --- |
| **1–2** | Low | Low | Low | Onboarding band: few parties, mild stakes, reversible actions; establishes baseline execution habit. |
| **3–5** | Medium | Medium | Medium | Development band: bounded multi-party tension, meaningful stakes, costly-but-possible rollback. |
| **6–8** | Medium | Medium | Medium | **Same axis ratings as 3–5**; scenarios within band differ by **calibrated scenario library** (tighter real-world fit, richer Pattern Mirror history, stricter verification context)—**not** by splitting axes. |
| **9+** | High | High | High | Full-weight band: many legitimate conflicts, severe impact risk, largely irreversible execution surfaces. |

*Implementation note:* Bands **3–5** and **6–8** share **M/M/M** so that **level** can rise with **evidence density** (more runs, stronger mirror, narrower avoidance) **without** an illegal partial axis jump. If product needs a **fifth** band later, it must still obey **axis synchronization** (e.g., insert only **new** synchronized triples, never single-axis spikes).

---

## Section 4 — Adaptive Level Engine Rules

The engine may change level **only** via the triggers below. No other signals (social metrics, content consumption, “streak rewards,” etc.) may adjust level.

### Level increase trigger

**Rule:** **Sustained verified completion** at the user’s **current** difficulty band.

**Default — N (consecutive completions):** **N = 3**  
*Rationale:* Two completions can be luck or a good week; three **consecutive** verified Step 7 completions at the **same** band indicates a **repeatable** capacity to execute under that consequence weight. Product may raise N to 4 in high-risk domains; C2’s default is **3**.

*Definition of “consecutive”:* Completed scenario runs **in order** with **no** intervening **incomplete** outcome that resets the streak policy—specifically, any **`locked_step7_abandoned`** or **`in_progress`** run left unresolved per policy **breaks** the increase streak (treat as non-completion between successes unless product defines a grace window; default **no grace**).

### Level decrease trigger

**Rule:** **Repeated exit-system behavior** at the **current** difficulty band—operationalized as **abandoned Step 7** runs.

**Default — exit threshold:** **2 abandoned Step 7 runs within the user’s last 5 scenario starts** at the **same** level band **or** **2 consecutive** abandoned Step 7 runs at that band—**whichever occurs first** triggers evaluation for **one** level decrease (to the top of the next lower band per Section 3).

*Rationale:* A single abandonment may be life context; **two in five** or **back-to-back** abandons signal **patterned avoidance** at the current consequence weight. Further decreases require **re-applying** the rule after cooldown (implementation detail for C3); C2 default cooldown: **until 1 new verified completion** at decreased band **or** 30 days, whichever first—prevents thrash.

### Level hold

**Rule:** **Insufficient data** to justify increase or decrease.

**Default — minimum data floor for hold:** Fewer than **3** **started** scenario runs **while at the current level** that have **reached Step 1 completion** (i.e., entered the scenario in good faith). Alternatively, fewer than **2** **verified** completions at the current band when considering increase—**hold** increase until **≥ 2** verified completions exist at that band (in addition to the **N = 3 consecutive** rule for actual increase).

*Consolidated:* **Hold** if `runs_at_level < 3` **or** (when testing increase) `verified_completions_at_band < 2`. **Never** increase on first completion alone.

---

## Section 5 — What Level Does NOT Unlock

Level advancement **does NOT** grant:

- **New mechanics** — The seven-step scenario engine is fixed; level does not unlock alternate flows.
- **New features** — No gates on unrelated product capabilities tied to level.
- **Rewards or recognition displays** — No trophies, badges, celebratory copy framed as prize, or rank flair tied to level.
- **Skipping of any scenario step** — All steps remain mandatory and ordered.
- **Reduced pattern thresholds** — Pattern Mirror and exit-behavior detection do not soften to make advancement easier.

**Level advancement grants only:** **Access to scenarios authored and calibrated for higher synchronized consequence weight** (Section 3)—i.e., heavier **Complexity**, **Impact**, and **Irreversibility** together, with verification still required.

---

## Section 6 — Terminology Lock Addendum

*This section **adds** rows to the canonical terminology table in `PHILOSOPHY_LOCK_V1.md`. It does **not** replace that file’s Section 6.*

| Term | Locked Definition | Forbidden Substitutions |
| --- | --- | --- |
| Difficulty | Consequence weight across **Complexity / Impact / Irreversibility** axes (synchronized per band). | Hardness, challenge rating, puzzle complexity |
| Level | User’s **demonstrated capacity threshold** for **consequence weight** of assigned scenarios. | Rank, status, tier, grade |
| Level Increase | **System recognition** of **sustained verified action completion** at the current difficulty band (per Section 4). | Promotion, unlock, achievement, leveling up |
| Level Decrease | **System response** to **repeated exit-system behavior** (abandoned Step 7 pattern) at the current band (per Section 4). | Demotion, failure, penalty |
