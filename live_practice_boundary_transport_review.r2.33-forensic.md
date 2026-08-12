# SLICE 3.2I-PRACTICE-R5B1A.1-R2.33 — BOUNDARY REVIEW TRANSPORT FAILURE FORENSICS

**READ-ONLY TRANSPORT GATE. No provider call, no retry, no implementation.**

## VERDICT

**B. TRANSPORT EVIDENCE OR CLASSIFICATION IS INSUFFICIENT**

> The client threw an error carrying the HTTP status in its message.
> The narrow reviewer's outer `catch` **does not bind the error at all**.
> Status, provider code, retriable flag and failure layer were discarded before anything was written.
>
> **The provider-side cause is unknowable from this artifact — and a retry now would produce a second artifact just as silent.**

---

## 1. ARTIFACT INTEGRITY

| Field | Value | Match |
|---|---|---|
| HEAD | `67ebf45636e6b64b947022fbdf8611a548ea8f99` == origin/inner-main | ✅ |
| Tracked tree | clean | ✅ |
| Manifest | `5b2abf97a1de5074af0f47f6f63cc641757a1bd0a87e5253ff8926394c446463` | ✅ |
| Artifact | `…boundaryreplay.live.20260801T151001Z.pass2.c18-constrained-clinical.a2.b15bfb8f703b.json` | ✅ |
| SHA-256 | `5b675bcf160fc0d6f6e541e8a81bebd80dff41b4008ada6c974f171ae0bfdf4a` | ✅ |
| Boundary-review subject | `b15bfb8f703b…` — **rebuilt locally, matches** | ✅ |
| Surface map / lineage | `59c57451f3fe…` / `ec1a498917ba…` | ✅ |
| Review calls / reruns | 1 / 0 | ✅ |
| Generation / broad-review calls | 0 / 0 | ✅ |
| Credential or account metadata | **NONE** (0 matches) | ✅ |

**Version drift (secondary):** the artifact records `practice-narrow-boundary-replay/1` while the runner binds `/3`. No effect on this failure.

---

## 2. THE TRANSPORT ATTEMPT

```
latencyMs        459          ← against a nominal 120,000 ms timeout
finishReason     null
parsed           null
sanitizedError   "boundary_review_request_failed"
verdict.codes    ["boundary_review_not_json"]  →  classifyFailure: "coverage"
```

**Every diagnostic field is ABSENT:** `httpStatus`, `providerErrorType`, `providerErrorCode`, `retryAfter`, `retriable`, `responseReceived`, `requestReachedProvider`, `failureLayer`, `localErrorName`, token usage.

### Deepest **confirmed** layer: **B — client invocation started**

459 ms is inconsistent with a throw from `getLlmClient()` (sub-millisecond, and the runner enforces a non-empty credential first). The time was spent inside `chat.completions.create`.

**Strongly indicated but UNPROVEN: D — HTTP response received.** 459 ms is a realistic TLS handshake + round trip to `api.openai.com`, and the client's only non-2xx path is
`throw new Error('LLM API error: ' + status + ' ' + statusText)` — exactly what the unbound catch swallows. A DNS/TLS failure at similar latency is not excluded.

---

## 3. FAILURE CLASSIFICATION — **M: EVIDENCE INSUFFICIENT**

| Excluded with evidence | Why |
|---|---|
| D provider timeout | 459 ms of a nominal 120,000 ms — nothing timed out |
| E local abort/timeout | **no AbortSignal exists on this path** — no abort is possible |
| L parsing misclassified as transport | `parsed` is null and the failure came from the outer catch, not the `JSON.parse` branch (which would emit `boundary_review_not_json` via `malformed()`, not `boundary_review_request_failed`) |

**Not excluded:** auth · quota · rate limit · DNS/TLS/network · provider 5xx · invalid-request · strict-schema rejection · local adapter exception.

Distinguishing these needs the HTTP status or provider error code. **Both existed at the throw site. Neither was recorded.**

---

## 4. REQUEST VALIDITY — **VALID**

| | |
|---|---|
| subject digest (rebuilt locally) | `b15bfb8f703b…` — **matches artifact and preflight binding** |
| model | `gpt-4o-mini` |
| response_format | `json_schema`, `strict: true`, `bty_practice_boundary_surface_review_v2` |
| sampling | `temperature 0, top_p 1, max_tokens 16000` |
| messages | 2 |
| request | 8,229 bytes / ~2,743 tokens · prompt 6,451 bytes / ~2,151 tokens |
| surfaces / boundaries | 12 / 1 · requiredAssessmentCount 12 |
| schema | 1,035 bytes · `additionalProperties:false` at both levels · every property required · **no `if`/`allOf`/`anyOf`/`oneOf`/`$ref`/`pattern`/`format`** |

