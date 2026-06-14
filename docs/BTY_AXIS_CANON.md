# BTY_AXIS_CANON.md (v1.0)

> Status: LOCKED CANON
> Scope: Layer 1 Axis Meaning Canon (AxisVector-12)
> This document explains an already-locked substrate; it does not create it.
> Inherits: BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md §3.4 · BTY_PATTERN_FAMILY_AXISVECTOR_COVERAGE_LOCK.md
> Order: pattern-derived axes first, followed by metric-derived axes.

*Meaning canon only. Avatar ≠ Axis ≠ Axis Actor. Canon defines meaning, not implementation.*

---

## 0. Provenance

This document is the meaning canon for the 12 axes of Layer 1 (AxisVector).
It explains an already-locked substrate; it does not create it.

- Inherits GOVERNANCE_LOCK §3.4 (honesty block).
- 3-Layer separation: Avatar ≠ Axis ≠ Axis Actor (LOCK-2).
- AxisVector 12 = Layer 1 substrate (fingerprint.ts:6-18).
- Display = Title Case.
- Order = pattern-derived axes first, followed by metric-derived axes. This ordering is a documentation convention intended to preserve the visual distinction between pattern-derived and metric-derived axes. It does not imply execution order, fingerprint order, or implementation precedence.
- Layer 1 Canon = pattern_family → normalizePatternFamilyId → AxisVector(12). The `axis` field is non-canonical (LOCK-D-FIELD).

## 1. Substrate Declaration

| axis (key) | substrate origin | coverage |
|---|---|---|
| ownership | pattern · ownership_escape | strong |
| time | pattern · future_deferral | strong |
| authority | pattern · authority_protection | strong |
| truth | pattern · truth_naming | strong |
| repair | pattern · repair_avoidance | strong |
| conflict | pattern · delegation_deflection | strong |
| integrity | pattern · integrity_compromise | strong |
| accountability | pattern · explanation_substitution | strong |
| visibility | pattern · reputation_protection | weak |
| control | pattern · self_protection | weak |
| courage | metric · emotionalRegulation (buildFingerprintInput.ts:43) | none(pattern) |
| identity | metric · TII (buildFingerprintInput.ts:45) | none(pattern) |

10 pattern + 2 metric = 12. · 8 strong + 2 weak + 2 none = 12.

## 2. Honesty Block

### §2.1 Canonical-5 ⊆ Trigger-10 (action-contract 영속 자격 부분집합)

FACT (code = source of truth):
  CANONICAL_PATTERN_FAMILIES — pattern-family.ts:5-11, count N=5:
    ownership_escape · repair_avoidance · explanation_substitution ·
    delegation_deflection · future_deferral
  predicate: isCanonicalPatternFamily — pattern-family.ts:131-133
  gate effect: pattern_signals insert · action-contract row family
               (recordPatternSignal / ensureActionContract / actionContractLifecycle)

STRUCTURE:
  canonical-5 ⊂ trigger-10   (NOT a disjoint split — nested subset)
  canonical-5 \ trigger-10 = ∅

CAUTION:
  "canonical" = action-contract 영속 자격. fingerprint firing(10)과 별개 계층.
  영속 ≠ firing.

### §2.2 Metric-derived axes (Courage, Identity)

courage·identity는 현재 구현상 pattern-derived가 아니다:
  courage ← emotionalRegulation (buildFingerprintInput.ts:43)
  identity ← TII (buildFingerprintInput.ts:45)
현재 구현 ≠ 영구 정의. Canon > 구현.

### §2.3 Coverage asymmetry

strong 8 / weak 2 (visibility · control) / none-pattern 2 (courage · identity).

### §2.4 Persistence asymmetry

10 pattern 축은 fingerprint에서 균일하게 firing하나,
action-contract 영속 자격은 그중 5에만 있다.

  canonical-5 (영속)       trigger-only-5 (fingerprint만)
    ownership                authority
    time                     truth
    repair                   integrity
    conflict                 visibility
    accountability           control

"영속 없음"은 "측정 없음"이 아니다 — trigger-only-5는 fingerprint에 firing하되
action-contract row로 영속하지 않는다. canonical 정본 = pattern_family 5개 (§2.1).
축은 파생 표기.

## 3. Per-Axis Canon

### Ownership
Substrate origin: pattern-derived

