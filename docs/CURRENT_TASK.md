# Active application task contract

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
