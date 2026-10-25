# Clinical discovery V1

The core observation is the doctor's process of obtaining information, including
questions not asked, examinations selected, unresolved requests, working assessments,
and the information available when a decision is made. A four-field written response
cannot establish that process. New Practice attempts therefore use an interview.

## Patient encounter

The library and start API expose neutral case labels and the presenting concern.
The doctor writes questions or examination requests, choosing only the broad
patient/examination channel. There are no recommended question or test menus.
Each request yields only matching, fixed patient facts. Working assessments are
optional, can be recorded during the interview, and do not unlock the reference.
The doctor decides when to submit a single assessment/plan narrative. No minimum
number of questions is imposed. After that submission is persisted, the interface
releases the recorded author perspective and patient comparison information.

The 23 original case records and author responses are unchanged. Their context is
decomposed into versioned private fact packs. Many original contexts explicitly
omit requested examination results. A matched unavailable fact is not a normal or
negative result. A question the router cannot interpret is separately `clarify`;
that is not evidence that the clinical information is absent.

Case 001's additional interview variant supplies fixed fictional answers/results
to make a fuller encounter possible. Its pack version and each added fact identify
`fictional-extension-awaiting-review`. These additions are not statements made by
Dr. Chi. The original source pack is retained. The author perspective predates the
variant, and alignment remains pending review. Other case packs remain limited by
the supplied case context. Neutral visit framing for Cases 006/007 is a presentation
scaffold rather than a patient statement transcribed from the source record.

## Capture and protection

The database envelope remains `clinical-author-pilot/v1`, so its existing restrictive
RLS continues to exclude authenticated direct writes. A distinct interaction version
and frozen patient pack version/hash identify discovery attempts. No migration is
needed for these additive JSON fields. Do not reinterpret old written attempts as
interview observations or infer question order from prose.

The server derives the canonical owner, interprets each request, issues its reply,
and appends the pair in one compare-and-swap write. Idempotent UUID retries retain
one event. Unconfirmed responses are not displayed as findings or saved work.
Requests carry the client's last observed event count; a stale tab must reload
before its question or assessment can be saved. Server-read CAS alone would
incorrectly attribute another tab's newly acquired facts to that assessment.
Browser drafts/outboxes are scoped by owner, source case version, interaction and
attempt; they are recovery aids. They do not establish central persistence.

Before conclusion, owner-readable traces contain the opening and issued information,
never the unreleased private pack. The final assessment records acquired fact IDs
and request count. Only its successful write releases a reference event containing
comparison context. Later reactions cannot replace the initial assessment. Source
case and pack versions must be appended, not overwritten. Prior author submissions
and prior written-case exposure are recorded; external exposure remains unknown.

Admin review/export includes questions, replies, order, timing, working assessments,
available information at each decision, initial assessment, and separate reactions.
The export uses `neurosight-author-pilot-export/v2`, retains each raw mode/version,
and still covers only the latest 50 attempts. Router behavior is instrumentation,
not a clinical score or proof of a doctor's competence.

The authored router is a constrained pilot, not a validated clinical language
interpreter. Explicit target-tooth separation is included for Case 023's two
restorations. Broader paraphrase and tooth-target quality across the other cases
still needs clinician trial; a missed match is retained as `clarify`, not scored
as a missed clinical finding. In-tab conflict reload preserves that tab's draft
over a browser cache another tab may have replaced.

## Short-question repair: interpretation version `discovery-intent/v2`

The reported Case 003 failures had different causes: prior RCT was recorded but
inaccessible in Exam mode, while cold sensitivity was not supplied in the case.
The repair interprets five common history topics separately from the frozen pack:
endodontic history, cold sensitivity, allergies, medications, and symptom onset.
It answers recorded history in either input mode. Known but absent context gets
an explicit unavailable statement, not a request to rephrase or an invented normal
result. Root-canal wording is kept separate from inferior-alveolar-canal anatomy.

`reply.channel` retains the selected input mode. Optional `responseKind` identifies
history, examination, mixed, case-information, or clarification; the UI and review
use that source label. Old replies without these fields remain readable.
`recognizedTopicIds` records only the interpreted request or an explicitly selected
missing-context topic. It is not inferred from every subject covered by a shared
fact. `unavailableTopicIds` describes recognized topics with no available result.
Actual acquired information remains in the original fact-ID fields. An internal
`intent:*` model choice never becomes a clinical fact ID or an obtained negative.
These five canonical topics are not a complete classification of all questions.

