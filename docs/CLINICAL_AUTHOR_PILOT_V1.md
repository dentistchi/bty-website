# Clinical Cases author pilot V1

Historical written-capture flow. New attempts use the question-led interview in
[`CLINICAL_DISCOVERY_V1.md`](CLINICAL_DISCOVERY_V1.md); existing written records remain readable.

Practice now offers a library of 23 fictional cases alongside the existing interview
simulator. The written-case flow collects evaluation, working diagnosis, treatment
plan and rationale, commits the initial response, then releases a side-by-side author
reference. A separate explicit helpful/partly/not-helpful reaction, comment and revised
plan follow. Admins can review and export the latest 50 attempts as JSON.

This is a written-case capture pilot. It does not infer a doctor's question order
from prose, simulate unrecorded patient findings, train a model, or assign medical
accuracy scores. The existing conversational simulator remains available.

## Content provenance

`src/domain/clinical-pilot/catalog.json` transcribes Cases 001–023 from Dr. Chi's
author-capture record, captured October 18–23, 2026. Source bytes SHA-256:
`a160163f60b1d51eeced91f6d75aaeffced113041f8aa4001f72857608b5cf5f`.

Original Korean responses and answered addenda are retained. English paraphrases
are explicitly awaiting author review. Clinical evidence qualifications are separate
and visible in the comparison view. Availability means recorded context and an
author response exist; it is not clinical validation. Unanswered details, including
Case 023 cost responsibility, remain unspecified. Simulated A/B/C answers are not
included as real clinician data or shown before the doctor's independent response.

Case IDs use `drchi-001` etc., so they cannot collide with the unrelated existing
trauma simulator's Case 001. A public case snapshot and SHA-256 are frozen at start.
Append new catalog versions rather than replacing old versions, so in-flight traces
can still use their exact recorded version. References carry author, source sections,
reference ID, version, original response and review status. They enter the raw event
stream only when initial submission is successfully persisted.

## Data and access

- Existing `clinical_reasoning_traces`, isolated by schema `clinical-author-pilot/v1`.
- Authenticated canonical user ID is server-derived. No email-based authority.
- Only the server creates events; original answer whitespace is retained.
- Draft, initial submission, reference release and learner reaction are separate
  append-only events. Initial reasoning cannot be replaced through the pilot API.
- Request IDs make acknowledged/lost-acknowledgement retries idempotent. Timestamp
  compare-and-swap rejects concurrent overwrites. Terminal validation errors unlock
  editing; conflicts offer an explicit reload while retaining browser drafts.
- Prior recorded submissions are checked at both start and submit. External exposure
  remains unknown. A prior submission is a conservative exposure flag, not proof that
  a person read a reference.
- Local browser drafts are scoped by authenticated user, case/version and attempt.
  They provide recovery only. No server-save success is shown before acknowledgement.
- Catalog and draft responses contain no author reference. Evidence notes and author
  originals are released only after initial submission. This is an authenticated API
  boundary, not secrecy against someone accessing this public source repository.
- Admin review/export uses platform-admin grants, private/no-store responses, and
  pseudonymous doctor references. Export is explicitly limited to the latest 50 rows.

## Release prerequisites — not performed by implementation

The API is disabled unless server environment `CLINICAL_AUTHOR_PILOT_ENABLED=1`.
Leave it disabled until the following separately authorized operational steps finish:

1. Apply ONLY `20261023201720_clinical_author_pilot_api_owned.sql` through the
   authorized production control plane. It adds restrictive authenticated INSERT /
   UPDATE policies excluding the pilot schema. Existing non-pilot owner policies
   remain applicable. The server-only service role writes pilot rows.
2. Verify authenticated direct REST insert/update of pilot rows is denied, including
   switching a non-pilot row into the pilot schema. Confirm legacy encounter writes
   remain allowed and no existing raw record changed.
3. Merge the reviewed PR into `inner-main`, deploy through the established release
   process, and enable the flag. Verify the live source SHA and canonical-user
   persistence in the signed-in app. Do not enable the flag before the policy check.
4. Run a real iPhone/Teams pilot and inspect initial responses and learner reactions.

No production schema, DB record, user grant, deployment, merge or feature-flag change
is made as part of the implementation. The SQL migration is prepared, not applied.
Runtime RLS and signed-in persistence must be verified during activation.

## Local verification

Run the focused clinical and Practice tests with Vitest. The new API tests use an
in-memory database double and verify ownership, no early reference release, save
failure, immutable transitions, retry idempotency, exposure flags and concurrency.
They do not certify production database policies.

The public browser specs mount real React components with generated Tailwind CSS
and an in-memory API at 320, 390 and 1280 px. They exercise written capture,
comparison, reaction, new attempts and the prior encounter restart geometry.
Run with `PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1`, project
`public`, and a line reporter. This explicitly avoids auth/DB seed scripts and does
not certify an actual iPhone, Teams WebView, or live signed-in deployment.

Observed on October 23, 2026:

- 17 focused Vitest files: 82/82 tests passed, including the prior 52 clinical tests.
- Public Chromium browser checks: 7/7 passed at 320/390/1280 px, including the
  previous encounter restart regression. Screenshots were visually inspected.
- TypeScript passed. Next.js production build passed with Node 20.20.2 and
  non-live Supabase placeholders; the Cloudflare build/deploy was not run.
- PGlite 0.5.11 / PostgreSQL 18.6 WASM: exact existing trace/lifecycle migrations
  plus the new policy migration applied twice; pilot direct writes denied, legacy
  owner writes retained, cross-owner access denied, service-role writes allowed.
- Compiled client JS/source maps contained neither Case 022 nor Case 023 author
  answer literals. API tests check reference omission across all catalog entries.
- The full unrelated application suite was not run. Dependencies were installed
  with `npm ci --ignore-scripts`; only the inspected Supabase CLI installer was
  subsequently run to generate the migration file. No seed scripts were run.

To reproduce the isolated SQL check without adding an application dependency,
install `@electric-sql/pglite@0.5.11` in a temporary directory, copy
`scripts/verify-clinical-author-pilot-rls.mjs` into that directory, and run the copy
with the absolute repository root as its sole argument. It creates an in-memory
database only; it accepts no remote connection. Production RLS remains an activation
check, independent of these local results.