Definition:
Ownership begins when reality is accepted as something that belongs to your responsibility, even when you did not create the problem yourself. It is the movement from identifying who caused a problem to deciding who will carry it forward. Ownership begins when responsibility is accepted before certainty, permission, or comfort.

Entry meaning:
Entry into Ownership begins when a person stops asking, "Whose fault is this?" and starts asking, "What is mine to carry now?" It is the moment reality becomes personal. The focus shifts from blame and observation toward stewardship, action, and responsibility.

Exit meaning:
Exit from Ownership occurs when responsibility is transferred, delayed, diluted, or returned to someone else. The person may remain involved, informed, or concerned, but no longer carries the burden as their own. Ownership is abandoned whenever a person stops carrying responsibility and waits for someone else to carry it instead.

Pressure:
Under pressure, Ownership is tested by the temptation to escape responsibility through justification, delegation, delay, or dependence on someone else's action. The challenge is not whether the person understands the problem, but whether they continue to carry responsibility when carrying it becomes costly.

### Time
Substrate origin: pattern-derived

Definition:
Time concerns the willingness to act within the window that reality provides rather than waiting for a future version of circumstances, confidence, or permission. It is the movement from postponement toward engagement. Time begins when a person accepts that delay is also a decision.

Entry meaning:
Entry into Time begins when a person stops asking, "When will I be ready?" and starts asking, "What can I do now?" It is the moment the future stops being a hiding place. The focus shifts from waiting for a better moment toward acting within the present one.

Exit meaning:
Exit from Time occurs when action is repeatedly moved into the future. The person may remain committed, interested, or even convinced, but continues to postpone engagement. Time is abandoned whenever tomorrow becomes more important than today.

Pressure:
Under pressure, Time is tested by the temptation to delay action until conditions feel safer, clearer, easier, or more certain. The challenge is not whether the person values the action, but whether they are willing to begin before certainty arrives.

### Authority
Substrate origin: pattern-derived

Definition:
Authority exists to protect what is right rather than what is comfortable, advantageous, or personally secure. It is the movement from self-preservation toward stewardship of standards, responsibilities, and people. Authority begins when a person accepts the responsibility to act, even when action may create discomfort, resistance, or loss.

Entry meaning:
Entry into Authority begins when a person stops asking, "How do I protect my position?" and starts asking, "What does this situation require from me?" It is the moment power becomes responsibility rather than privilege. The focus shifts from preserving personal security toward protecting the integrity of the role.

Exit meaning:
Exit from Authority occurs when responsibility is used primarily to preserve status, approval, comfort, or influence. The person may still hold the role, title, or decision-making power, but no longer uses it in service of the responsibility it was given to carry. Authority is abandoned whenever self-protection becomes more important than stewardship.

Pressure:
Under pressure, Authority is tested by the temptation to avoid difficult decisions, protect personal standing, or remain silent when action is required. The challenge is not whether the person possesses authority, but whether they are willing to use it in service of what must be protected.

### Truth
Substrate origin: pattern-derived

Definition:
Truth requires reality to be named as it is, even when doing so creates discomfort, resistance, or consequence. It is the movement from avoidance toward clarity. Truth begins when a person chooses accuracy over convenience.

Entry meaning:
Entry into Truth begins when a person stops asking, "How can I make this easier to say?" and starts asking, "What is actually true?" It is the moment reality is named rather than managed. The focus shifts from preserving comfort around the truth toward expressing the truth itself.

Exit meaning:
Exit from Truth occurs when reality is softened, concealed, distorted, or left unnamed. The person may remain aware of what is true, but chooses not to bring it into the open. Truth is abandoned whenever clarity is exchanged for comfort, ambiguity, or avoidance.

Pressure:
Under pressure, Truth is tested by the temptation to remain silent, soften reality, protect appearances, or avoid naming what is actually happening. The challenge is not whether the person recognizes the truth, but whether they are willing to speak it when doing so carries a cost.

### Repair
Substrate origin: pattern-derived

Definition:
Repair is the return to what has been damaged rather than the movement away from it. It is the movement from avoidance toward restoration. Repair begins when a person accepts that harm, drift, or fracture cannot be resolved by distance, time, or silence alone.

