# Active application task contract

## APP-PRELAUNCH-RELIABILITY — 2026-10-30

Dr. Chi requests autonomous reproduction, repair and regression verification of
Today overdue cleanup, Track/Save and other main app flows before public release.
Use this isolated topic branch from PR82 / inner-main. Keep Clinical QA PR84
separate. No shared training/learner records, deadlines, XP, identities, permissions
or production configuration may be changed merely to clear a screen.

Source reproductions identify ignored Save UPDATE failures and a concurrent
Track/Save intent race; completed-training personal dismissal does not feed Today
host attention; Today reselect ignores refreshKey; Track mutations hide errors;
Field Actions child return retains stale inventories; Teams Today navigation
replaces the frame-safe /teams document path. Preserve canonical server state and
surface mutation failures without inventing success or completion.

Read-only production inspection matched the two screenshot training titles via
follow-up source titles: one event is closed, one is open, neither personally
hidden. No live mutation has been attempted. Existing history dismissal accepts
only closed events; active training must retain that lifecycle boundary. The
closed row can gain an explicit personal Remove action, with the existing owned
endpoint and failure feedback. Final release claims must distinguish isolated
verification from real Teams/mobile and deployment checks.

## CLINICAL-DISCOVERY-REQUESTED-INFORMATION — 2026-10-30

The Case 006 recording shows a request for other teeth receiving an explicit
unavailable caries-risk response, followed by the static author reference saying
to assess caries risk. The comparison does not currently evaluate omitted
questions, but its presentation does not acknowledge that this request was made.
Derive a post-assessment acknowledgement from the issued trace: requested but
unavailable facts/topics are case information limits, not omitted questions or
normal findings. Keep uninterpreted requests separate. Preserve the original
questions, replies, references and assessment-time acquired information.

Also repair the Case 006 interpreter's target scope: requests for restorations
in other teeth or dentition-wide caries risk must not substitute the target
tooth's MOD finding. Keep explicitly mixed examinations and target-tooth requests.
Do not fill missing patient facts or change frozen packs. No production writes,
merge, deployment, secret changes, migration or seed are authorized by this repair.

Observed evidence: the two-file reproduction on the original implementation had
8 failed / 14 passed tests. With the repair, 27 related files / 366 tests
pass; TypeScript exits 0; the 10 isolated public browser tests pass at 320, 390
and 1280 px. The Cloudflare build exits 0 with loopback-only public placeholders.
Its artifact guard checks 3,621 JS files: zero unsafe matches and 2/2 safe
middleware implementations. The full unrelated repository suite and live model
quality measurement are not rerun. Patient packs and author references remain
unchanged; no learner record or production configuration is written.

## CLINICAL-DISCOVERY-WORKER-TRANSPORT — 2026-10-25

The post-deploy Founder GET on `bc89591b` confirmed both domains' source identity
and authenticated the existing Teams user, but all four reported probes returned
`local_model_unavailable` in 0 ms with no valid model answers. The model being
unloaded is a separate operational concern, not the explanation established here.

Actual workerd reproduces a Request-construction TypeError for `redirect: "error"`
before any outbound request. Use `redirect: "manual"` in the Worker router and
retain the existing non-2xx guard to reject redirects without forwarding the
Bearer key. Preserve the four-second deadline, selector, patient packs, Founder
gate and Node gateway; Node supports its existing redirect mode.

Six new actual-workerd regression cases fail on the old router. With the repair,
26 related files / 354 tests pass, including native Worker fetch to a synthetic
model and refusal of 301/302/303/307/308 without any off-host request. All test
outbound traffic is intercepted locally; no real gateway, key or learner record
is used. No new live-model accuracy score or production source publication is
claimed by this local repair. Full repository and browser UI suites are not rerun
for this transport-only change.

## CLINICAL-DISCOVERY-FOUNDER-DIAGNOSTIC — 2026-10-25

The authenticated Teams Founder is not a platform admin. Permit the connection-only
`GET ?view=model-check` through `requireUser` followed by the exact server-side
Founder user-ID allowlist. Keep response review/export behind `requirePlatformAdmin`.
Do not grant global admin authority or require a separate Google identity to run
this diagnostic. Preserve the pilot flag, private/no-store response, fixed probes,
redacted output, and return before initializing the application database.

