# STAB-07-P0 — Canonical Scenario Classification Sheet

Generated: 2026-05-22
Anchor: outer ff9c58e / inner 4ae97ea8
Mode: READ-ONLY extraction (no mutation, no classification — Commander classifies)
Total scenarios surfaced: **31** (27 core registry + 3 chain-elite + 1 own_re02_r1)

> Memory expected "27 Elite-only". Actual: the **27-core registry** is the primary served catalog (`loadArenaScenarioPayloadFromDb` → `src/data/scenario`), AND a **separate 4-scenario Elite dataset** exists (`loadEliteDataset()` = chain-3 + own_re02_r1, dataset id `canonical_elite_v2_chain_plus_own_re_02_r1`, reached via a distinct entry path / `getEliteScenarioCatalogMetas`). Both are code-static. The two catalogs use **different id-spaces** and are listed separately below. Discrepancy from "27" is the +4 Elite dataset; not force-fit.

## Commander Classification Decision (2026-05-22)

**All 27 core scenarios: `relational_qr_witness`**

Rationale (Commander-locked):
- BTY scenarios serve role-transposition learning; the specific clinical/role pressure is a vehicle, users apply to their own context.
- "Negative attitude" = compromise on action under fatigue. "Positive attitude" = the act of executing any committed decision.
- QR scan is the structural enforcement of positive attitude — even internal-decision actions are explained to a witness and scanned, which itself is action.
- self_attest is preserved as an ACTION TYPE (what the user committed to, possibly internal), NOT a verification mode bypass — QR is required regardless.
- Actor ≠ Approver universally; no self-loop accepted.
- MVP receiver policy: any authenticated user. Post-MVP: BTY users only. Future: role-restricted by office/role-type.

Per-scenario classification uniformly:
  classification: relational_qr_witness
  actor: [scenario role as listed below]
  approver: any QR-scanning witness (MVP scope)

Individual scenario rows below preserve raw data extraction (READ-ONLY inventory phase) for historical provenance.

### Critical context — Layer 2 dependency
Universal QR requires Layer 2 (runLayer2Semantic) to pass before awaiting_qr is reached. Layer 2 enforces external_measurability, which is BTY-aligned: "I committed to a real-world action observable beyond my own head." Layer 2 requires LLM configuration (OPENAI_API_KEY or LLM_BASE_URL) in the worker. Confirmed present on staging worker (2026-05-22). Production worker LLM env: separate verification required before production launch.

### What STAB-07-P0 does NOT close
Behavioral re-exposure after reported/verified action remains a known STAB-07-P1 backlog item. Avoidance-triggered re-exposure exists and is wired; completion-triggered behavioral validation (testing whether the same user faces same-axis pressure again and chooses action vs avoidance) is not yet wired. Launch cohort observation will inform STAB-07-P1 priority.

---

## Source Breakdown

- **Legacy index (majority): 27** — `src/data/scenario/index.ts` aggregates 27 folders `core_01_…/` … `core_27_…/`, each with `base.json` (lang-neutral structure + incident axis) + `en.json` + `ko.json`. Runtime payloads resolve here via `loadArenaScenarioPayloadFromDb` (the `reader`/DB arg is accepted but **ignored** for payload resolution — see `src/lib/bty/arena/scenarioPayloadFromDb.ts`). Folder name ≠ scenario id (e.g. folder `core_01_training_system_exposure` → id `core_01_problem_framing`); ids drift further in core_19–22.
- **Chain runtime: 3** — `CHAIN_WORKSPACE_ELITE_IDS = [core_01_training_system, core_06_lead_assistant, core_11_staffing_collapse]` (`src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts`), projected from `src/data/bty_chain_workspace/Chains/…`.
- **own_re02_r1: 1** — `buildOwnRe02R1EliteScenario()` (`src/lib/bty/arena/ownRe02R1EliteScenario.server.ts`), id `OWN-RE-02-R1`.
- **v2 JSON artifact: 46** — `src/data/bty_elite_scenarios_v2.json` (`BTY_ELITE_SCENARIOS_v2`, total 46). Explicitly a **build/sync artifact** ("Runtime narrative never comes from `bty_elite_scenarios_v2.json`" — `eliteScenariosCanonical.server.ts`). NOT counted as a runtime scenario; not classified here.
- **v1 JSON artifact: 50** — `src/data/bty_elite_scenarios.json` (`BTY_ELITE_SCENARIOS_v1`, total 50). Build artifact; used here only to surface chain-3 titles. Not classified.
- **DB-only scenarios: NONE** — Arena runtime does not read `public.scenarios` for payloads (`scenario-catalog-sync.service.ts`). No Supabase Studio query required for this inventory.

