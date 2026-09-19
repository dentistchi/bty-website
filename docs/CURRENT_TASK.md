# Active application task contract

## CLINICAL-REASONING-TRAINER-V1

The inner repository is the sole application-code authority. `inner-main` is the integration branch; outer-repository documentation is historical/reference material only.

- Working branch: `codex/clinical-reasoning-trainer-v1`.
- Objective: deliver a deterministic, synthetic dentistry clinical-reasoning case through the Arena UI.
- Raw learner trace events are authoritative. Derived metrics, feedback, benchmarks, and Neurosight exports must not mutate them.
- Browser-local trace persistence is an explicit resilience adapter for V1. It is not a production database or a replacement for a future authorized training-record system.
- Case content is config-driven, synthetic, de-identified, and has no provider or generation path.

## Delivery rules

Use the exact clean worktree path for Git commands. Preserve unrelated concurrent work. Use the sequence: reproduce, diagnose, smallest fix, focused tests, full relevant verification, diff review. Never claim PASS without observed evidence.

No deployment, migration, production write, Supabase mutation, Teams/Entra permission change, Cloudflare publish, merge, or direct push to `inner-main` occurs without explicit authorization. Microsoft identity uses `tid` + `oid`, never email. Capture != Commitment; Saved != Promised.