**Nothing in the request shape explains a rejection.**

### Against the last **successful** live call (R2.30, ~30 min earlier — succeeded **twice**)

| Identical | Different |
|---|---|
| request bytes **8,229 vs 8,229** · 12 surfaces · 1 boundary · surface map digest · model · response-format mode · **schema (unchanged in R2.32)** · sampling · token budget · client invocation path | system prompt ~1,514 → **2,151** est. tokens (regenerated from the parity table); subject digest (now covers the parity table) |

Total input ~4,894 tokens against a 128k context — **not a transport-relevant difference**.

**Latency: 14,686 / 11,440 ms (success) vs 459 ms (failure).**

> The failed request is transport-equivalent to one that succeeded twice shortly before. That points **away** from request/schema validity and **toward** an environmental or account-side cause — precisely the class this artifact cannot name.

---

## 5. ERROR-ADAPTER FIDELITY

```
client            throw new Error(`LLM API error: ${status} ${statusText}`)   ← status EXISTS here
                    ↓
narrow reviewer   } catch {                                                    ← ★ INFORMATION-LOSS POINT
                    sanitizedError: "boundary_review_request_failed"             (the error is never bound)
                    ↓
verdict           codes: ["boundary_review_not_json"]                          ← false: no body ever arrived
                    ↓
stage             boundary_reviewer_infrastructure_failure / transport_failed
                    ↓
artifact          boundary_reviewer_terminal_failure + one opaque string
                    ↓
exit              4                                                            ← correct
```

**Information-loss point:** `src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts` — the unbound `catch { }` on the provider call.

The artifact is durable and honest about what it knows. **It knows almost nothing.**

---

## 6. TERMINAL CLASSIFICATION — **MULTIPLE DEFECTS**

| Question | Answer |
|---|---|
| Is a transport failure a review attempt? | **NO** — the reviewer never received the subject |
| Should it consume reviewer-call count? | **NO — but it did** (`reviewCalls: 1`) |
| Should it consume rerun authority? | **NO** — indirectly it did, by spending one of two calls |
| Should one transport failure be immediately terminal? | Defensible as fail-closed, but terminal-**for-the-run** ≠ terminal-**for-the-reviewer**; the code conflates them |
| Should the top level be `provider_failure`? | **YES** — it exists in the canonical enum for exactly this |
| When is `boundary_reviewer_terminal_failure` right? | When the **reviewer** produced two unusable responses over an identical frozen subject — the R2.30 shape. Not when no response existed. |
| Should the subcode survive? | **YES** — `boundary_review_transport_failed` is correct beneath the right top level |

Also: `verdict.codes = ["boundary_review_not_json"]` makes `classifyFailure` return **`coverage`** — a transport failure presented as a coverage failure.

`scenarioUnjudged: true` is **correct**.

---

## 7. RETRY SAFETY

| Precondition | Result |
|---|---|
| No generation / scenario mutation | ✅ proven |
| Identical subject & request digests | ✅ proven (rebuilt locally) |
| No provider success consumed | ✅ `parsed` null, no envelope, no usage |
| **Failure class retriable** | ❌ **UNKNOWN — the blocking gap** |
| Quota/billing ambiguity excluded | ❌ cannot be excluded |
| Within reviewer-call limits | ⚠️ a new execution starts a fresh budget and a new artifact name |
| Credential handling safe | ✅ |
| Artifact immutability | ✅ `writeReplayArtifact` refuses to overwrite |

**Hidden client retry count: 0** — the client is a bare `fetch` wrapper with no retry loop, no backoff, no SDK policy. One application call ≤ one HTTP request.
**Application attempts: 1. Provider requests: ≤ 1, unknowable whether any reached the provider.**

**Exact stop condition:** do not retry until the transport record carries the HTTP status or an explicit no-response indicator.

> The call is not dangerous. It is **uninformative**. R2.30 → R2.31 already spent two calls re-measuring one invisible defect.

---

## 8. TIMEOUT AUTHORITY — **NO TIMEOUT FIRED**

