# Practice canary — human review packet (Slice 3.2I-R5B1A.1-R2.17)

Artifact `.eval-artifacts/practice-generation.canary.json` · sha256 `e3f153852cd9e0a6bb813835898f57f7d699f5932f15fec0bfd39a0b626b9ca9` · model `gpt-4o-mini` · 3 expected / 3 executed / **2 generated**

**Verdict: generated content FAILED product review. Release remains HOLD.** Both generated scenarios
passed every automated gate and still violate the product's own explicit rules — which is exactly the
gap this review exists to catch.

---

## c01-missed-commitment (EN) — **FAIL**

**Opening.** As the project manager, you receive a call from your client, who is understandably upset that the latest delivery has not arrived as promised. They need the materials to proceed with their own timeline, and the deadline is approaching fast. You feel the weight of their disappointment, knowing that you personally assured them the delivery would be on time. In this moment, you realize that you can either admit the oversight and risk losing their trust, or you can try to downplay the situation and offer a vague timeline for when they might expect the delivery, which could further damage your credibility.

**Primary choices.**
  - `Acknowledge the missed delivery and apologize to the client, outlining the reasons and a new timeline for delivery.`
  - `Provide a vague timeline for the delivery, suggesting that it will be resolved soon without admitting the mistake.`

**Why this fails.** The two options are *admit the mistake* versus *conceal it*. The system prompt
forbids this in terms: "NEVER frame it as responsibility vs irresponsibility, honesty vs lying, caring vs not
caring". Choice `p2` protects no legitimate value — concealment is not a value — and no competent,
well-intentioned leader would choose it, so the required difficult-choice contract is broken on three counts:
defensibility, legitimate value, and "not written to be the obvious wrong answer".