## Verification-seeding note (STAB-07 context)

No scenario definition (registry or elite) contains a `verification_type` / `verification_mode` / solo / relational field. `verification_type:"self_attest"` + `details.self_report_auto_approve:true` is stamped exclusively by the 3 contract-creation paths (`src/lib/bty/action-contract/ensureActionContract.ts:280`, `src/lib/bty/arena/eliteBindingActionCommitment.server.ts:201`, `src/app/api/arena/action-contracts/route.ts:64`), not by scenario data. Therefore every scenario below reports `current verification (data) = not specified at scenario level`.

## Flag Distribution (all 31)

- CLEAR-SOLO: 1
- CLEAR-RELATIONAL: 2
- AMB-1: 0
- AMB-2: 15  (12 core + 3 elite)
- AMB-3: 8
- AMB-4: 0
- AMB-5: 5  (4 core + 1 elite)

> Flags are data-derived ambiguity tags (PHASE 2), NOT classifications. The dominant pattern: action verbs are reflexive ("Decide whether to…") inside relational pressure contexts → AMB-2; "create/define one observable mechanism/standard" → AMB-3 (artifact, no named human verifier). 5 scenarios lack an `action_contract.description` entirely → AMB-5 (action data absent; choice options summarized instead).

---

## Scenarios — Catalog A: 27-core registry (`src/data/scenario/`)