| | |
|---|---|
| configured | 120,000 ms |
| elapsed | 459 ms |
| AbortController on the narrow path | **NONE** — `create({...})` is called with no options argument |
| nested client timeout | none — the fetch wrapper sets none |
| shell / SDK timeout | none / N/A |
| layers present → fired | **1 → 0** |

**`NARROW_BOUNDARY_SAMPLING.timeoutMs: 120000` is recorded in the contract and the manifest but never applied.** The broad reviewer *does* wire an AbortController + timer ([arenaScenarioGenerationService.ts:747-748](src/lib/bty/foundry/arena/arenaScenarioGenerationService.ts#L747-L748)); the narrow reviewer does not. This did not cause the failure — but a hung request here would run unbounded.

---

## 9. CREDENTIAL LIFECYCLE — **PASS**

Requested only after preflight ✅ · `read -rs`, no echo ✅ · `unset HISTFILE` ✅ · never on disk or in the artifact ✅ (0 matches) · `trap cleanup EXIT INT TERM` fires on normal exit, failure and interrupt ✅ · no credential-bearing child remained ✅.

*Residual, inherent to the pattern:* the exported variable is visible in the child's environment for the duration of the call. Not exercised beyond the intended child.

---

## 10. OPTIONS

| Option | Result |
|---|---|
| 1 · one identical manual retry | **NOT RECOMMENDED AS NEXT** — cheap, but on failure produces a second artifact with the same opaque string |
| 2 · **transport evidence + classification repair** | **RECOMMENDED** — addresses the loss point, the false code, the `coverage` mislabel, the wrong top level and the call consumption. 0 provider calls. |
| 3 · request/schema correction | **NOT RECOMMENDED** — evidence is *against* it: transport-equivalent to a twice-successful request, schema unchanged and inside the strict subset |
| 4 · timeout correction | **REAL DEFECT, WRONG HEADLINE** — cannot explain 459 ms; fold in as a companion |
| 5 · credential/quota operational action | **NOT YET** — becomes right immediately if the repaired record shows 401 / 429 / insufficient_quota |
| 6 · provider/model routing change | **NOT AUTHORIZED** — no repeated capability failure measured |

---

## 11. SMALLEST NEXT ACTION — **B**

### R2.34 — BOUNDARY REVIEW TRANSPORT EVIDENCE AUTHORITY V1

1. **Bind the error** and record, sanitized: HTTP status, provider error type/code, retry-after, retriable indicator, response-received, request-reached-provider, local failure layer.
2. Stop emitting `boundary_review_not_json` for a response that never arrived — give transport its own code.
3. Classify transport as **`provider_failure`** at the top level, preserving `boundary_review_transport_failed` as the subcode.
4. **Do not consume reviewer-call budget** for a call the reviewer never saw.
5. *Companion:* wire the narrow path's AbortSignal so its 120 s timeout can fire.
6. *Companion:* align the artifact version constant with the runner binding.

**Gate:** drive a simulated non-2xx and a simulated network rejection through the adapter; assert status/code/layer survive into the artifact, that transport classifies as `provider_failure`, and that it does not consume a reviewer call.

**Excluded:** urgency · communication axis · c09 · semantic precision · model change · generator changes.

> This makes the **next** live call diagnostic whether it succeeds or fails.

---

## 12. UNRESOLVED

- Whether the provider returned 401, 429, 5xx or an invalid-request error — or whether the request reached the provider at all. **Unknowable from this artifact by construction.**
- Whether the failure is transient. Transport-equivalence to a twice-successful request makes it plausible; plausible is not measured.
- The two R2.30 open semantic questions (branch[0] world-state false positive, branch[1].action[1] instability) remain unmeasured — no live verdict has been obtained since.

---

## 13. NO-MUTATION PROOF

| Check | Result |
|---|---|
| HEAD after | `67ebf45636e6b64b947022fbdf8611a548ea8f99` — unchanged |
| origin/inner-main | unchanged |
| Tracked tree | clean |
| Live artifact | byte-identical (`5b675bcf…`) |
| Prior artifacts | byte-identical |
| Live provider call | **NONE** |
| Generation call | **NONE** |
| Database connection | **NONE** |
| Deployment | **NONE** |
| Source / test change | **NONE** |
| Commit / push | **NONE** |
| New runner | **NONE** |

Analysis scripts were written to the session scratchpad, outside the repository.