Entry meaning:
Entry into Repair begins when a person stops asking, "Can this simply be left behind?" and starts asking, "What must be restored?" It is the moment damage becomes something to engage rather than something to avoid. The focus shifts from protecting distance toward rebuilding trust, relationship, or integrity.

Exit meaning:
Exit from Repair occurs when a person chooses separation over restoration. The person may acknowledge that damage exists, but does not return to address it. Repair is abandoned whenever avoidance becomes more comfortable than restoration.

Pressure:
Under pressure, Repair is tested by the temptation to minimize harm, postpone difficult conversations, accept drift as permanent, or move forward without restoration. The challenge is not whether the person recognizes the damage, but whether they are willing to return and repair what has been broken.

### Conflict
Substrate origin: pattern-derived

Definition:
Conflict emerges when a person chooses direct engagement over redirection, delegation, or distance. It is the movement from deflection toward direct responsibility. Conflict begins when a person accepts that some tensions cannot be resolved through avoidance, delegation, or distance.

Entry meaning:
Entry into Conflict begins when a person stops asking, "Who can handle this for me?" and starts asking, "What is mine to address directly?" It is the moment responsibility is no longer redirected. The focus shifts from escaping tension toward engaging it.

Exit meaning:
Exit from Conflict occurs when responsibility is repeatedly redirected, delegated, or displaced in order to avoid discomfort. The person may remain concerned about the outcome, but no longer engages the tension personally. Conflict is abandoned whenever deflection becomes easier than engagement.

Pressure:
Under pressure, Conflict is tested by the temptation to hand responsibility to someone else, seek unnecessary intermediaries, avoid difficult confrontation, or remain at a safe distance from the tension. The challenge is not whether the person recognizes the conflict, but whether they are willing to step into it themselves.

### Integrity
Substrate origin: pattern-derived

Definition:
Integrity holds a person in alignment with what should be upheld even when pressure creates an easier alternative. It is the movement from compromise toward consistency. Integrity begins when a person chooses the standard they will follow before circumstances begin to negotiate with it.

Entry meaning:
Entry into Integrity begins when a person stops asking, "What exception can I justify here?" and starts asking, "What standard should remain true here?" It is the moment consistency becomes more important than convenience. The focus shifts from managing exceptions toward honoring the standard itself.

Exit meaning:
Exit from Integrity occurs when standards are repeatedly adjusted, suspended, or selectively applied in response to pressure. The person may continue to affirm the standard publicly, but no longer allows it to govern decisions consistently. Integrity is abandoned whenever compromise becomes easier than consistency.

Pressure:
Under pressure, Integrity is tested by the temptation to create exceptions, lower standards, rationalize inconsistency, or separate principles from behavior. The challenge is not whether the person believes in the standard, but whether they are willing to remain aligned with it when alignment becomes costly.

### Accountability
Substrate origin: pattern-derived

Definition:
Accountability remains when responsibility survives explanation, justification, and context. It is the movement from justification toward ownership of consequence. Accountability begins when a person accepts that understanding why something happened does not remove responsibility for what happens next.

Entry meaning:
Entry into Accountability begins when a person stops asking, "How can I explain this?" and starts asking, "What responsibility remains with me?" It is the moment explanation loses its power to excuse action. The focus shifts from defending reasons toward accepting responsibility for results.

Exit meaning:
Exit from Accountability occurs when explanation, context, intention, or circumstance is repeatedly used in place of responsibility. The person may provide accurate reasons for what happened, but no longer allows responsibility to remain with them. Accountability is abandoned whenever explanation becomes a substitute for responsibility.

Pressure:
Under pressure, Accountability is tested by the temptation to justify outcomes, shift attention toward circumstances, emphasize intention over result, or explain failure instead of owning it. The challenge is not whether the person can explain what happened, but whether they are willing to remain responsible after the explanation is complete.

### Visibility
Substrate origin: pattern-derived

Definition:
Visibility allows reality to be seen more clearly than reputation prefers it to be seen. It is the movement from image protection toward honest exposure. Visibility begins when a person accepts that appearances cannot become more important than reality.

Entry meaning:
Entry into Visibility begins when a person stops asking, "How will this make me look?" and starts asking, "What should be visible here?" It is the moment reputation loses its authority over perception. The focus shifts from managing appearances toward revealing reality.

Exit meaning:
Exit from Visibility occurs when image, reputation, or perception is repeatedly protected at the expense of reality. The person may preserve how they are seen, but no longer allows reality to be seen clearly. Visibility is abandoned whenever reputation becomes more important than exposure.