Both routing paths can select allowed recorded history from Exam mode. The local
model also receives topic-only choices for these five history topics when the pack
does not supply them. Otherwise connecting a model would not fix the missing
topic. Patient mode still excludes examination facts. The strict ID, count,
confidence, timeout, and prose-rejection checks remain. Mixed history/examination
requests retain separately requested examination clauses. Patient truth, source
versions, pack JSON and hashes are unchanged, so active attempts can continue.
Historical failed requests remain in the raw trace; a new question appends a new
response. This remains a constrained interpreter, not a general language guarantee.

### Observed repair verification

A fresh Node 20.20.2 `npm ci` used the unchanged lockfile. TypeScript exited 0.
The 22-file Clinical/Practice/deployment-guard scope passed 240/240 tests. Ten
isolated public browser tests passed at 320, 390 and 1280 px, including the exact
Case 003 questions against the real frozen server pack and router in a Node-side
API fixture. The browser receives no private fixture in its bundle. No seed or
live learner request was made. Frozen-pack JSON and service-style hashes are
unchanged across every historical/current pack.

A fresh Cloudflare build with loopback placeholders passed. The generated artifact
guard found zero unsafe matches and 2/2 safe middleware implementations in 3,621 JS
files. In 737 public asset files, 46 author-reference markers, 11 Case 001 variant
markers and the Case 003 history marker had zero matches. This is a limited marker
scan, not an exhaustive disclosure proof. Real Teams/iPhone and live model/gateway
behavior remain unverified.

The complete suite remains red. An isolated unmodified `7cc7b3ed` worktree using
the same installed dependencies had 44 failed files / 151 failed tests in 1,351
files / 15,450 tests. The repair had the same failure counts in 1,352 files /
15,514 tests (14,954 passed, 409 skipped). Exact failure lists differ: the baseline
Clinical UI restart assertion observed the fixture's changed trace ID before React
rendered the new composer; the test now waits for both. The repair run instead
failed the unchanged Center consent save-error test. That test waits for OFF, which
also exists while the initial preference is loading and the control is disabled;
its click can therefore precede readiness. The test, component, its direct pure
imports, package file and lockfile are byte-identical to the baseline, with no
Clinical import in that graph. This is a source-supported timing diagnosis, not a
claim of reproducing that exact failure in the new baseline run. Do not report
identical failure sets or zero new full-suite failures. All Clinical tests passed.

Patient/catalog versions, existing stored data, RLS, API authorization, feature
flags, dependencies and deployment scripts are unchanged. No merge, deployment,
migration, seed, production write or local-model configuration was performed as
part of this repair's local verification.

## Optional local model

The default router uses fixed authored patterns. A local model can interpret free
wording and follow-ups through an explicitly configured OpenAI-compatible endpoint:

- `CLINICAL_DISCOVERY_LLM_BASE_URL` — endpoint base, for example local development
  `http://127.0.0.1:11434/v1`.
- `CLINICAL_DISCOVERY_LLM_MODEL` — an explicitly chosen local model.
- `CLINICAL_DISCOVERY_LLM_KEY` — optional gateway credential, server-side only.

The model receives the current question, recent requested topic IDs/questions,
and topic labels. It selects at most four allowed fact or missing-history topic IDs.
It never generates findings or receives the private answers or author reference.
Invalid output, timeout, or provider failure falls back to authored matching, with
the method and fallback reason retained. There is no fallback to a global OpenAI
credential or public provider. This task does not train a model.

A deployed Cloudflare Worker cannot reach the Mac's `127.0.0.1`. Deployment must
use an operator-configured reachable authenticated gateway if local-model inference
is desired. No gateway, credentials or live local model were configured/validated
by this implementation. Mock provider tests are not live model quality evidence.
Official endpoint contract: https://docs.ollama.com/api/openai-compatibility

## Local model connection — measured 2026-10-24

Measured on the operator Mac (Apple M5 Max, 128 GB, Ollama 0.40.5) through the
unchanged production router and its 4-second limit, with
`scripts/clinical-discovery-model-probe.ts` (no database, session or trace).

