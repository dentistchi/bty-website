# Active application task contract

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