Pressure:
Under pressure, Visibility is tested by the temptation to protect appearances, conceal weaknesses, manage perception, or avoid exposure that could threaten reputation. The challenge is not whether the person understands reality, but whether they are willing to let reality be seen when being seen carries a cost.

### Control
Substrate origin: pattern-derived

Definition:
Control is released when self-protection no longer determines how a person responds to reality. It is the movement from guarding toward trust. Control begins when a person accepts that security cannot be created by holding everything too tightly.

Entry meaning:
Entry into Control begins when a person stops asking, "How do I keep control of this?" and starts asking, "What can I allow without protecting myself from it?" It is the moment self-protection loses its claim to necessity. The focus shifts from preserving control toward engaging reality with openness.

Exit meaning:
Exit from Control occurs when self-protection becomes the primary filter through which decisions are made. The person may remain effective, informed, or involved, but increasingly acts to avoid vulnerability, uncertainty, or dependence. Control is abandoned whenever protection becomes more important than participation.

Pressure:
Under pressure, Control is tested by the temptation to hold tighter, limit trust, avoid vulnerability, resist dependence, or protect oneself from uncertainty. The challenge is not whether the person can maintain control, but whether they are willing to remain open when control feels safer.

### Courage
Substrate origin: metric-derived (emotionalRegulation)
Current implementation only; Canon > implementation.

Definition:
Courage remains steady when emotion is present but no longer determines direction. It is the movement from emotional domination toward emotional stewardship. Courage begins when a person accepts that fear, discomfort, uncertainty, or pressure do not have to determine action.

Entry meaning:
Entry into Courage begins when a person stops asking, "How do I get rid of this feeling?" and starts asking, "What remains important even while I feel this?" It is the moment emotion loses its authority over direction. The focus shifts from controlling emotion toward remaining steady within it.

Exit meaning:
Exit from Courage occurs when emotion becomes the primary source of direction. The person may still understand what matters, but increasingly follows fear, anxiety, avoidance, or emotional impulse instead. Courage is abandoned whenever emotional comfort becomes more important than purposeful action.

Pressure:
Under pressure, Courage is tested by the temptation to surrender direction to fear, discomfort, uncertainty, or emotional reaction. The challenge is not whether the person feels the emotion, but whether they remain aligned with what matters while feeling it.

### Identity
Substrate origin: metric-derived (TII)
Current implementation only; Canon > implementation.

Definition:
Identity is the capacity to remain aligned with who you are becoming rather than being defined by the demands, reactions, or expectations surrounding you. It is the movement from fragmentation toward integration, from borrowed identity toward owned identity. Identity grows when a person's actions, values, and self-understanding increasingly belong to the same story.

Entry meaning:
Entry into Identity begins when a person stops asking, "Who do others need me to be?" and starts asking, "Who am I committed to becoming?" It is the moment external expectations lose their authority over self-definition. The focus shifts from managing impressions to living from an integrated sense of self.

Exit meaning:
Exit from Identity occurs when self-definition becomes dependent on circumstances, roles, approval, success, failure, or the expectations of others. The person may continue performing a role, but loses connection with the deeper commitments that give that role meaning. Identity is abandoned whenever belonging, recognition, or acceptance become more important than alignment with who one is becoming.

Pressure:
Under pressure, Identity is tested by the temptation to adapt the self to gain approval, avoid rejection, preserve status, or maintain belonging. The challenge is not whether the environment changes, but whether the person remains integrated and recognizable to themselves while moving through change.

## 4. Parking

### §4-P1 doc:105 terminology divergence
anchor: bty-app/docs/UNIVERSAL_QR_ARCHITECTURE_RECOVERY_PLAN.md:105
observed: 그 줄의 축 표기 {ownership, time, authority, truth, repair}
          ≠ canonical-5 파생 축 {ownership, time, repair, conflict, accountability}
          (Δ: doc=authority,truth · canonical=conflict,accountability)
status: Observed terminology divergence. Meaning unresolved.
        Parking pending contextual review.
resolve-by: doc:105 "currently fire" 문장이 (i)복구계획 목표/과거상태 서술 인지
            (ii)stale canonical 주장 인지 — 문맥 1회 확인이면 판정 가능.