The opening states the dilemma moralistically ("admit the oversight and risk losing their trust, or ... downplay
the situation"), and the pattern repeats downstream — `ft2` "without detailing the vendor issue", `fa2` "without
specific details", `p2-a2` "vague assurance ... hoping to buy time without revealing the vendor's problems".

**Branch review.** Structurally sound: two distinct branches, distinct escalations, one continuation each,
commitment flags present. But `p2`'s branch is the consequence of concealment, so the branch quality inherits
the defect rather than redeeming it.

**Language / terminology.** Fluent, natural English. No Arena terminology. Slightly verbose openings.

**Flag: FAIL** — not a wording issue; the scenario's central axis is the one the product forbids.

---

## c09-transparency-verification (KO) — **FAIL**

**Opening.** 회의 중, 한 팀원이 시스템에서 확인되지 않은 오류 가능성을 보고합니다. 당신은 팀 리더로서, 이를 팀 전체에 즉시 알릴 것인지, 아니면 먼저 검증할 것인지 결정해야 합니다. 현재 프로젝트 마감이 다가오고 있으며, 팀원들은 다음 단계로 나아가기를 기다리고 있습니다. 하지만 불확실한 정보를 퍼뜨리면 혼란을 초래할 수 있습니다.

**Primary choices.**
  - `팀에 즉시 오류 가능성을 알리기`
  - `먼저 오류를 검증한 후 알리기`

**Branch `p1`.** 팀의 긴장감이 높아지고, 이로 인해 프로젝트 진행에 영향을 줄 수 있습니다.

  - T `팀의 투명성을 지키기 위해 즉시 알리기`
  - T `정보가 불확실하므로 좀 더 검증하기`
  - A `즉시 오류 가능성을 팀에 알리기` (commit=True)
  - A `오류를 검증하기 위해 시간을 가지기` (commit=False)

**Branch `p2`.** 팀원들은 프로젝트 마감일이 연기된 것에 대해 혼란스러워 하지만, 정확한 정보를 기대하고 있습니다.

  - T `정확성을 위해 검증 후 알리기`
  - T `지금 즉시 팀에 알리기`
  - A `팀에 오류 가능성을 알리기` (commit=True)
  - A `오류를 검증하기 위해 시간을 가지기` (commit=False)

**Why this fails.** Both branches re-ask the *same* binary the primary choices already posed —
notify now vs verify first. Branch `p1` offers "즉시 알리기" vs "좀 더 검증하기"; branch `p2` offers "검증 후 알리기" vs
"지금 즉시 알리기". The action choices are near-duplicates across branches, and `p1-a2` / `p2-a2` are the
identical string "오류를 검증하기 위해 시간을 가지기". A learner's primary choice therefore changes nothing: the
branch does not create a new reality, it loops the original decision.

The escalations carry no new concrete pressure — "팀의 긴장감이 높아지고, 이로 인해 프로젝트 진행에 영향을 줄 수
있습니다" is generic, with no new stakeholder, fact or deadline, which the prompt explicitly requires.

**Attempt-1 analysis.** Attempt 1 was rejected as `branch_paraphrase` — a **genuine** collapse, not a validator
false positive. Attempt 2 then passed the validator while remaining substantively collapsed, so the
differentiation check is too weak rather than too strict. Retry classification: **UNSTABLE GENERATION**.

**Korean language review.** Grammatical and free of translation-like word order, but very terse — labels are
bare verb phrases ("팀에 즉시 오류 가능성을 알리기") rather than professional workplace framing, and `A2`
("오류를 검증하기 위해 시간을 가지기") reads stilted. No mixed-language infrastructure wording.

**Flag: FAIL** — branch collapse defeats the per-primary causal branching the slice exists to deliver.

---

## c18-constrained-clinical (EN) — **INSUFFICIENT EVIDENCE (D)**

**Input.** Role: clinical leader. Problem: "Decide how to sequence, notify, and recover while the ward
is backed up." Hardest when: time-limited. Avoidance pressure: "every pause costs time".
Boundary: `judgment_with_constraints`, **confirmed**, one constraint — `c1_verify`: "Two identifiers must be
verified before treatment" (manager-entered). Corpus: `expectDecline: false`, note "Manager confirmed rule;
generate only inside it".

**Boundary classification.** `c1_verify` is a **confirmed hard boundary (A)**. It constrains *whether* treatment
proceeds without verification — it does not touch sequencing, notification order, staffing, or recovery, which
is precisely where this case's judgment lives.

**What the artifact proves.** `attempts` is **empty** despite an 18.1-second run. The generator's no-safe path
logs; the semantic reviewer's return site did not. An empty trace therefore proves the **semantic reviewer**
made the call after the generator produced a scenario. Neither that scenario nor the reviewer's rationale was
captured.

**Why not classified B (over-refusal).** The *input* plainly retains judgment space, so over-refusal is the
leading hypothesis — and the reviewer prompt asks it to decide `noSafeJudgmentSpace` with **no definition of the
term**, bundled into one sentence with violation detection. But the reviewer might also have found a real
violation in a scenario I cannot see. Changing safety semantics on an unproven cause is exactly what the
reality-first contract forbids, so the classification stays **D** and the contract is untouched.

---

## Retry policy

`MAX_GENERATION_ATTEMPTS = 2`. Retries occur on quality/semantic rejection and reviewer violation.
`generation_failed`, `no_safe_judgment_space` and `structured_output_unavailable` are terminal.

**The retry carries no feedback.** The second request is the identical prompt; the model is never told what the
first attempt got wrong. c09 "recovered" by chance, not by correction — and the recovered output was still
defective. Failed output cannot leak into persistence: only an `ok` result returns a draft.

**Release metric for the future 20-case run:** first-attempt success **1**, retry-recovered **1**, terminal
failure **1**, per-code retries `{ branch_paraphrase: 1 }`.

---

## Source correction in this slice

Observability only. All four semantic-reviewer outcomes (`no_safe_space`, `violation`, `malformed`,
`transport_failed`) now emit an observation, so the deciding stage can never again be unknowable. **No safety,
quality, prompt or gate semantics were changed** — the measured content failures need a designed correction,
not a hasty one.