Reproduction: five diagnostic assertions fail on the unmodified route with the
new non-admin-Founder expectations (24 pass). After the auth-selector repair,
25 focused files / 348 tests pass; TypeScript exits 0. These checks use mocked
auth, database and model transports, with no service credentials or live model.
The full unrelated suite and browser UI tests are not rerun for this API-only
change. No production source publication, learner record, migration, seed,
identity-link mutation or admin grant is part of local verification.

## CLINICAL-DISCOVERY-CONTEXT-AND-IMAGING — 2026-10-24

Follow-up to the operator-reported live check of PR #79 `2ce05538`. Record that
report with provenance; its private Mac scripts/results have not been read here.
Repair the remaining apex-to-CBCT and cold-persistence-to-severity paths without
changing selector/3 or inventing patient facts. In Founder-only Case 001 variant B,
unspecified apical film/image uses the explicit PA convention; CBCT/3-D stays
separate. A pure persistence follow-up may repeat only the immediately prior,
single available cold-history fact, with an authored-context version marker.
Other contexts keep normal interpretation; original packs/variant A stay unchanged.

Router version: `discovery-intent/v4`. No new model-quality score, live model run,
tunnel, Worker secret, database write, merge or deployment is part of this repair.
See `docs/CLINICAL_DISCOVERY_MODEL_EVAL.md` for the reported live check, regression
evidence and bounded-context limitations.

Observed local checks: TypeScript exit 0; 25 focused files / 342 tests passed.
The complete final full run has 46 files / 156 tests failing, exactly the same
normalized failed assertions as the preceding observed `2ce05538` run; the 28
new tests pass. The earlier baseline was reused rather than freshly rerun.
Ten isolated browser tests and a fresh Cloudflare build passed. Artifact guard:
3,621 JS files, zero unsafe matches, 2/2 safe implementations. Sample marker scan:
81 markers, zero matches in 739 public text assets; this is not exhaustive proof.

## CLINICAL-DISCOVERY-PREVIEW-BOUNDARIES — 2026-10-24

Follow-up to PR #79 round 2 (`e88bead9`). Repair the known variant-B authored
location, restoration and chewing-side over-matches, including mixed questions.
Keep base/variant A matching and all patient answers, availability and provenance
unchanged. Record the changed interpreter as `discovery-intent/v3`; selector/3
and its measured results are not new model-quality evidence.

Bound the loopback gateway's upstream response while reading UTF-8 bytes, validate
positive integer token budgets, bound request-body receipt and cancel upstream work
when its client disconnects. Importing transport helpers must not start the model
or listener. Verify these boundaries without sockets or external model calls.

The exposed held-out-2 failures now inform regression repair. Preserve the original
measurement files and scores as historical results; do not call this set unseen or
claim a new live-model score. Contended runs remain evidence of shared-Mac runtime
latency, even when excluded from an isolated selector comparison. Do not require a
new benchmark cycle merely to repair a known bug. Founder-only trial is the next
product stage after operator review and the separately authorized connection work.

No tunnel, Worker secret, merge, deployment or learner record write is authorized
by this local repair.

Observed local checks: actual Node-20 install; types exit 0; 314 focused tests and
10 isolated browser tests passed. Full comparison against unmodified `e88bead9`:
49 files / 159 tests failing before, 46 / 156 after, no added failed assertions;
three unchanged UI failures passed only in the repair run. The full suite is not
green and no live local-model score has been remeasured.
Fresh Cloudflare build passed with loopback placeholders; the 81 sampled private
answer markers had zero matches in 739 public text assets (limited scan).

## CLINICAL-DISCOVERY-LOCAL-MODEL — real local model behind an authenticated gateway

Base: `inner-main` `7a461f11`. Connect Clinical Discovery's existing model
adapter to a real Mac-local Ollama model. Choose the model by measured latency
under the adapter's 4-second limit, not by size. Verify paraphrases and
follow-ups through `discovery-router.server.ts` with no database writes. Put an
authenticated HTTPS-ready gateway in front of the model and add an admin-only,
write-free Worker check. Add a fuller Case 001 fictional variant for author
review without changing existing packs or attempts.