### [1/31] scenario_id: `core_01_problem_framing`
- **source**: `src/data/scenario/core_01_training_system_exposure/en.json` (base: `…/base.json`, dbScenarioId `INCIDENT-01-OWN-01`)
- **title**: Performance Issue or Early System Signal
- **axis**: Blame vs Pattern Recognition (axis_primary: Axis 1 — Ownership)
- **pattern_family**: blame_shift, future_deferral, delegation_deflection, system_thinking (per-choice + pattern_detection)
- **prompt**: A new assistant in a busy Medicaid-heavy office makes repeated small mistakes; doctors are frustrated but production is stable and there are no formal complaints. Treating it as individual performance feels easier than exposing onboarding/training gaps.
- **action_required**: Make one observable action that either keeps the issue framed as individual performance or surfaces it as an early system pattern.
- **mentioned_humans**: office manager (actor), new assistant, doctors
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: Relational pressure (assistant/doctors) but the action verb is reflexive framing; whether an external witness is needed is not stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [2/31] scenario_id: `core_02_new_doctor_reexposure_compromise_loop`
- **source**: `src/data/scenario/core_02_new_doctor_reexposure_compromise_loop/en.json` (dbScenarioId `INCIDENT-01-OWNERSHIP-02`)
- **title**: The Compromise You Were Not Trained For
- **axis**: Integrity vs Adaptation (axis_primary: Ownership)
- **pattern_family**: integrity_compromise, adaptation_loop, ownership_act, future_deferral
- **prompt**: Now working independently, a Medicaid patient needs a crown insurance won't cover; the assistant quietly suggests a filling to keep the schedule moving. The actor was never trained for this.
- **action_required**: Decide whether to follow the existing compromise pattern or define your own standard.
- **mentioned_humans**: associate dentist (actor), Medicaid patient, assistant
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: Others named (patient/assistant) but the action is a reflexive own-standard clinical decision; no human verifier stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [3/31] scenario_id: `core_03_training_failure_hidden_as_performance_issue`
- **source**: `src/data/scenario/core_03_training_failure_hidden_as_performance_issue/en.json` (dbScenarioId `INCIDENT-01-OWNERSHIP-03`)
- **title**: When the System Becomes the Doctor's Problem
- **axis**: Blame vs System Awareness (axis_primary: Ownership)
- **pattern_family**: performance_blame, system_erasure, truth_naming, neutrality_masking
- **prompt**: A new doctor keeps struggling; assistants compensate, patients are delayed, complaints rise, and the team now labels the doctor "slow and difficult." No one mentions the training gap anymore.
- **action_required**: Decide whether to frame the issue as a doctor performance problem or a system failure.
- **mentioned_humans**: office manager (actor), new doctor, assistants, patients, team
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: Reflexive framing decision inside a multi-person context; no explicit witness requirement.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [4/31] scenario_id: `core_04_manager_neutrality_as_abandonment`
- **source**: `src/data/scenario/core_04_manager_neutrality_as_abandonment/en.json` (dbScenarioId `INCIDENT-01-TRUTH-04`)
- **title**: When Neutrality Feels Like Abandonment
- **axis**: Neutrality vs Truth (axis_primary: Truth)
- **pattern_family**: neutrality_masking, conflict_avoidance, truth_naming, abandonment_signal
- **prompt**: The manager's silence over a struggling doctor is being read as a stance: assistants feel unsupported, the doctor feels quietly judged. The team waits to see what the manager will say.
- **action_required**: Decide whether to remain neutral or clearly name the pattern affecting the doctor and team.
- **mentioned_humans**: office manager (actor), doctor, assistants, team
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: One option ("clearly name the pattern… to the doctor and team") is relational; the other (remain neutral) is internal — verb is "decide".

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [5/31] scenario_id: `core_05_resignation_signal`
- **source**: `src/data/scenario/core_05_resignation_signal/en.json` (dbScenarioId `INCIDENT-01-TRUTH-05`)
- **title**: The Signal Before They Leave
- **axis**: Containment vs Truth (axis_primary: Truth)
- **pattern_family**: resignation_signal, burnout_normalization, truth_naming, conflict_avoidance
- **prompt**: An assistant confides they're tired of carrying the new doctor and may leave; the manager listens but nothing changes. The office runs but the team is quieter.
- **action_required**: Decide whether to contain the resignation signal privately or surface the underlying pattern before turnover begins.
- **mentioned_humans**: lead assistant (actor), assistant, manager, new doctor
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "Surface the pattern" implies others; "contain privately" is internal — reflexive decide verb, no named verifier.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [6/31] scenario_id: `core_06_external_exposure`
- **source**: `src/data/scenario/core_06_external_exposure/en.json` (dbScenarioId `INCIDENT-01-TRUTH-06`)
- **title**: When It Leaves the Room
- **axis**: Reputation Protection vs Structural Truth (axis_primary: Truth)
- **pattern_family**: reputation_protection, system_exposure, truth_naming, delegation_deflection
- **prompt**: A negative patient review cites inconsistent explanations, staff hesitation, and a disorganized visit — externally surfacing the unresolved internal tension. The issue is no longer contained.
- **action_required**: Decide whether to contain the external complaint or use it to surface the internal breakdown.
- **mentioned_humans**: office manager (actor), patient (reviewer), new doctor, assistants
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: External artifact (review) present; action is a reflexive contain-vs-surface decision; no human approver named.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [7/31] scenario_id: `core_07_repair_conversation`
- **source**: `src/data/scenario/core_07_repair_conversation/en.json` (dbScenarioId `INCIDENT-01-REPAIR-07`)
- **title**: The First Real Repair Conversation
- **axis**: Comfort vs Truth vs Ownership (axis_primary: n/a)
- **pattern_family**: emotional_release_loop, truth_avoidance, defensiveness, ownership_conflict, structure_creation
- **prompt**: The manager brings the doctor and assistants together after external exposure; everyone holds a different interpretation and trust is fragile. First moment where the system can reset or fracture further.
- **action_required**: ⚠️ DATA GAP — no `action_contract.description` in scenario data. Choice options: (A) Let everyone speak freely (B) Define what actually happened (C) Focus only on moving forward (D) Let them resolve it themselves.
- **mentioned_humans**: office manager (actor/facilitator), doctor, assistants
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: CLEAR-RELATIONAL
- **flag_reason**: Action is facilitating a multi-person repair conversation (doctor + assistants present); inherently witnessed — though the canonical action field is absent (data gap).

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [8/31] scenario_id: `core_08_doctor_repair`
- **source**: `src/data/scenario/core_08_doctor_repair/en.json` (dbScenarioId `INCIDENT-01-REPAIR-08`)
- **title**: Where Responsibility Lands
- **axis**: Self-Protection vs Accurate Ownership (axis_primary: Repair)
- **pattern_family**: defensiveness, blame_shift, over_ownership, ownership_clarity, system_vs_individual_confusion
- **prompt**: After the repair conversation, attention turns to the doctor; assistants expect acknowledgment and the manager watches whether the doctor can own impact without collapsing into shame or defending every decision.
- **action_required**: Decide how to respond when responsibility moves from the system conversation to your personal impact.
- **mentioned_humans**: associate dentist (actor), assistants, manager
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: Acknowledgment is to people present (assistants/manager) → relational-leaning, but the verb is "decide how to respond"; no explicit verifier.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [9/31] scenario_id: `core_09_identity_shift`
- **source**: `src/data/scenario/core_09_identity_shift/en.json` (dbScenarioId `INCIDENT-01-REPAIR-09`)
- **title**: The Standard You Become
- **axis**: Insight vs Identity (axis_primary: Repair)
- **pattern_family**: insight_without_behavior, identity_commitment, private_intention, temporary_compliance, standard_creation
- **prompt**: The repair conversation is over and no one is forcing the next step. The question is whether the incident becomes a temporary lesson or a personal standard carried into the next pressured clinical decision.
- **action_required**: Convert the incident into one repeatable standard that remains visible under future pressure.
- **mentioned_humans**: self (actor); no other human in the action
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: CLEAR-SOLO
- **flag_reason**: Role is Self; action is an internal personal-standard commitment with no second human in the loop ("remains visible" is to self under future pressure).

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [10/31] scenario_id: `core_10_integrity_favoritism_signal`
- **source**: `src/data/scenario/core_10_integrity_favoritism_signal/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-10`)
- **title**: Something Feels Off
- **axis**: belonging_vs_truth (axis_primary: awareness; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes (e.g. "Initial recognition of unequal patterns")
- **prompt**: A subtle, repeated favoritism pattern (scheduling, expectations, support) appears across days with no policy explaining it; the actor is unsure whether to trust what they're seeing.
- **action_required**: Capture one observable example of inconsistency before it is rationalized or dismissed.
- **mentioned_humans**: associate dentist (actor), doctors (one favored)
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Action produces an external artifact (a documented example) but names no human approver.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [11/31] scenario_id: `core_11_selective_standard_escalation`
- **source**: `src/data/scenario/core_11_selective_standard_escalation/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-11`)
- **title**: This Is Not Neutral
- **axis**: belonging_vs_fairness (axis_primary: truth; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: The same behavior produces different consequences depending on the person (a newer assistant corrected immediately, a favored one given softer responses); consistent enough to be a pattern, but unnamed.
- **action_required**: Identify and define one specific inconsistency pattern and translate it into a clear fairness standard.
- **mentioned_humans**: associate dentist (actor), assistant, doctor, favored staff
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Analytical/definitional action producing a standard artifact; no human verifier named.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [12/31] scenario_id: `core_12_silence_normalization`
- **source**: `src/data/scenario/core_12_silence_normalization/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-12`)
- **title**: No One Says Anything
- **axis**: expression_vs_self_preservation (axis_primary: truth; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: Everyone sees a manager applying inconsistent standards; the office goes quiet near leadership and replaces direct acknowledgment with jokes. Speaking up risks looking "difficult."
- **action_required**: Name the role silence is playing in the system and take one observable step that prevents silence from being treated as neutrality.
- **mentioned_humans**: associate dentist (actor), manager, assistant, doctors, front desk
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "Observable step" + "name" with an unspecified audience; could be solo-with-artifact or relational depending on audience — not stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [13/31] scenario_id: `core_13_assistant_adaptation`
- **source**: `src/data/scenario/core_13_assistant_adaptation/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-13`)
- **title**: They've Adjusted
- **axis**: Survival vs Principle (axis_primary: n/a)
- **pattern_family**: behavior_adaptation, incentive_learning, silent_alignment, identity_shift
- **prompt**: Assistants no longer react to inconsistency — they adapt to it, anticipating which doctor gets flexibility. No one talks about fairness; the system is predictable but not fair.
- **action_required**: ⚠️ DATA GAP — no `action_contract.description`. Choice options (all internal recognition): (A) Accept adaptation as normal (B) Recognize adaptation as distortion (C) Focus only on efficiency (D) Stay neutral and observe.
- **mentioned_humans**: observer (actor/role), assistants, doctors
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-5
- **flag_reason**: No action commitment field; choices are internal recognition stances with no observable behavior or verifier — insufficient to determine.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [14/31] scenario_id: `core_14_manager_awareness_gap`
- **source**: `src/data/scenario/core_14_manager_awareness_gap/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-14`)
- **title**: They Are Talking About a Different Reality
- **axis**: Authority vs Reality Integrity (axis_primary: n/a)
- **pattern_family**: awareness_gap, perception_split, authority_bias, internal_conflict, reality_suppression
- **prompt**: In a team meeting the manager describes the office as consistent, fair, and well-supported; the actor's daily experience contradicts nearly all of it. The system's owner is describing a different reality.
- **action_required**: ⚠️ DATA GAP — no `action_contract.description`. Choice options (internal): (A) Assume the manager has info you don't (B) Recognize leadership perception is misaligned (C) Question your own judgment (D) Disengage from leadership perspective.
- **mentioned_humans**: associate dentist (actor), manager, assistants
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-5
- **flag_reason**: No action commitment field; choices are internal recognition stances — insufficient to determine.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [15/31] scenario_id: `core_15_system_exposure`
- **source**: `src/data/scenario/core_15_system_exposure/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-15`)
- **title**: This Can't Stay Internal
- **axis**: Reputation vs Integrity (axis_primary: n/a)
- **pattern_family**: system_exposure, inconsistency_visible, external_risk, accountability_conflict
- **prompt**: A patient files a formal complaint noting two doctors recommended completely different treatments for the same condition, questioning office integrity. No longer internal — external credibility damage that may escalate.
- **action_required**: ⚠️ DATA GAP — no `action_contract.description`. Choice options: (A) Frame it as a misunderstanding (B) Acknowledge inconsistency as a system issue (C) Focus on resolving the patient only (D) Identify a responsible individual.
- **mentioned_humans**: associate dentist (actor), patient (complainant), two doctors
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-5
- **flag_reason**: No action commitment field; choices mix framing/external-handling without a defined observable action or verifier — insufficient.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [16/31] scenario_id: `core_16_repair_standard_reset`
- **source**: `src/data/scenario/core_16_repair_standard_reset/en.json` (dbScenarioId `INCIDENT-02-INTEGRITY-16`; `action_contract` confirmed `null`)
- **title**: Then Define It — For Real
- **axis**: Clarity vs Social Stability (axis_primary: n/a; extra keys: identity_weight, risk_layer, social_pressure, time_pressure)
- **pattern_family**: none in data (empty pattern_detection)
- **prompt**: A post-incident meeting agrees "something needs to change," but defining a real standard meets immediate resistance ("Every case is different"; "We can't make rigid rules"); assistants are silent, the manager hesitates. No one has ever committed to a shared standard.
- **action_required**: ⚠️ DATA GAP — `action_contract` is null. Choice options: (A) Keep discussion general (B) Push for a clear, shared standard now (C) Let each provider define their own approach (D) Delay decision.
- **mentioned_humans**: "System Actor" (actor role), doctors, assistants, manager
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-5
- **flag_reason**: No action commitment field; the strongest option ("push for a shared standard now") occurs in a group meeting but the canonical action is absent — insufficient to flag confidently.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [17/31] scenario_id: `core_17_lead_assistant_repair`
- **source**: `src/data/scenario/core_17_lead_assistant_repair/en.json` (dbScenarioId `INCIDENT-02-REPAIR-17`)
- **title**: Repair Has to Reach the Person Who Carried It
- **axis**: Compliance vs Trust Repair (axis_primary: Repair)
- **pattern_family**: policy_without_repair, surface_compliance, unacknowledged_burden, trust_repair, boundary_reset
- **prompt**: A new standard is defined after the complaint; leadership promises consistency. The lead assistant — who absorbed the unfairness and stayed quiet — is now asked to trust the reset.
- **action_required**: Decide whether the new standard will be accepted as policy only or repaired relationally with the people who carried the unfairness.
- **mentioned_humans**: lead assistant (actor), leadership, "the people who carried the unfairness"
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: One option is explicitly relational ("repaired relationally with the people"); the other is policy-only/internal — verb is "decide".

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [18/31] scenario_id: `core_18_identity_integrity_choice`
- **source**: `src/data/scenario/core_18_identity_integrity_choice/en.json` (dbScenarioId `INCIDENT-02-REPAIR-18`)
- **title**: The System You Choose After Repair
- **axis**: identity_integrity_choice (axis_primary: integrity; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: The incident has been publicly addressed; staff watch whether the repair becomes a durable operating standard or a polished ending.
- **action_required**: Choose the operating system that will govern future integrity conflicts and make one observable commitment that limits selective authority.
- **mentioned_humans**: clinical director / partner doctor (actor), staff
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Produces an observable commitment/mechanism (artifact); no specific human approver named.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [19/31] scenario_id: `core_19_identity_integrity_propagation`
- **source**: `src/data/scenario/core_19_authority_signal/en.json` (folder name ≠ id; dbScenarioId `bty_incident_02_core_19`)
- **title**: When the System Starts to Drift
- **axis**: system_integrity_under_drift (axis_primary: integrity; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: Weeks after defining the integrity system, operations have normalized but subtle variations appear across offices; it's unclear whether the system is still being applied consistently.
- **action_required**: Detect and respond to early system drift with a concrete, observable enforcement mechanism.
- **mentioned_humans**: clinical director / partner doctor (actor), other offices/leaders
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Produces an enforcement mechanism (artifact); no named human verifier.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [20/31] scenario_id: `core_20_identity_integrity_inheritance`
- **source**: `src/data/scenario/core_20_unquestioned_decision/en.json` (folder name ≠ id; dbScenarioId `bty_incident_02_core_20`)
- **title**: When Integrity Must Survive You
- **axis**: identity_integrity_inheritance (axis_primary: integrity; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: The integrity system has been tested across offices; now new leaders/partner doctors/regional managers must carry it without the founder's presence. The org watches whether the standard belongs to the system or still to the person.
- **action_required**: Create one observable transfer mechanism that lets another leader apply the integrity system under pressure without relying on your interpretation.
- **mentioned_humans**: clinical director / partner doctor (actor), new leaders, partner doctors, regional managers
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Action involves another leader but is framed as creating a transfer mechanism (artifact); no explicit witness/approval step stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [21/31] scenario_id: `core_21_identity_integrity_correction`
- **source**: `src/data/scenario/core_21_silence_under_hierarchy/en.json` (folder name ≠ id; dbScenarioId `bty_incident_02_core_21`)
- **title**: When the System You Built Is Used Wrong
- **axis**: identity_integrity_correction (axis_primary: integrity; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: A successor applies the integrity system in a way that looks compliant but creates fear/rigidity/selective pressure. People watch whether the founder takes control back, protects the successor, or builds correction into the system.
- **action_required**: Respond to distorted use by creating one observable correction loop that keeps ownership with the operating system, not personal authority.
- **mentioned_humans**: clinical director / partner doctor (actor), successor/new leader, people
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Produces a correction-loop mechanism (artifact); successor involved but no defined human approver.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [22/31] scenario_id: `core_22_identity_integrity_scaling_pressure`
- **source**: `src/data/scenario/core_22_assistant_truth_block/en.json` (folder name ≠ id; dbScenarioId `bty_incident_02_core_22`)
- **title**: The System Under Growth Pressure
- **axis**: scaling_integrity (axis_primary: integrity; difficulty: "final_full_density")
- **pattern_family**: pattern_detection holds signal sentences, not family codes
- **prompt**: Rapid expansion adds offices/staff/leaders faster than they can be trained; offices apply the system differently under pressure. The question is whether the system survives growth.
- **action_required**: Create one observable control that ensures the integrity system operates consistently across all offices during rapid expansion.
- **mentioned_humans**: clinical director / partner doctor (actor), new staff, new leaders, offices
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: Produces a control mechanism (artifact); no named human verifier.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [23/31] scenario_id: `core_23_manager_truth_block`
- **source**: `src/data/scenario/core_23_manager_truth_block/en.json` (dbScenarioId `INCIDENT-03-TRUTH-05`)
- **title**: The Manager Who Heard Both Sides
- **axis**: Containment vs Honest Diagnosis (axis_primary: Truth)
- **pattern_family**: truth_naming, documentation_sanitization, conflict_avoidance, authority_misuse
- **prompt**: The assistant says the doctor no longer trusts them; the doctor says the assistant has become passive. Production moves but the room is tense.
- **action_required**: Decide whether to name the trust pattern directly or keep the issue contained as a performance concern.
- **mentioned_humans**: office manager (actor), assistant, doctor
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "Name directly" implies relational; "contain as performance concern" is internal/documentary — verb is "decide".

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [24/31] scenario_id: `core_24_external_truth_exposure`
- **source**: `src/data/scenario/core_24_external_truth_exposure/en.json` (dbScenarioId `INCIDENT-03-TRUTH-06`)
- **title**: The Pattern You Can No Longer Ignore
- **axis**: Case Containment vs Structural Truth (axis_primary: Truth)
- **pattern_family**: system_thinking, self_protection, documentation_sanitization, explanation_substitution
- **prompt**: A patient complaint about confusion/inconsistent instructions/staff hesitation connects to a recent assistant concern and an office-manager report that didn't align. Signals are starting to connect.
- **action_required**: Decide whether to contain the complaint or connect it to a broader pattern.
- **mentioned_humans**: regional manager (actor), patient, assistant, office manager
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: Reflexive contain-vs-connect decision; analytical, no named human approver.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [25/31] scenario_id: `core_25_forced_repair_conversation`
- **source**: `src/data/scenario/core_25_forced_repair_conversation/en.json` (dbScenarioId `INCIDENT-03-REPAIR-07`)
- **title**: The Meeting You Cannot Avoid
- **axis**: Repair vs Image Protection (axis_primary: Repair)
- **pattern_family**: repair_avoidance, reputation_protection, truth_naming, conflict_avoidance
- **prompt**: Regional has requested a documented repair conversation between the doctor and assistant after a patient complaint made the pattern visible; neither party has named the trust breakdown.
- **action_required**: Facilitate a repair conversation that either names the trust breakdown or contains it as a communication issue.
- **mentioned_humans**: office manager (actor/facilitator), doctor, assistant, regional
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: CLEAR-RELATIONAL
- **flag_reason**: Action is facilitating a documented conversation between two named humans (doctor + assistant) — relational by construction.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [26/31] scenario_id: `core_26_doctor_repair_choice`
- **source**: `src/data/scenario/core_26_doctor_repair_choice/en.json` (dbScenarioId `INCIDENT-03-REPAIR-08`)
- **title**: What You Admit Changes Everything
- **axis**: Ownership vs Authority Protection (axis_primary: Repair)
- **pattern_family**: ownership_avoidance, authority_protection, integrity_alignment, partial_accountability
- **prompt**: The repair meeting exposed a hesitation/bypass pattern; the doctor senses their behavior under pressure contributed. The assistant waits to see what the doctor acknowledges.
- **action_required**: Decide how much ownership you will take for the breakdown and how visible that ownership becomes.
- **mentioned_humans**: associate dentist (actor), assistant
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "How visible that ownership becomes" implies an audience (the waiting assistant) but the action is a reflexive ownership decision; verifier not stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [27/31] scenario_id: `core_27_identity_repair_commitment`
- **source**: `src/data/scenario/core_27_identity_repair_commitment/en.json` (dbScenarioId `INCIDENT-03-REPAIR-09`)
- **title**: What Changes Tomorrow
- **axis**: Insight vs Observable Change (axis_primary: Repair)
- **pattern_family**: future_deferral, silent_execution, accountability_system, identity_commitment
- **prompt**: The actor acknowledged contributing to hesitation/bypassing; the meeting is over and no one forces the next step, but the next busy clinical moment will test whether anything changed.
- **action_required**: Convert ownership into one specific repeated behavior that others can observe.
- **mentioned_humans**: self (actor), assistant ("others can observe")
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-3
- **flag_reason**: "A repeated behavior that others can observe" — observable artifact/behavior with a generic ("others") rather than a specific named approver.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

## Catalog B — Separate Lane

Not classified in STAB-07-P0. Reasons:
- Distinct id-space and entry path (loadEliteDataset)
- Launch routing for cohort 20 unconfirmed
- Deferred to STAB-07-P1 or later

If Catalog B contracts are created in production before re-evaluation, the universal QR policy in the 3 patched creation paths applies by default.

---

## Scenarios — Catalog B: Elite dataset (separate entry path; `loadEliteDataset()`)

> These 4 are built at module load (`buildCanonicalEliteDataset`) and exposed via `getEliteScenarioCatalogMetas` (scenario_type `bty_elite`). Different id-space from Catalog A. Chain-3 narrative text is projected from `src/data/bty_chain_workspace/Chains/…`; the title/action shown for the chain-3 are sourced from `bty_elite_scenarios.json` (v1 artifact) where present (closest readable representation) — a next dispatch should confirm the exact runtime-projected text if Commander needs verbatim.

### [28/31] scenario_id: `core_01_training_system`  (chain-elite 1/3)
- **source**: `src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts` (CHAIN_WORKSPACE_ELITE_IDS) → `src/data/bty_chain_workspace/Chains/…`; title/action surfaced from `src/data/bty_elite_scenarios.json`
- **title**: The System Never Trained Them — But We're Blaming Them Anyway
- **axis**: Blame vs. Structural Honesty
- **role**: Regional Director
- **prompt**: Two front-desk staff failed Medicaid eligibility verification three times this week; the office manager wants to write them up. Onboarding was cut from 5 days to 2 due to volume; corporate wants accountability documentation.
- **action_required**: (ko) "Define the cause of the training failure from a system rather than a person perspective and begin a structural-improvement discussion."
- **mentioned_humans**: regional director (actor), front-desk staff, office manager, corporate
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "Begin a discussion" implies others, but the defined action is reflexive (define the cause); no witness step stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [29/31] scenario_id: `core_06_lead_assistant`  (chain-elite 2/3)
- **source**: `chainWorkspaceToEliteScenario.server.ts` → chain workspace; title/action from `bty_elite_scenarios.json`
- **title**: The Lead Who Can't Lead
- **axis**: Empathy Loyalty vs. Structural Authority
- **role**: Clinical Director
- **prompt**: An 8-year (pre-DSO) lead assistant is beloved by legacy staff but resists new protocols; new hires follow her informal lead over written SOPs. No technical policy violation, but she's becoming the real authority.
- **action_required**: (ko) "Reset the lead assistant's role standards and responsibility structure."
- **mentioned_humans**: clinical director (actor), lead assistant, legacy staff, new hires
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "Reset role standards/responsibility structure" affects a named person (lead assistant) but is framed as a structural action; verifier not stated.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [30/31] scenario_id: `core_11_staffing_collapse`  (chain-elite 3/3)
- **source**: `chainWorkspaceToEliteScenario.server.ts` → `src/data/bty_chain_workspace/Chains/Core_11_staffing_collapse/{S1_anchor,S2_consequence,S3_identity}.json`. NOT present in `bty_elite_scenarios.json` v1 by this id.
- **title**: "After the Day Ends" (S3_identity stage title; runtime projection composes S1/S2/S3 — exact served title unconfirmed)
- **axis**: n/a in readable chain stage (not surfaced)
- **role**: Clinic Director (S3 stage)
- **prompt**: ⚠️ PARTIAL — S3_identity pressure is abstract ("The day is over, but its meaning is not."); full multi-stage narrative spans S1_anchor + S2_consequence, not extracted here.
- **action_required**: ⚠️ DATA GAP at this read depth — action is projected by `buildEliteScenarioFromChainWorkspace`, not a flat field; not surfaced.
- **mentioned_humans**: clinic director (actor); others not surfaced at this depth
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-5
- **flag_reason**: Chain-projected multi-stage scenario; readable stage text is abstract and the action is not a flat field — insufficient at this read depth. Recommend a focused chain-projection read if Commander needs to classify this one.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

### [31/31] scenario_id: `OWN-RE-02-R1`  (own_re02_r1)
- **source**: `src/lib/bty/arena/ownRe02R1EliteScenario.server.ts` (`buildOwnRe02R1EliteScenario`, SID = `OWN-RE-02-R1`)
- **title**: 성과 리뷰 왜곡 이슈 (Performance Review Distortion Issue)
- **axis**: Structural Honesty vs. Face-Saving
- **role**: Clinical Director
- **prompt**: (ko) Performance data mis-entered under the prior manager has already reached upper reporting, distorting team evaluations and compensation. The actor didn't create the problem but is now the responsible leader.
- **action_required**: (ko) "Name the distorted performance data with stakeholders and correct the records within what the system allows." (air_logic success: "Name the distortion as a system issue and schedule at least one correction touchpoint.")
- **mentioned_humans**: clinical director (actor), stakeholders, upper management, prior manager, team members
- **current verification (data)**: not specified at scenario level
- **current verification (creation path)**: self_attest + auto_approve:true (all paths)
- **flag**: AMB-2
- **flag_reason**: "Name … with stakeholders" is relational and "correct the records" is an artifact action — spans both; primary action verb is naming-to-stakeholders without a defined approver.

#### Commander classification (BLANK):
- **classification**: [ solo_self_attest | relational_qr_witness | uncertain ]
- **actor**:
- **approver**:
- **notes**:

---

## End of Sheet

Commander classification process:
1. Review each scenario.
2. Apply BTY principles (Actor ≠ Approver; relational action requires the other human's witness for XP; no action → no progression; behavioral validation lives in subsequent choice patterns).
3. Fill the blank `classification`, `actor`, `approver`, `notes` fields.
4. Save the edited sheet.
5. Provide to C3 for hardcoded-subset patch design (the 3 creation paths: `src/lib/bty/action-contract/ensureActionContract.ts:280`, `src/lib/bty/arena/eliteBindingActionCommitment.server.ts:201`, `src/app/api/arena/action-contracts/route.ts:64`).

### Data-surface caveats (for Commander awareness, not classification)
- **5 core data gaps** (no `action_contract.description`): core_07, core_13, core_14, core_15, core_16 (core_16 `action_contract` is `null`). Flags for these rely on choices/pressure only.
- **Schema heterogeneity**: core_10/11/12/18/19/20/21/22 store `pattern_detection` as signal *sentences* (not family codes), use lowercase axis labels, and `difficulty_level: "final_full_density"` (string, not 1–5).
- **Folder ≠ id**: core_19→`core_19_identity_integrity_propagation`, core_20→`core_20_identity_integrity_inheritance`, core_21→`core_21_identity_integrity_correction`, core_22→`core_22_identity_integrity_scaling_pressure`.
- **Catalog B (Elite-4)** uses a separate id-space and entry path; chain-3 text is projected (not flat) — `core_11_staffing_collapse` in particular needs a focused chain-projection read for full classification.
- **No DB-only scenarios**; no Supabase query required for this inventory.
