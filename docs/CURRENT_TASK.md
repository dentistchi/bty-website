# Active application task contract

## Clinical pilot release build repair (2026-10-23)

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

## CLINICAL-REASONING-PRODUCTIONIZATION-V1

Current authorized implementation: `CLINICAL-AUTHOR-PILOT-V1`. Import the 23 recorded
fictional cases and attributed Dr. Chi responses into Practice, collect each doctor's
independent written evaluation/diagnosis/plan/reasoning before reference release,
then capture a separate reaction. Preserve the existing interview simulator.
See `docs/CLINICAL_AUTHOR_PILOT_V1.md` for scope, provenance and release prerequisites.
Implementation and local verification do not authorize production activation.

The inner repository is the sole application-code authority. `inner-main` is the integration branch; outer documentation is historical/reference material only.

Clinical Reasoning traces are synthetic, raw-event authoritative training data. `clinical_reasoning_traces` stores authenticated user-owned traces centrally. Browser storage is resilience only. Metrics, feedback and Neurosight data are derived and never mutate the raw trace. Platform-admin grants are the sole benchmark, summary and export authority. Microsoft identity uses `tid` + `oid`; email is never identity or authority.

The migration is additive and must be applied through the authorized production control plane before central persistence is live. No deployment, migration, production write, Supabase mutation, Teams/Entra permission change, Cloudflare publish, merge, or direct push to `inner-main` occurs without explicit authorization. Capture != Commitment; Saved != Promised.