Measured: `qwen3-coder-next:q4_K_M` took 0.6–1.1 s through the router and
gateway. On Case 001 variant B it made 21 local-model selections in 26
requests, 19 of the 26 matched the expected topics, and every selection was
under the limit. Wrong selections and fallbacks are simulator results, never
the doctor's. See `docs/CLINICAL_DISCOVERY_V1.md`.

Repair (same branch, PR #79): fixed the five reported wrong selections and the two authored
over-matches in Founder-only variant B and selector `selector/2`. Compared qwen and gemma on
frozen tuning (32) and held-out (20) sets. Both scored 43/52; held-out was qwen 16/20 and gemma 14/20.
Server-side `CLINICAL_DISCOVERY_FOUNDER_USER_IDS` limits the model and variant B to the Founder.
Everyone else keeps variant A and authored rules. model-check is a connection diagnostic, kept separate
from accuracy. See `docs/CLINICAL_DISCOVERY_MODEL_EVAL.md`.

Round 2 (same PR): corrected the round-1 record (held-out was run before and after its repair; sweets
accepted for drinks, cold for coffee; reply text must answer the question), froze held-out-2 in
`f6e6f3e2` before repairing, then `selector/3` grounded selections, chewing-tobacco and chewing-side
over-matches and three fictional answers. Clean run (0 s of other-client load): held-out-2 qwen 19/25,
gemma 20/25; two earlier runs were invalidated by another local Ollama client and are preserved.

Not done here: an HTTPS tunnel publishing the gateway, Worker secrets, merge and
deploy. Each needs explicit authorization.

## CLINICAL-DISCOVERY-SHORT-QUESTIONS — valid questions and missing context

The live Case 003 screenshot shows `Root canal done?` in Exam mode and
`Cold sensitivity?` in Patient mode both rejected as unmatched. Reproduction also
found Case 012 incorrectly disclosing inferior-alveolar-canal imaging for the
root-canal-history question. Fix the interpretation boundary without changing
frozen patient packs or inventing cold symptoms/test results.

Recognize ordinary history questions in either input mode, label responses by
their source, and distinguish known-but-unsupplied history from an interpretation
failure. Preserve the selected mode, literal questions, raw event prefix, case
version/hash, and distinction between requested topics and acquired facts.
Missing-context intent IDs must never be clinical fact IDs or negative findings.
Keep explicit examinations separate, including mixed history/examination turns.
Retain strict local-model selection validation and private server-owned answers.

The repair covers common endodontic history, cold history, allergies, medications
and symptom onset across existing packs. It does not configure a live model or
fill omitted patient truth. See `docs/CLINICAL_DISCOVERY_V1.md` for limits and
verification. No production writes, migration, seed or flag changes are required.

Observed repair evidence: TypeScript exit 0, related 22 files / 240 tests passed,
10 isolated browser tests passed, and a fresh Cloudflare build plus artifact guard
passed. The fresh `7cc7b3ed` baseline and repair each had 44 failed files / 151 failed
tests; exact lists differ in the Clinical UI restart readiness assertion and the
unchanged Center consent readiness test. See the discovery document for the limits.
No frozen pack, patient truth, dependency, migration, production flag or stored
record changed. The repair is prepared for review; deployment is a separate step.

## CLINICAL-DISCOVERY-V1 — corrected interaction contract

The user clarified that the skill to capture is discovering information: deciding
what to ask the patient and what to examine before forming a diagnosis and plan.
The written four-field pilot does not satisfy that goal. New attempts must start
with a chief complaint, accept free-text patient questions and examination requests,
and disclose only corresponding fixed patient information. Do not show question
menus, diagnostic case titles, all findings, or the author reference up front.

Record literal requests, issued responses, their order and time, recognized fact
IDs, unresolved interpretation separately from unavailable findings, and information
available at each working/final assessment. The doctor decides when to conclude;
there is no required question count or invented medical accuracy score. Only after
the initial assessment is committed may the reference and full comparison context
be released. Capture the learner reaction separately.

Preserve existing written attempts as written records. Retain the protected
`clinical-author-pilot/v1` storage envelope, with explicit
`clinical-discovery/v1` interaction and patient-pack versions; do not create a new
unprotected database schema tag. Patient truth remains server-side until requested
or released after conclusion. Case 001 may use a fixed fictional interview variant;
its new facts must be labeled as additions awaiting author review, never attributed
to Dr. Chi's source record. Other cases retain their recorded unknowns.

See `docs/CLINICAL_DISCOVERY_V1.md`. Implement and verify locally, preserving the
existing interview simulator and records. No production write, migration, runtime
flag change or deployment is part of local verification.

Observed local evidence: TypeScript exit 0; 21 related files / 176 tests passed;
seven isolated browser tests passed; fresh Cloudflare build passed. Generated
artifact guard passed (3,621 JS files, zero unsafe matches, 2/2 safe implementations).
The 46 author-reference and 11 variant markers were absent from 737 public asset
files. Full suite: 47 failed files / 158 failed tests, compared with the prior local
46 / 156 baseline; the exact unchanged Learner/Teams failure lists differ. See the
discovery document for the reproducibility limits. No live model or production
change was made. Merge and deployment still require explicit authorization.

## Previous release: Clinical pilot build repair (2026-10-23)

PR #75 is merged at `4c98952b8616f32002bdc91854c89c0fa622393c`, but its
Cloudflare build is blocked by OpenNext's two-year Next 15 support-date check.
Patch `next` and `eslint-config-next` to 15.5.28 and the application's resolved
`sharp` to 0.35.5, following the October 14 Next.js security update. Temporarily
pass `--dangerouslyUseUnsupportedNextVersion` through the shared `cf:build`
entry point. This flag only bypasses the support-date check; it does not extend
Next 15 support or replace security updates. Plan a separate Next 16 migration
to remove the override.

Keep the deployment wrapper, source-identity checks, generated middleware
artifact guard, clinical content, runtime pilot flag and database unchanged.
Verify installation, types, focused tests, the exact full-suite failure set
against the unmodified PR #75 baseline, isolated browser tests and the actual
Cloudflare build. Public build placeholders are local verification inputs,
not production configuration. The authenticated deployment environment must
rebuild the merged source with its real build environment before publishing.

Local evidence (Node 20.20.2, isolated build inputs): `npm ci` with hooks passed;
TypeScript passed; 18 focused files passed 126 tests (82 Clinical/Practice and
44 deployment guards); seven isolated browser tests passed. A fresh `cf:build`
passed after an initial attempt failed cleaning `.next/export` (`ENOTEMPTY`).
No cleanup retry or deployment guard was changed. The generated artifact guard
passed: 3,621 JavaScript files, zero unsafe matches, two of two safe middleware
implementations. The 46 author-reference markers were absent from 1,389 public
build text files; this marker scan is not an exhaustive disclosure proof.

The full suite is not green: before and after each had 46 failed files / 156
failed tests among 1,348 files / 15,361 tests, with 409 skipped. Their exact
failure lists differ by two existing UI synchronization failures. The baseline
learner refusal failure waits for a gate that also exists while loading; its
result varies on recheck. The Teams resumed-focus failure also reproduced on
unmodified PR #75 with its original dependencies: two serial runs passed 12/12,
then the third failed the same focus assertion (11 passed / one failed).
Do not report identical failure lists or an entirely passing full suite.

## Previous contract: CLINICAL-REASONING-PRODUCTIONIZATION-V1

Previous implementation: `CLINICAL-AUTHOR-PILOT-V1`. Import the 23 recorded
fictional cases and attributed Dr. Chi responses into Practice, collect each doctor's
independent written evaluation/diagnosis/plan/reasoning before reference release,
then capture a separate reaction. Preserve the existing interview simulator.
See `docs/CLINICAL_AUTHOR_PILOT_V1.md` for scope, provenance and release prerequisites.
Implementation and local verification do not authorize production activation.

The inner repository is the sole application-code authority. `inner-main` is the integration branch; outer documentation is historical/reference material only.

Clinical Reasoning traces are synthetic, raw-event authoritative training data. `clinical_reasoning_traces` stores authenticated user-owned traces centrally. Browser storage is resilience only. Metrics, feedback and Neurosight data are derived and never mutate the raw trace. Platform-admin grants are the sole benchmark, summary and export authority. Microsoft identity uses `tid` + `oid`; email is never identity or authority.

The migration is additive and must be applied through the authorized production control plane before central persistence is live. No deployment, migration, production write, Supabase mutation, Teams/Entra permission change, Cloudflare publish, merge, or direct push to `inner-main` occurs without explicit authorization. Capture != Commitment; Saved != Promised.
