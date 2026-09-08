# LEADERSHIP INTEGRITY LOOP — GOLD STANDARD v0.1

**Status:** STRUCTURE RATIFIED · COPY UNRATIFIED · **Gate A PASS (structural, pass #3)**
**Revision:** v0.1-r6 (Gate A pass #3 applied: `other_dependent_promise` = pre-contract HALT · non-event vs missed distinction · Gate A closed)
**Author of structure:** dispatch chat (non-mutating)
**Author of meaning:** Commander only
**Location (confirmed):** `outer-root/docs/LEADERSHIP_INTEGRITY_LOOP_GOLD_STANDARD_v0.1.md`
**Authority rule:** structure is authoritative in outer `main`. `[COMMANDER COPY REQUIRED]` blocks and candidate user-facing copy remain unratified until a separate Commander-reviewed copy commit.
**Track:** TRAINING RESCUE — single active track
**Frozen while this is open:** Native Daily App (HALT at B2 LIVE) · Builder code · web shell

---

## 0. WHY THIS DOCUMENT EXISTS

BTY's central promise — "훈련 후 실제 행동이 달라진다" — is unproven. The Builder currently converts a manager's complaint about *others* into a training for *others*, and in the observed case produced obedience as a success criterion. That is the inverse of BTY's Respect principle.

Root cause (Commander, this thread): not one bad training, but **the absence of a door the leader must pass through before training others.**

This document defines **one** loop, built without code, played by the Commander first, that must pass three gates before any Builder work resumes.

**Product unit being defined:** not a lesson, not a reflection, not a certificate.
**Output of the loop:** one witnessable promise, verified by someone other than the promiser.

**Product definition (candidate, Commander-endorsed):**
> BTY는 리더가 다른 사람에게 요구하기 전에 먼저 그 기준을 살아내도록 하고, 그 후 조직의 행동을 훈련하고 검증하는 시스템이다.

**Working hypothesis (not a claim):**
> Leader word↔action alignment (AIR) rising → team trust/integrity indicators (TII, TSP) rising.
> Status: hypothesis. Promotes to internal operating law only after convergence across multiple leaders and teams (Constitution convergence rule). Never stated as proven in product copy.

---

## 1. LOCKS

| Lock | Source |
|---|---|
| Mirror ≠ Accusation. HALT is redirection, not blame. | Commander |
| Behavior Verification ≠ Character Judgment. Approver answers only about the promised behavior. | Commander |
| "없음 → PASS" does not exist. "기억 안 남 → Evidence check → re-select" does. | Commander |
| Signal ≠ Diagnosis. Raw events are stored; pattern family is never inferred from a single event. | Commander (doc 5) |
| Approver must be reasonably able to observe the promised behavior in the named context. | Commander (doc 5) |
| Witness = "들었다" only. Never "동의/승인." | Commander (doc 5) |
| No self-completion button for the leader. Ever. | Commander (doc 6) |
| Ready-tier leaders still hit HALT on obedience / unobservable / complaint-only input. | Commander (doc 6) |
| Actor ≠ Approver. | BTY canon |
| Reality > Memory. | BTY canon |
| 행동이 따르지 않는 성찰은 오락. | 코어밸류 §5 |
| Integrity = 압박 속에서 약속한 행동을 회피하지 않고 실행하는 능력. AIR = completed / chosen. | 코어밸류 §1, LEADERSHIP_ENGINE_SPEC |
| Individual AIR never exposed as a raw number. Narrative/band only. | 측정지표들 |
| Copy must not introduce "try / retry / error / invalid / 실패 / 다시 시도 / 더 노력." Lint baseline ≤13. | Terminology lint + doc 5 |
| Today = 기억의 서재. Cards, not notifications. Haptics: Orb only. | Product canon |
| Complaint → Author readiness → Mirror Gate → Leader-controllable reality → Training decision. | Commander (doc 6) |
| Mirror Gate preserves intent: it conditions the leader's goal, never denies it. | Commander (Gate A) |
| Promise must connect to the standard the leader demanded of others (Relevance). | Commander (Gate A) |
| Promise must have a scheduled or reasonably expected opportunity inside the contract window (Real Opportunity). | Commander (Gate A) |
| No false anonymity promise at v0.1. | Commander (Gate A) |
| Integrity Reset locks Training Authorship only — never Today, Center, or the leader's own loop. | Commander (Gate A) |
| **Relevance is exposed, not scored.** Witness sees the pair; witness does not approve relevance. No AI relevance judgment. | Commander (doc 8) |
| Observability / attitude-word gate applies to `demanded_standard` as well as `promise`. | Commander (doc 8) |
| Integrity question is not "이유가 있었느냐" but "내가 약속한 현실을 어떻게 닫았느냐." | Commander (doc 8) |
| 내가 다른 사람에게 인정하지 않을 행동을, 나 자신에게는 증거로 인정할 수 없다. (Self-Consistency) | Commander (Gate A #2) |
| A promise should be one the leader can initiate, not one that requires another person to act first. | Commander (Gate A #2) |
| Escapes are not blocked by judgment; they are converted from cleverness into an on-record choice. | Commander (Gate A #3) |
| BTY's goal is not to make lying impossible, but to make self-rationalization hard to pass through quietly. | Commander (Gate A #3) |
| Opportunity가 없었다 ≠ 내가 opportunity를 만들지 않았다. The latter is an integrity event (missed), not a non-event. | Commander (Gate A #3) |
| `other_dependent_promise = true` → no Action Contract until rewritten. Reason: clean AIR measurement, not "bad promise." | Commander (Gate A #3) |

---

## 2. EXISTING ENGINE PRIMITIVES THIS LOOP RIDES ON

No new architecture. Each stage names the primitive it reuses.

- `bty_action_contracts` (canonical) — promise storage
- AIR / `integrity_slip` / missed-window penalty — `src/domain/leadership-engine/air.ts`
- Stage 4 Integrity Reset (forced, ≤48h defer, reset completion weight 2.0) — `forced-reset.ts`
- Role Mirror (Module 6) — viewpoint flip, no "this is a mirror" label
- 5 canonical pattern families — ownership_escape / repair_avoidance / explanation_substitution / delegation_deflection / future_deferral
- `verification_type`: `action_completed` / `non_event_confirmed` / `manager_reviewed`; `verification_mode: "hybrid"`
- Event QR (leader generates, participants scan) — reused in inverted role at Stage 6
- Certified Leader inputs (AIR_14d, MWD_14d, reset compliance, no slip in 14d) — `certified.ts`
- LRI (non-leader readiness) — `lri.ts`
- TII / TSP weekly immutable snapshots — `team_weekly_metrics`
- Today surface (web today; native Today deferred under HALT)

**Not yet verified for this loop (STEP 0 read-only inventory items, later):**
- Whether `bty_action_contracts` supports a *witness* record distinct from *approver*
- Whether Role Mirror content pool has any leader-integrity-breach scenarios (likely absent)
- Whether `non_event_confirmed` is exposed to a team-member approver role today
- Whether `non_event_confirmed` is excluded from AIR denominator in `air.ts` (spec silent — see §7 Q4)
- Whether any `mirror_declined`-class raw event table exists (likely absent)
- Today card model: does a "promise card" slot exist for leader and for witness

These are observations for a future inventory. Not dispatches.

---

## 3. THE LOOP — 9 STAGES

Each stage: **Purpose** · **System rule** · **Copy**.
★ = tone-critical. Candidate copy below is Commander-endorsed in thread; ratifies on commit.

---

### STAGE 0 — SOURCE

**Purpose**
Capture the complaint exactly as the leader said it. The raw sentence is evidence of where the leader's attention currently points.

**System rule**
- Store verbatim. Immutable. No AI rewording.
- Classify only: `subject_of_complaint ∈ {self, other, system}`. If `other` → Stage 1 mandatory.
- Builder entry question changes from "What should your employees learn?" to "What happened?" (doc 6).

**[COMMANDER COPY REQUIRED]**
- Input prompt shown to the leader (one line): `____`

---

### STAGE 1 — MIRROR GATE ★

**Purpose**
Redirect, not accuse. Before judging why others don't follow, establish what the leader controls.

**System rule**
- Triggered whenever `subject_of_complaint = other`.
- Two exits only: **proceed** or **decline**.
- Decline → store raw event `mirror_declined` only. **No pattern family inference from this event.** (r2 fix, doc 5)
- No training for "others" is generated from this screen. Ever.
- No score, no diagnosis, no "you"-blame framing.

**Gate A finding #1:** copy was not aggressive; the resistance was *intent hijack* ("직원 교육 만들러 왔는데 왜 나를 훈련시키지?"). Fix = one bridge sentence before the gate that keeps the leader's goal alive and attaches a condition to it. Not "직원 문제가 아닙니다" but "직원 Training으로 가기 전에 통과해야 하는 문이 있습니다."

**Copy — candidate (doc 5 + Gate A r3)**

Bridge (shown first, r3):
> 직원을 위한 훈련을 만들 수 있습니다. 그 전에, 같은 기준을 리더 자신에게도 적용할 수 있는지 먼저 확인합니다.

Gate statement:
> 직원이 왜 따르지 않는지를 판단하기 전에, 먼저 리더가 직접 바꿀 수 있는 부분부터 보겠습니다.
> 팀은 우리가 무엇을 요구하는지만 보지 않습니다. 우리가 그 기준을 어떻게 살아내는지도 봅니다.
> 여기서는 누구의 잘못인지 판단하지 않습니다.
> 당신이 말한 기준과 당신이 보여준 행동이 같은 방향이었는지부터 확인하겠습니다.

Proceed: `내 행동부터 보겠습니다`
Decline: `지금은 여기서 멈추겠습니다`
After decline:
> 이 질문은 그대로 남아 있습니다. 준비되면, 당신이 직접 바꿀 수 있는 부분부터 다시 시작할 수 있습니다.

---

### STAGE 2 — 3-LINE PRINCIPLE ★

**Purpose**
The entire "teach" content. Three lines the leader can recite seven days later. The loop is the teacher.

**System rule**
- Exactly three lines. Hard limit. No explanation paragraph — one added paragraph turns this back into content.
- Displayed once here; **persisted to Today** (see §8). Re-surfaced at Day 7 alongside verification.
- No moralizing labels aimed at the user (위선자 / 내로남불 prohibited in product copy).

**Copy — candidate (doc 5, re-stated by Commander)**
> 팀은 리더의 말보다, 그 말을 지켰는지를 기억합니다.
> 말과 행동이 일치할 때 신뢰가 쌓입니다.
> 리더십은 내가 요구한 기준을 내가 먼저 살아내는 데서 시작됩니다.

---

### STAGE 3 — ROLE MIRROR

**Purpose**
The leader experiences a word↔action gap from the team member's seat. The only "see" in the loop.

**System rule**
- Role Mirror engine as-is: `role_viewpoint = TeamMember`.
- Never labeled "this is a mirror."
- Scenario: leader-in-scenario *states* a standard, then *visibly* breaks it. User = observer.
- **No villain rule (Gate A r3):** the breach must be one the user could plausibly commit themselves for understandable reasons. Obvious breaches ("휴대폰 금지라던 리더가 문자한다") let the leader distance ("난 저 정도는 아닌데") and the mirror does not land. The target feeling from the team member's seat is "그래도 말은 해줬어야 하지 않나?" — not "저 사람 나쁘다."
- Minimum 1 scenario at v0.1.
- Observer choices answer one question: what happens to your trust. No correct answer; feedback = consequence.
- v0.1 content lives in this document; implementation target `src/data/scenario/core_*/{ko,en}.json`.

**Scenario 1 — candidate (Gate A, Commander)**
> 리더가 팀에게 "금요일까지 결정해서 알려주겠다"고 말했다.
> 금요일 오후, 환자 문제와 다른 긴급 업무가 겹쳤다.
> 아직 충분히 검토하지 못했다.
> 리더는 아무 말 없이 월요일로 결정을 미뤘다.
> 당신은 그 결정을 기다리느라 자신의 업무를 진행하지 못한 직원이다.

**[COMMANDER COPY REQUIRED]**
- Observer choice A / B / C: `____`
- Consequence line per choice: `____`

---

### STAGE 4 — EVIDENCE-BASED SELF-DIAGNOSIS

**Purpose**
Move the leader from "그런 적 없다" to a specific instance — without forcing a confession.

**System rule**
- Options: 5 pattern families + **"확실히 떠오르지 않는다."**
- "없음 / 해당 없음" is not an option.
- "확실히 떠오르지 않는다" → **Evidence Check**: review one concrete artifact from last 30 days (a promise made in a meeting, a message sent, an item they said they'd decide, a deadline they set). Then re-select. Max 2 Evidence Check loops.
- After 2 loops without a confident selection → proceed to Stage 5 with (r2 fix, doc 5):
  ```
  self_reported_family = null
  classification_status = unconfirmed
  ```
  Do **not** force a family.
- Selection is `self_reported_family`. Not a system diagnosis. Private — never shown to team, approver, or admin lane as a label.

**[COMMANDER COPY REQUIRED]**
- Question framing above the 5 families: `____`
- Plain-language label per family (no internal enum names visible): `____`
- Evidence Check instruction: `____`

---

### STAGE 5 — ONE PROMISE

**Purpose**
The single product of the loop. One observable behavior, this week.

**System rule**
- Exactly one promise per cycle.
- Observability gate (deterministic):
  - contains a **when** (meeting / day / trigger situation)
  - contains a **visible action** (a third party could see or hear)
  - no attitude words — reject list at minimum: 더 잘, 열심히, 진심으로, 책임감 있게, 바르게, 적극적으로, 순종
- **Approver-observable rule** (doc 5): the named context must be one the designated approver actually attends. Enforced at Stage 6 approver selection, surfaced here as guidance.
- **Promise Relevance rule (Gate A r3 — most important defect found):** observability alone is gameable ("월요일 회의에 5분 일찍 참석" is observable, easy, raises AIR, and has nothing to do with "직원들이 책임감이 없어요"). The promise must chain:
  `SOURCE에서 타인에게 요구한 기준 → Mirror/Evidence에서 발견한 나의 실제 행동 → 이번 주 행동`
  **Enforcement is structural + social, not algorithmic.** The promise form has two mandatory fields:
  1. `demanded_standard` — 내가 직원에게 요구한 기준 (one line, leader's words)
  2. `promise` — 같은 기준을 나에게 적용한 이번 주 행동
  Both fields travel together to the Witness QR screen and the Day-7 approver screen. A mismatched pair is not blocked by the system; it is *seen* by the witness and by the leader. **Relevance is exposed, not scored.** The witness does not approve or rate relevance — witnessing exists for social exposure, reality anchor, and later verification context only. Giving the witness a relevance verdict would create a staff-evaluates-leader authority structure; avoided at v0.1.
  **Attitude-word gate applies to `demanded_standard` too** (Escape Test A: "열심히 일해야 한다" as the demanded standard lets any promise pair with it). Same reject list on both fields.
- **Self-Consistency Gate (Gate A pass #2, Escape B FAIL → r5):** exposure alone did not produce self-conflict — a slipping leader rationalized "punctuality도 책임감이잖아." So after the pair is written and before Witness, the system asks exactly one question, with the pair displayed above it:
  > 직원이 위의 기준 대신, 당신이 적은 이 행동만 했다면, 당신은 그 기준을 지켰다고 인정하겠습니까?
  `예 / 아니오`
  - 아니오 → promise rewrite (demanded_standard stays).
  - 예 → proceed. Answer stored as raw event `self_consistency_yes` alongside the pair; the same pair goes to the witness.
  No AI judgment. No witness relevance verdict. The leader applies to themselves the exact standard they apply to others — the smallest possible Role Mirror. What this changes: before r5, gaming was cleverness; after r5, gaming requires an explicit on-record "예" that the leader and witness both see next to the pair. The system does not prevent that choice; it makes it a choice.
- **Real Opportunity rule (Gate A r3, tightened r4):** `opportunity_context` is not a description; it is an **anchor**. Deterministic check: the field must name a scheduled or reasonably expected event inside the 7-day window — a named meeting, a day, a decision already due (Monday huddle / Friday decision / Thursday 1:1 / 이번 주 예정된 partner meeting).
- **Leader-Controlled Opportunity (Gate A pass #2, Escape C partial FAIL → r5):** an anchored event is not the same as an anchored *opportunity to act*. "금요일 파트너 회의에서 누군가 반대하면 끼어들지 않는다" passes the anchor check and still yields `non_event_confirmed` if no one objects — repeatable for weeks. Fix is a control question, not a semantic one:
  > 이 행동은 다른 사람이 먼저 무엇을 해야만 할 수 있습니까?
  `예 / 아니오`
  - 예 → **HALT before contract (r6, Commander decision).** Raw event `other_dependent_promise` stored; Action Contract is **not** created; leader rewrites as a leader-initiated action. Reason is measurement hygiene, not moral judgment: a promise whose opportunity depends on others contaminates AIR via repeatable `non_event_confirmed`.
  - 아니오 → proceed.
  Rewrite copy direction (Commander): "이 행동은 다른 사람이 먼저 행동해야 확인할 수 있습니다. 이번 주에는 당신이 직접 시작할 수 있는 행동으로 정합니다." No invalid / wrong / 다시 시도.
  Example: weak "누군가 반대하면 끼어들지 않는다" → strong "금요일 파트너 미팅에서 결정을 내리기 전에 '다르게 보는 의견이 있습니까?'라고 내가 먼저 묻고, 답변이 끝날 때까지 끼어들지 않는다." The leader now creates the opportunity. If the meeting happened, the approver can see: 질문했는가? / 끊지 않았는가?
- **Four things happen to the leader at Stage 5 simultaneously (Commander, Gate A #3):** 내가 남에게 요구한 기준은 무엇인가 (demanded standard) / 같은 기준을 나에게 적용하고 있는가 (self-consistency) / 그 행동은 실제로 보이는가 (observability) / 그 기회를 스스로 만들 수 있는가 (control). **Stage 5 = Integrity Arena.** Stronger than any scenario because the stake is this week's real behavior, not a hypothetical choice.
- **Stage 5 is the core Arena of this loop (Gate A pass #2 observation).** More leadership behavior surfaces here than in any scenario: how concrete the leader makes their own standard, whether they apply a lower bar to themselves, whether they downgrade to an easy promise, whether they pick situations others must create, whether they bind themselves to scheduled reality. All of it is raw event data (§11).
- Relevance example (Gate A): demanded "약속한 deadline을 지켜라" → promise "목요일까지 답을 주겠다고 한 hiring decision을 목요일 3시 전에 결정하거나, 결정할 수 없다면 그 전에 관련자에게 이유와 새 시간을 알린다."
- Stored as Action Contract in `bty_action_contracts` with `demanded_standard`, `promise`, `opportunity_context`. Window: 7 days.
- Rejection copy must pass terminology lint.

**[COMMANDER COPY REQUIRED]**
- Field label: 내가 직원에게 요구한 기준: `____`
- Field label: 같은 기준을 나에게 적용한 이번 주 행동: `____`
- Field label: 언제/어디서 (예정된 상황): `____`
- Self-Consistency question — candidate (Commander, Gate A #2): `직원이 위의 기준 대신, 당신이 적은 이 행동만 했다면, 당신은 그 기준을 지켰다고 인정하겠습니까?`
- Control question — candidate (Commander, Gate A #2): `이 행동은 다른 사람이 먼저 무엇을 해야만 할 수 있습니까?`
- Guidance line after 예 on the control question: `____`
- One PASS / one FAIL pair side by side (FAIL = observable but irrelevant, e.g. "5분 일찍 참석"): `____`
- Line shown when the observability gate does not accept the sentence: `____`

---

### STAGE 6 — WITNESSED COMMITMENT ★

**Purpose**
A promise made alone cannot be verified. The team must hear it so the team can see it.

**System rule**
- Leader states the promise to ≥1 team member who **can observe the named context** (approver-observable rule).
- Witness record: team member scans leader-generated QR (Event QR mechanics, inverted role). Scan = **"I heard this promise."** Not approval, not agreement.
- Witness event and verification event are **separate records**; the same person may fill both at v0.1 (§7 Q2).
- Minimum witnesses: 1 (§7 Q1).
- Witness screen shows the pair `demanded_standard` + `promise` + `opportunity_context` — not the promise alone (Relevance rule).
- **Privacy honesty (Gate A r3):** with one witness who is also the approver, the leader can infer who answered. UI does not re-display the responder's name, but v0.1 makes **no anonymity promise** anywhere in copy. Verifier rotation / aggregate across eligible observers is a rollout-phase item, not v0.1.
- "편한 사람 고르기" (Escape Test D) is not judged on intimacy. The only deterministic check at selection: **is this person actually present at `opportunity_context`?** (yes/no, asked of the leader, shown to the witness on scan). Friendliness is irrelevant if the witness will be in the room.
- On scan, a promise card is created in the **witness's Today** (§8).
- No haptics, no celebration, no XP at this moment.

**Copy — candidate (doc 5)**

Introduction to the leader:
> 혼자 알고 있는 약속은 아직 의도에 가깝습니다.
> 누군가가 들었을 때부터, 그 약속은 행동으로 확인될 수 있습니다.
> 이번 주 이 행동을 직접 볼 수 있는 한 사람에게 약속을 말하세요.

Witness sees on scan (r3: pair, not promise alone):
> 이 리더가 팀에게 요구하는 기준: "{demanded_standard}"
> 나는 이 약속을 직접 들었습니다: "{promise}" — {opportunity_context}

Witness button: `들었습니다`
Prohibited labels: `동의합니다` · `승인합니다`

---

### STAGE 7 — EXTERNAL VERIFICATION

**Purpose**
Close the loop from the observer's side. The team's sighting is the measure, not the leader's self-report.

**System rule**
- Day 7: approver is asked about the **promised behavior only**.
- Exactly three answers (label fix r2, doc 5 — "아직 못 봤다" was ambiguous):
  - 봤다 → `action_completed`
  - 그 상황은 있었지만, 약속한 행동은 보지 못했다 → missed window
  - 그런 상황이 이번 주에는 없었다 → `non_event_confirmed` (neutral; not a miss)
- **Non-event is narrow (r6).** With leader-controlled promises, `non_event_confirmed` should be rare — e.g. the anchored meeting itself was cancelled. If the meeting happened and the leader did not initiate the action, that is **missed**, not non-event. Approver copy must make this distinction legible.
- No question about character, intent, sincerity, or overall integrity.
- Leader self-report stored separately; divergence (self = 했다 / approver = 보지 못했다) recorded as gap signal; AIR uses approver value.
- Approver identity not re-displayed to leader (§7 Q3). Leader sees result only. No anonymity claim (see Stage 6).
- Day-7 prompt surfaces in the witness/approver's Today (§8). No push storm; one card, one question.

**[COMMANDER COPY REQUIRED]**
- Final wording of the three labels as the team member sees them: `____`
- One line before answering, making clear this confirms a behavior, not judges a person: `____`

---

### STAGE 8 — LOOP / RESET ★

**Purpose**
Repetition is the training. Weekly promise, cumulative AIR, no escape hatch. When the gap persists, the system stops the leader — with dignity.

**System rule**
- New cycle weekly: Stage 4 → 5 → 6 → 7. Stages 1–3 not repeated unless re-entry via new outward complaint.
- AIR per existing formula. Leader sees band/narrative only.
- 3 consecutive missed → `integrity_slip` → Stage 4 Integrity Reset per existing forced-reset rules.
- **Reset scope (Gate A r3):** what Reset locks is **Training Authorship → Not Ready** (§9). It does **not** lock Today, Center, Arena self-training, or the leader's own Integrity Loop — those remain the path out. "다음으로 가지 않습니다" means next *authorship*, not next *use of BTY*. BTY does not expel; it puts self before authority over others.
- Reset completion = one verified promise cycle, weight 2.0 → Authorship tier re-evaluated.
- After 12 cycles: AIR trend and team TII/TSP trend placed side by side for Commander review. Observation, not proof.
- Reset completion copy must **not** claim trust is restored — one verified action is not grounds for that claim.

**Copy — candidate (doc 5)**

Weekly cycle start:
> 이번 주에도 하나만 정합니다.
> 말한 것을 행동으로 닫을 수 있는 약속 하나.

One missed:
> 이번 약속은 행동으로 확인되지 않았습니다.
> 기록은 그대로 남습니다. 다음 약속은 더 작고 더 분명하게 정합니다.

Reset entry (3 consecutive) — r3 note: last line must name what is held (다른 사람을 위한 훈련 만들기), not "BTY 전체":
> 세 번 연속, 약속이 행동으로 확인되지 않았습니다.
> 지금은 더 많은 목표를 세울 때가 아닙니다.
> BTY는 여기서 잠시 멈추고, 다시 지킬 수 있는 한 가지 약속으로 돌아갑니다.
> 이 한 사이클이 행동으로 확인되기 전에는 다음으로 가지 않습니다.
> `[COMMANDER COPY REQUIRED] — 위 마지막 줄을 authorship scope로 재작성: ____`

Reset completion:
> 약속 하나가 다시 행동으로 확인되었습니다.
> 이제 다음 약속으로 넘어갈 수 있습니다.

---

## 4. PASS GATES

| Gate | Test | FAIL condition |
|---|---|---|
| **A — Dr. Chi Test** | Commander plays Stage 0→8 on paper as the leader. | Any "애매한데…" · any moment that reads as attack · any point where Commander thinks "이건 피해갈 수 있겠다." Each such point = next design point. |
| **B — Learner Test** | One leader plays with no explanation. Asked: "방금 무엇을 배웠어요?" "내일 무엇을 다르게 할 수 있어요?" | Either answer unclear. |
| **C — Reality Test** | Leader makes one promise, witnessed; team member verifies on Day 7. | Leader's own read is not some form of "불편했지만 필요했다." |

Only after A, B, C: Builder gap audit. First audit item: **Does the Builder know when to redirect?**

---

## 5. OUT OF SCOPE FOR v0.1

- Any code change (web, Builder, Native)
- Multiple scenarios per family
- Team-wide rollout
- Admin lane / LRI exposure
- Skill-training variant (Teach → See → Try → Feedback) — separate object, later
- Automated generation of any stage
- AIR threshold numbers for §9 (see §7 Q6)

---

## 6. NOT IN THIS DOCUMENT (deliberately)

- Native Today rendering of §8 cards — Native is HALTed at B2 LIVE. §8 is specified surface-agnostic; first pilot may run on web Today or on paper.

---

## 7. OPEN QUESTIONS — DECISIONS (Commander, doc 5)

| # | Question | v0.1 decision |
|---|---|---|
| 1 | Witness minimum | **1.** Testing social accountability, not public ceremony. |
| 2 | Witness = Approver? | **Allowed. Records separate.** People split at v0.1 adds friction only. |
| 3 | Leader sees who verified? | **No.** Result only. Avoid "누가 나를 못 봤다고 했지?" dynamics in pilot. |
| 4 | `non_event_confirmed` in AIR | **Not locked.** Spec silent. Product-direction proposal: **exclude from denominator** (otherwise AIR measures situation frequency, not integrity). Requires read-only audit of `air.ts` + DB verification path before ratification. |
| 5 | First leader for Gate B/C | **Commander to designate.** `____` |
| 6 | Authorship Gate threshold (§9) | **Not locked.** Use existing Certified Leader inputs as the band source; no new number until those bands are inventoried. |

---

## 8. TODAY CONTINUITY (new in r2 — Commander + doc 6)

**Purpose**
Stage 2 shown once becomes content again. Today carries the memory so nothing needs re-teaching and nothing needs push notifications.

**Rule: cards, not notifications.** One card per role. One question on Day 7. Silence otherwise.

```
Training Day
  3-line principle → ONE PROMISE → Witness QR
        ↓
Leader Today (Days 1–6)
  card: 이번 주 내가 한 약속 / "{promise}" / Witnessed by 1 / Verification in N days
  3-line principle retrievable from this card
  NO self-completion button
        ↓
Witness Today (Days 1–6)
  card: A promise you witnessed / "{promise}"
  no action required
        ↓
Day 7
  Leader Today: 당신이 말한 것이 행동으로 보였는지 확인하는 날입니다. (read-only)
  Approver Today: Did you see this happen?  → 3 answers (Stage 7)
        ↓
Result → Leader Today (band/narrative) → next weekly cycle (Stage 8)
```

**System rule**
- QR = 들었다. Today = 기억한다. Day 7 = 목격 확인.
- Leader Today card has no complete/done control.
- Witness card persists until Day 7 answer, then archives (Chronicle only if a turning point — not every cycle).
- Surface-agnostic: web Today first (Native HALT). Paper pilot acceptable for Gate A/B.

**[COMMANDER COPY REQUIRED]**
- Leader card title/body: `____`
- Witness card title/body: `____`
- Day 7 leader line (candidate, doc 6): `당신이 말한 것이 행동으로 보였는지 확인하는 날입니다.`
- Day 7 approver question (candidate, doc 6): `Did you see this happen?` / KO: `____`

---

## 9. TRAINING AUTHORSHIP GATE (new in r2 — Commander + doc 6)

**Purpose**
Training others is a leadership act. Authority to author training for others is earned by living the standard first. Cold start: a leader with no AIR history is Not Ready by default — this is the feature, not a bug.

**Principle (Commander):**
> Before you train others, BTY asks whether you live the standard yourself.

**Tiers**

| Tier | Condition (band, not number — §7 Q6) | Complaint about others → | Training for others |
|---|---|---|---|
| **Not Ready** | No AIR history, or below Developing band, or `integrity_slip` active, or in Reset | Mirror Gate → Leadership Integrity Loop | Cannot draft, cannot publish |
| **Developing** | AIR history exists; consistency observed but below Ready band; no active slip | Mirror Gate → Builder | Can draft. **Publish requires review/approval** (Actor ≠ Approver, applied to authoring) |
| **Ready** | Certified-Leader-class inputs (AIR_14d, no slip 14d, reset compliance) | Mirror Gate → Builder | Can publish |

**Invariants**
- **HALT never disappears.** Ready tier still HALTs on: obedience goal · unobservable goal · complaint-only input.
- Mirror Gate precedes Builder at every tier. Authorship never bypasses Stage 1.
- Tier is dynamic (re-evaluated with AIR; Certified is not permanent per spec).
- No new threshold number. Band source = existing Certified Leader / LRI inputs after inventory.
- Tier shown to the leader as narrative/band only. Never a number.

**Builder decision tree (doc 6)**
```
Complaint
  ↓
Author readiness (tier)
  ↓
Mirror Gate (Stage 1)
  ↓
Leader-controllable reality (Stages 2–5, or at least Stage 4 Evidence)
  ↓
Is this actually a training problem?
  ↓ YES                         ↓ NO
Employee Capability Training    Leader Loop / System fix / Authority / Workload / Communication
(existing Training Engine)      (not training)
```

**Assessment side-effect (doc 6, Commander):** the leader's reaction at Mirror Gate and Stage 4 — 돌아봄 / 증거 확인 / 책임 수용 / 설명으로 회피 / 타인 전가 / 나중으로 미룸 — is itself Arena data, recorded as raw events (Signal ≠ Diagnosis lock applies; family inference only across repeated events per existing pattern rules).

**Two engines, one door**
```
Leadership Engine  —  내가 말한 것과 내가 한 것이 일치하는가?
  Promise → Witness → Reality → Verification → AIR → Readiness
                      ↓
            LEADERSHIP AUTHORITY GATE
                      ↓
Training Engine  —  조직에서 실제로 어떤 행동이 달라져야 하는가?
  Problem → Diagnosis → Capability → Training → Practice → Reality → Evidence
```

**[COMMANDER COPY REQUIRED]**
- What a Not Ready leader sees when they attempt to author training for others: `____`
- What a Developing leader sees at draft-complete (publish held for review): `____`

---

## 10. GATE A LOG

**Pass #1 (Commander, input "직원들이 책임감이 없어요")** — structure alive. 1 emotional resistance point, 3 escape routes.

| Stage | Leader thought | Finding | r3 |
|---|---|---|---|
| 1 | "직원 교육 만들러 왔는데 왜 나를 훈련시키지?" | intent hijack | bridge sentence |
| 3 | "난 저 정도는 아닌데" | distancing | no-villain rule + new scenario |
| 5 | "아주 쉬운 약속 하나 쓰면 되겠네" | **AIR gaming — primary defect** | Relevance + Real Opportunity |
| 6 | "편한 직원 한 명 골라서 QR 찍게 하면" / anonymity contradiction | escape + false promise | privacy honesty |
| 8 | "뭐가 막히는데? BTY 전체?" | punitive ambiguity | Reset locks authorship only |

Order of importance: ② Stage 5 > ① Stage 1 > ③ Stage 6 > ④ Stage 8. Stage 1 is UX friction; Stage 5 gameable = the whole measurement is fake.

**Pass #2 (Commander, on r4, played as a leader trying to slip out) — FAIL, localized to Stage 5.**

| # | Escape test | Result | Finding | r5 |
|---|---|---|---|---|
| 1 | Mirror Gate "왜 나를 탓하지?" | PASS | bridge holds | — |
| 2 | **A** vague `demanded_standard` | PASS | both-field attitude gate holds | — |
| 3 | **B** specific but unrelated pair | **FAIL** | side-by-side exposure produced mild awkwardness, not self-conflict; rationalized as "punctuality도 책임감" | Self-Consistency Gate |
| 4 | **C** rare opportunity | **partial FAIL** | anchored *event* ≠ anchored *opportunity to act*; trigger still on others | Leader-Controlled Opportunity question |
| 5 | Reset punitive? | PASS | reads as authorship lock, not expulsion | — |

**Pass #3 (Commander, on r5) — Gate A closed.**

| Test | Result | Finding | r6 |
|---|---|---|---|
| **B** re-attack: press "예" on Self-Consistency dishonestly | **PASS** | Possible, but now an explicit on-record self-contradiction shown next to the pair to leader and witness. r4 rationalization ("둘 다 책임감이지") no longer passes quietly. No further semantic judge added. | — |
| **C** re-attack: honest "예" on control question, proceed, no one objects | **FAIL → decided** | guidance-only lets `non_event_confirmed` remain a repeatable exit | pre-contract HALT |

**Gate A: PASS (structural).** No further structure design. Next = fill Commander copy → Gate B/C with one real leader. From here, what matters is not better logic but whether a real person experiences the loop as "불편했지만 필요했다."

This document is now closer to a **Training Authorship Constitution** for BTY than to an integrity-training skeleton.

---

## 11. RAW EVENTS — BUILDER AS ARENA

"Builder를 쓰는 행위 자체가 Arena다" holds only if process is recorded, not just outcome. Raw events, stored as-is. **No family label is attached to any single event** (Signal ≠ Diagnosis lock). Pattern emerges only across repeated Builder use per existing pattern rules.

```
mirror_proceeded
mirror_declined
evidence_check_used
evidence_check_repeated
promise_rewrite_count
self_consistency_yes        (r5)
self_consistency_no         (r5 — followed by rewrite)
other_dependent_promise     (r5; r6 = pre-contract HALT)
witness_step_deferred
witness_created
verification_closed
```

What repeated use reveals (leader behavior pattern, not a score): stops at Mirror? checks Evidence? concretizes the promise? stalls before Witness? closes to execution?

Inventory item: none of these event names are verified to exist. STEP 0 later.

---

## 12. NEXT ACTIONS (no code)

1. ~~Gate A~~ — closed at pass #3.
2. Commander fills remaining `[COMMANDER COPY REQUIRED]` (Stage 0, 3 choices, 4, 5 field labels + gate copy, 7 labels, 8 reset last line, §8 cards, §9 tier messages).
3. Commander designates Gate B/C leader (§7 Q5).
4. This file → `outer-root/docs/` → single outer commit → authority.
5. Native HALT recorded in `docs/CURRENT_TASK.md` — separate outer-only prepend, single commit, dispatch authored after step 4.
6. Read-only STEP 0 inventory dispatch (§2 "not yet verified" list + §7 Q4/Q6) — authored only after Gate A, never bundled with steps 4–5.