| Model | Warm latency (router) | Outcome |
| --- | --- | --- |
| `qwen3-coder-next:q4_K_M` (79.7B MoE, 51.7 GB) | 0.6–1.1 s | Valid selections. Chosen. |
| `gemma3:27b` | 1.3–3.4 s | Valid. Rose to 3.4 s with variant B's topic list. |
| `qwen2.5-coder:7b`, `bty-assist-m2` | 0.5–0.9 s | Valid JSON. Frequent multi-topic over-selection. |
| `gemma4:31b` | ≥ 4.0 s loaded | Timed out every call. |
| `deepseek-r1:8b`, `qwen3.5:9b`, `gemma4:e4b`, `gpt-3.5-turbo` (local), `gpt-oss:120b` | 2.2–3.6 s | Mostly `local_model_invalid_response`. |

Large models need several seconds just to load. They are measured only after preloading; the
gateway keeps its model resident. Thinking models did not return the JSON object within the
adapter's 256-token limit.

First measurement, before the selection repair. Case 001 variant B, `qwen3-coder-next`, 26 requests, both directly and through the
authenticated gateway: 21 local-model selections, 19 matched the expected
topics, and 15 were requests the authored patterns could not interpret at all.
Every request finished in ≤ 1.07 s. Observed wrong selections:

- "anything you drink" selected chewing.
- "illnesses" selected medical history plus medications and allergies.
- "does it hang around afterwards" (after cold) and "do you light up" both selected spontaneous pain.
- "compare with the other side" also selected the restoration.

There were two authored over-matches. On "not eating" and "how you eat", the `chewing` pattern
fired, so the existing mismatch guard kept the authored selection
(`local_model_selection_mismatch`). Off-topic requests fell back with
`local_model_low_confidence` and disclosed nothing. These are simulator
interpretation results. A wrong or missing selection is not evidence about the
doctor; the per-turn `routing` keeps the method, model and fallback for review.

These errors were then repaired in Founder-only variant B and selector `selector/2`. Corrected
scoring (accepted alternatives and an answer check) puts that round at qwen 39/52 and gemma 42/52; its
held-out set had been measured before the repair as well. Round 2 (`selector/3`) requires each model
selection to cite the question's own words: a request that names no subject asks the doctor to clarify
(`local_model_ungrounded_selection`). On a new held-out set frozen before that repair, with no other
client using the model server, qwen scored 19/25 and gemma 20/25. qwen stays the default for latency (median
1.1 s vs 3.2 s). Per-question results, contention evidence and remaining errors are in
`docs/CLINICAL_DISCOVERY_MODEL_EVAL.md`.

### Founder-only access

The model and Case 001 variant B are decided on the server per request. Only user ids listed in
`CLINICAL_DISCOVERY_FOUNDER_USER_IDS` (comma-separated; unset means nobody) start on variant B and
receive model selections. Everyone else starts on variant A with authored rules, exactly as before. Their
turns record `local_model_not_enabled` when a model is configured, and `local_model_not_configured`
otherwise. An attempt keeps the pack it started on. If the Founder is later removed, an attempt already on
variant B keeps resolving, with rules only.

### Gateway

`scripts/clinical-discovery-gateway.mjs` listens on `127.0.0.1:8788` only. It
requires `Authorization: Bearer <key>` (constant-time, else 401), accepts only
`POST /v1/chat/completions` (else 404) and only the configured model (else 400).
It forwards just the adapter's fields with `max_tokens` capped. Requests and
responses are size-limited, concurrency and per-minute volume are capped, and
bodies are never logged. The key lives in a 0600 file outside the repository.
The Worker uses:

- `CLINICAL_DISCOVERY_LLM_BASE_URL` = `https://<tunnel host>/v1`
- `CLINICAL_DISCOVERY_LLM_MODEL` = `qwen3-coder-next:q4_K_M`
- `CLINICAL_DISCOVERY_LLM_KEY` = the gateway key (Worker secret)

Publishing the gateway over HTTPS (a Cloudflare Tunnel to `127.0.0.1:8788`) is
an operator step that exposes the Mac. It was not started here. The
Mac must stay awake, with Ollama and the gateway running. When it is
unreachable, every turn falls back to authored rules and records the reason.

### Worker → gateway → model check

