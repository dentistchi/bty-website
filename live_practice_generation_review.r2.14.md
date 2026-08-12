# Live Practice generation — review packet (Slice 3.2I-R5B1A.1-R2.14)

**Result: NO GENERATION EVIDENCE OBTAINED.** All 20 committed synthetic cases were executed against the
live contract. The provider rejected every call with **HTTP 401 `invalid_api_key`** — the local `.env`
credential is revoked. Latencies of 48–444 ms confirm transport-layer rejection, not model work.

- model requested: `gpt-4o-mini`
- expected cases: 20 · executed: 20 · **generated: 0**
- raw artifact: `.eval-artifacts/practice-generation.latest.json` (git-ignored) · sha256 `40a476fc263e7e916b5d10d4702476ad36145caa3cb7184d97e85f78b7ba8291`

A provider failure is infrastructure failure, never product evidence. Nothing here may be read as a
statement about generation quality — quality remains **unmeasured**.

## Per-case outcome

| case | loc | ms | outcome | reason | flag |
|---|---|---|---|---|---|
| `c01-missed-commitment` | en | 380 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c02-uncertain-customer` | en | 184 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c03-fairness-retention` | en | 119 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c04-safety-hardstop` | en | 0 | DECLINED_AS_INTENDED | fixed_answer_knowledge | PASS CANDIDATE |
| `c05-speed-accuracy` | en | 186 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c06-authority-escalation` | en | 88 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c07-limited-staffing` | en | 120 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c08-two-strong-members` | en | 203 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c09-transparency-verification` | ko | 118 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c10-consistency-context` | ko | 0 | BLOCKED_AWAITING_CONFIRMED_BOUNDARIES | boundary_confirmation_required | REVIEW REQUIRED |
| `c11-relationship-accountability` | ko | 75 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c12-autonomy-standardization` | ko | 60 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c13-mixed-clinical` | en | 0 | BLOCKED_AWAITING_CONFIRMED_BOUNDARIES | boundary_confirmation_required | REVIEW REQUIRED |
| `c14-mixed-privacy` | en | 0 | BLOCKED_AWAITING_CONFIRMED_BOUNDARIES | boundary_confirmation_required | REVIEW REQUIRED |
| `c15-mixed-reporting` | en | 0 | BLOCKED_AWAITING_CONFIRMED_BOUNDARIES | boundary_confirmation_required | REVIEW REQUIRED |
| `c16-ambiguous-boundary` | en | 0 | DECLINED_AS_INTENDED | boundary_confirmation_required | PASS CANDIDATE |
| `c17-confirmed-no-rule` | en | 95 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c18-constrained-clinical` | en | 86 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c19-indirect-violation` | en | 90 | PROVIDER_FAILURE | generation_failed | FAIL |
| `c20-no-safe-space` | en | 101 | PROVIDER_FAILURE | generation_failed | FAIL |

## What the two non-provider outcomes mean

- **DECLINED_AS_INTENDED (2)** — `c04-safety-hardstop` (`fixed_answer_knowledge`) and `c16-ambiguous-boundary`
  (`boundary_confirmation_required`) refused rather than inventing a dilemma. This is the intended safe
  refusal and is the only behaviour this run legitimately evidences.
- **BLOCKED_AWAITING_CONFIRMED_BOUNDARIES (4)** — `c10`, `c13`, `c14`, `c15` stopped before the model because
  the manager has not confirmed non-negotiable boundaries. Correct contract behaviour, but it produces no
  scenario to review.

## Human review sections A–F (Part 7)

**Not producible.** Sections A–F (scenario realism, choice defensibility, decision tension, branch
consequence, boundary integrity, language quality) each require generated scenario text. Zero scenarios
exist, so writing them would be fabrication. They become available once the runner is executed with a
working key.

## Instrumentation gaps (measured, not assumed)

The harness records case id, locale, latency, success/failure and reason. It does **not** record prompt/
template digest, retry count, or token usage. Part 6 asks for those; they are absent and are reported as
absent rather than inferred.

## Next step

Run `/tmp/r214_live_practice_eval.sh` with a working key. It preflights the credential and fails fast on
401/403/404/429, so a dead key can never again be mistaken for an evaluation result.
