# AI Patient access rollout — 2026-11-05

Dr. Chi approved AI Patient access for every signed-in BTY user who has accepted
the current required agreement. No Arena membership, Foundry enrollment or
individual invitation is required. The existing seven fictional patient
situations remain unchanged.

## Release configuration

The server checks `AI_PATIENT_ACCESS_MODE` on the availability endpoint and every
start, turn, speech and feedback request, after authentication and current
consent have passed.

| Value | Access after authentication and current consent |
| --- | --- |
| `all_consented` | Every such BTY user |
| `allowlist`, unset or empty | Only IDs in the existing `AI_PATIENT_ALLOWED_USER_IDS` secret |
| Any other value | Nobody |

`wrangler.toml` records `AI_PATIENT_ACCESS_MODE = "all_consented"` in `[vars]` for
the approved release. A Dashboard-only value can be overwritten by a later
deploy, so the checked-in release configuration is authoritative. Local
`.env.example` retains the narrower `allowlist` default.

Keep the existing dedicated `AI_PATIENT_OPENAI_API_KEY`,
`AI_PATIENT_SESSION_SECRET`, `AI_PATIENT_ALLOWED_USER_IDS` and `RATE_LIMIT_KV`
binding. This release requires no secret, provider project, spend setting or
database change. Missing dedicated provider configuration still closes AI
availability; the shared BTY key is never a fallback.

## Boundaries and verification

Unsigned requests still return 401. Missing, stale or unreadable current consent
still returns 403 before any model or usage-budget call. Starting a session still
requires the fictional-patient acknowledgement. Session ownership, expiry,
scenario validation and the existing per-user short/daily limits remain in force.
The existing KV limiter is approximate; these limits are not an exact global
cost cap. Dedicated provider project and spend controls remain as configured.

Isolated tests cover all seven starts for a non-allowlisted user without Arena
membership, the real consent primitive and auth gate on all five endpoints,
per-action budget parameters and 429 refusals, sealed-session ownership,
default allowlist behavior, invalid modes and rollback of an active session.
No live provider, Worker or Teams result is established by these tests.

Observed local result: 15 files and 357 tests pass, including six tests through
the real consent gate. Node 20 `tsc --noEmit --incremental false` exits 0 with
`--max-old-space-size=6144`. Full-suite and fresh-build results belong to the
integration release verification.

## Rollback

Set `AI_PATIENT_ACCESS_MODE` to `allowlist` in the deployment configuration and
release through the existing wrapper. The retained ID allowlist then controls
access on the next request, including requests from sessions already started.
An empty allowlist in that mode closes the feature to everyone. Clearing only
`AI_PATIENT_ALLOWED_USER_IDS` while mode remains `all_consented` does not close
access.

Verify the resulting availability response and paid-endpoint refusal for an
existing consented account outside the allowlist without changing that account,
its consent or learner records. Keep receipts, clinical content and all existing
learner data intact.