`GET /api/bty/clinical-pilot?view=model-check` requires an authenticated user
on the exact Founder user-ID allowlist. A Teams Founder does not need a separate
Google login or a platform-admin grant for this check. Response review and export
retain their platform-admin restriction. It is a **connection diagnostic** (`scope:
"connection-diagnostic"`, `accuracyEvaluated: false`). `connection` is `reached`
when at least one request got a valid model answer, and `not_reached` or
`not_configured` otherwise. Reaching the model says nothing about selection
accuracy, which is measured only by the probe sets. It runs four fixed Case 001 requests through the production router
inside the Worker, including one follow-up and one off-topic request. It
returns the configuration presence (host, model, whether a key is set) and,
for each request, the latency, method, fallback and fact IDs. It never returns
patient answers or the key, and creates no attempt or database row.

### Case 001 variant B

`discovery-2026-10-23.1-variant-b` is appended after the original pack and
variant A, which both remain registered unchanged. Attempts frozen on them keep
resolving by `packVersion`. Only Founder-allowlisted users start new Case 001 attempts on variant B.
Every reply that uses an addition shows "Fictional practice detail · awaiting Dr. Chi's review". It
adds 25 history and examination facts and replaces the location answer; each
of these 26 facts is labeled `fictional-extension-awaiting-review`. Cone-beam
CT, dye staining and crack depth deliberately stay unavailable case
information. None of this is Dr. Chi's recorded case context.

## Verification boundaries

Use isolated unit/API tests and public browser fixtures with
`PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1`. These must never seed
production users or create real learner attempts. The browser fixture holds private
case data in its Node-side API handler; its UI bundle contains no answer fixture.

Verify default minimal API projections, requested-only disclosure, channel isolation,
unknown/clarify distinctions, server-write failure/retry, ownership, compare-and-swap,
working assessment evidence snapshots, immutable final assessment, separate reaction,
history compatibility, and mobile restart/recovery. Build the actual Cloudflare
artifact and inspect public assets for private patient/reference markers.

Real iPhone/Teams, live authenticated writes, and actual local-model interpretation
remain separate runtime checks. Local fixtures must not be presented as production
learner observations. These draft cases/references are not validated clinical keys.

## Observed local verification — 2026-10-23

Node 20.20.2 and the existing PR #76 lockfile were used, without dependency changes.
Verification used stripped environments and no production database credentials.

| Check | Observed result |
| --- | --- |
| `tsc --noEmit --pretty false` | Exit 0 |
| Clinical/Practice and deployment-guard scope | 21 files, 176/176 passed in the final full run |
| Isolated public Playwright specs | 7/7 passed; 320, 390, 1280 px; global setup and web server disabled |
| Fresh `npm run cf:build` | Exit 0 with loopback build placeholders; prior artifacts preserved outside the checkout |
| Generated OpenNext artifact guard | 3,621 JS files, 0 unsafe matches, 2/2 safe middleware implementations |
| Public asset marker scan | 737 files; 46 author-reference and 11 fictional-variant markers; 0 matches |

The variant's distinctive reply was present in the generated server handler.
The public marker scan is limited evidence, not an exhaustive disclosure proof.
The existing unrelated interview simulator was preserved.

The full suite is not green: 1,351 files / 15,411 tests; 14,844 passed,
158 failed, 409 skipped, with 47 failed files. The prior local PR #76 baseline
had 46 failed files / 156 failed tests. The exact lists differ: two Learner
refusal checks (`event_closed`, `target_invalid`) and one Teams token-replacement
check failed, while the previous Teams resumed-focus failure did not recur.
All these source files are unchanged. The token-replacement failure was reproduced
on an unchanged prior-release execution graph. The Learner assertions can read the
loading gate; isolated baseline rechecks passed, so these two exact failures were
not reproduced on the baseline. Do not claim an identical failure set or zero new
full-suite failures. Clinical/Practice tests passed.

An initial full run also exposed an incorrect UI test fixture that returned the
latest attempt instead of the requested attempt, plus a test that checked a child
control's disabled property instead of waiting for its disabled fieldset. Both
test issues were corrected; the final complete run above passed all 9 UI tests.
An unrelated Center consent readiness failure in that earlier run reproduced on
unchanged prior-release code and passed in the final run.

No merge, deployment, migration, seed, runtime flag change, production learner
attempt, real-device test, or live model/gateway connection was performed here.
