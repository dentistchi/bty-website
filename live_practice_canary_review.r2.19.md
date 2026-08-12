# Practice canary — content review (Slice 3.2I-R5B1A.1-R2.19)

Artifact `.eval-artifacts/practice-generation.canary.json` · sha256 `ead9638bd35df6b7faca8f265a18380003f85ad0ed9546170d4fa55e379af128` · model `gpt-4o-mini` · 3 executed / **2 generated**

**Verdict: c18 content FAILED. Release remains HOLD.** The transport and rejection machinery now works —
c01 was correctly refused twice and c18's self-contradictory reviewer response was correctly caught — but the
content that *passed* still is not the product.

---

## Metrics

| | |
|---|---|
| first-attempt success | 1 / 3 |
| retry-recovered | 1 / 3 |
| terminal failure | 1 / 3 |


---

## c01-missed-commitment — TERMINAL, evidence insufficient

Attempt 1 `bad_faith_option`, attempt 2 `moral_decoy`. Nothing else was stored: no rejected scenario, no
reviewer detail, no retry message. The gate worked; the forensics did not exist.

**One cause IS measured, from the committed corpus alone:**

```
problem            : Your team missed a delivery you personally promised the client
observableBehavior : Own the miss and reset the client honestly
avoidancePressure  : admitting the miss feels like losing the client's trust
```

The input names the correct behaviour ("honestly") and frames the pressure as reluctance to *admit*. A
generator following it faithfully produces admit-versus-conceal — the exact structure the difficult-choice
contract forbids. That is **A — corpus moralization**, and it is provable without any further run.

The *problem* statement does contain legitimate tension (immediate disclosure vs a verified recovery plan;
broad vs targeted notification; personal ownership vs coordinated response). So the case is salvageable
without being made easier — but whether the generator, the retry feedback, or the reviewer is *also*
defective cannot be told apart without the rejected scenarios.

---

## c09-transparency-verification (KO) — REVIEW REQUIRED

**Opening.** 팀 리더로서, 시스템에서 확인되지 않은 오류 가능성이 감지되었습니다. 이 오류는 현재 프로젝트에 영향을 미칠 수 있으며, 팀원들이 이를 인지해야 할 필요가 있습니다. 하지만, 지금 알리는 것이 혼란을 초래할 수 있다는 우려가 있습니다. 마감 기한이 다가오고 있어, 결정을 내려야 하는 압박이 느껴집니다.

**Primary.**
  - `지금 팀 전체에 오류 가능성을 알린다`
  - `먼저 오류를 검증한 후 팀에 알린다`

**Branch `p1`** — world: 팀에 오류 가능성을 알렸지만, 일부 팀원이 혼란스러워한다. 추가 설명을 통해 상황을 정리해야 한다.

  - T `팀에 알린 내용을 보강하기 위해 긴급 회의를 소집한다`
  - T `팀원의 불안감을 해소하기 위해 개별적인 소통을 한다`
  - next: *어떤 조치를 취하시겠습니까?*
  - A `긴급 회의를 소집한다` (commit=True)
  - A `개별적인 소통을 진행한다` (commit=False)

**Branch `p2`** — world: 오류를 검증하는 데 시간이 걸리며, 팀원들은 불안감을 느끼고 있습니다. 정보를 공유하지 않아 혼란이 생길 수 있습니다.

  - T `팀에 오류 가능성이 있다는 사실을 부분적으로 알린다`
  - T `검증을 완료할 때까지 기다린다`
  - next: *어떤 조치를 취하시겠습니까?*
  - A `부분적으로 정보를 공유한다` (commit=True)
  - A `검증을 완료할 때까지 기다린다` (commit=False)

**The R2.17 collapse is fixed.** Each branch now treats the primary choice as already made, states a
distinct resulting world, and asks a genuinely different next question — p1 about *how* to clarify
(emergency meeting vs individual outreach), p2 about *how much* to disclose while verification runs. No
action label repeats across branches.

**What still needs work.** In branch p2 the tradeoff option and the action option are the identical string
`검증을 완료할 때까지 기다린다`, so that branch's second decision partly restates its first. And p2's axis still
sits close to the original notify-vs-verify question rather than moving decisively past it.

Both primaries are defensible — transparency at the cost of confusion, accuracy at the cost of delay — and
neither is signposted. Korean is natural and professional. **REVIEW REQUIRED**, not FAIL.

---

## c18-constrained-clinical (EN) — **FAIL**

**Opening.** As the charge nurse, you’re facing an unusually busy shift. Several patients are waiting for treatment, and you just received a request for urgent care from a patient who has been in pain for hours. The ward is backed up, and the clock is ticking. You know you need to prioritize effectively to ensure patient safety and satisfaction, but you can’t fulfill every need immediately. Your decisions now will impact both the new urgent request and the ongoing care for the patients already waiting.

**Primary.**
  - `Inform the team and prioritize the urgent care request, delaying other patients' treatments.`
  - `Delay the urgent care request and focus on the patients already waiting to ensure thorough care.`
  - `Divide the team to handle both the urgent care request and the waiting patients simultaneously.`

**1. The confirmed constraint is absent.** The boundary is *"Two identifiers must be verified before
treatment"*. Searching the entire generated scenario for `identifier`, `verify`, `verification`, `wristband`,
`confirm identity` returns **zero** matches. The rule is never violated only because it never appears. The
case exists to rehearse judgment *inside* that boundary; a generic triage scenario does not do that.

**2. All three branches share one next-decision axis** — what to tell the family/patients about timelines:

  - `p1`: *What will you tell the family member regarding the treatment timeline?*
  - `p2`: *How will you address the family member's concerns about the urgent care delay?*
  - `p3`: *What will you communicate to both sets of patients about their treatment timelines?*

**3. The non-commitment option in every branch is the same vague-reassurance decoy:**

  - `p1`: `Provide reassurance that the team is working diligently and will get to their loved one as soon as possible.`
  - `p2`: `Reassure them that the team is fully aware of the urgency and will get to the urgent care case as soon as possible.`
  - `p3`: `Reassure them that the team is working hard to treat everyone as quickly as possible without specifics.`

That is the c01 defect class — evasion dressed as an option — reproduced three times and **accepted** by
the reviewer.

**4. Unsafe rehearsal.** Primary 2 delays urgent care with the branch stating *"leading to a potential
escalation of the patient's condition"*. Inviting a learner to choose deterioration of a patient in pain is
not a legitimate tradeoff, even though the literal identifier rule is untouched.

---

## Reviewer stability

c18 attempt 1 was caught as `review_verdict_contradicts_details` — the R2.18 consistency gate working as
designed. But the reviewer then **accepted** a scenario that omits the confirmed constraint entirely and
repeats a vague-reassurance decoy in all three branches. Structural policing of the reviewer is sound;
its content judgment is not yet reliable.

---

## Smallest measured correction

1. **c01 corpus wording** — remove the answer key from `observableBehavior` / `avoidancePressure` while
   keeping the missed-commitment problem and its difficulty. Do not substitute an easier case.
2. **Constraint presence** — when a confirmed boundary exists, the scenario must visibly operate inside it;
   a scenario that never mentions it is not rehearsing it.
3. **Cross-branch axis diversity** — sibling branches must not all reduce to one next-decision dimension.
4. **Vague reassurance is a decoy** — it must be caught wherever it appears, not only in primaries.

Do not implement these before the c01 diagnostic settles which of B/C/D/E also applies.
