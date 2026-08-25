# BUILD 26U-R4C-R1 — expiry lifecycle · PASS / CLOSED

## Founder decision

```
Lazy expiry retained.
No scheduler / cron / worker / clock trigger added.
Authorization expires at expires_at <= now().
Stored EXPIRED is materialized on the next canonical account-scoped reconciliation opportunity.
```

## Production behaviour delta: NONE

No file under `src/` or `supabase/migrations/` changed. R4C added a deterministic harness and this
document. The two existing writers — `switch_timed_access_pass` and
`karaoke_start_premium_room_session` — were deliberately **not** consolidated: R0 established
their semantics are byte-equivalent, and that is duplication, not a defect. Their parity is now
frozen by test instead of by refactor.

## The five truths

| # | claim | proven by |
|---|---|---|
| 1 | usable before cutoff | boundary case 1 |
| 2 | unusable exactly at cutoff | boundary case 2 — `expires_at > as_of`, never `>=` |
| 3 | unusable after cutoff while physically ACTIVE | §H, and production on 98f52997 |
| 4 | materializes ACTIVE→EXPIRED exactly once | both paths, one audit row each |
| 5 | repeat / concurrent / alternate reconciliation damages nothing | §K, §L, §P |

## Lifecycle evidence

Fixture built through the real chain — `issue → select → karaoke_start_premium_room_session` —
then the ACTIVE window shifted 2 hours back. The row shape is exactly what the lifecycle
produces (`expires = activated + 3600`); only the instants move. No invariant bypassed.

Grant `6dc3c857…`, activated `2026-08-25 00:28:49.25597+00`, expires `2026-08-25 01:28:49.25597+00`.

| instant | stored status | expires_at vs as_of | entitlement | projection | activePass | expiry audits |
|---|---|---|---|---|---|---|
| 01:28:48 (before) | ACTIVE | `>` | **true** | TIMED_ACCESS | `6dc3c857…` | 0 |
| 01:28:49.25597 (exact) | ACTIVE | `=` | **false** | FREE | null | 0 |
| 01:28:50 (after, unswept) | ACTIVE | `<` | **false** | FREE | null | 0 |
| after path A | **EXPIRED** | `<` | false | FREE | null | **1** |
| after repeat | EXPIRED | `<` | false | FREE | null | **1** |
| after path B | EXPIRED | `<` | false | FREE | null | **1** |

Audit vocabulary unchanged: `SYSTEM / EXPIRED / ACTIVE->EXPIRED`.

## Mutation contract

Changed: `status ACTIVE→EXPIRED`, `expired_at null→set`, `updated_at`.
Preserved byte-identically across both the first sweep and every repeat:

```
id | account_id | activated_at | expires_at | carryover_seconds | source_type | is_paid |
apple_purchase_id | duration_seconds
```

## Concurrency — two real connections

Connection B held the account advisory lock inside a transaction (`pg_sleep(3)`) while
reconciling; connection A entered the other reconciliation path and **blocked 2074 ms** rather
than interleaving. No deadlock. Final status `EXPIRED`, **exactly one** expiry audit, never
resurrected, and the expired entitlement never won.

## Negative proofs — all PASS

created no grant · deleted no grant · selected no grant · activated nothing (the 2 ACTIVATED rows
are the two real session starts) · `activated_at` unchanged · `expires_at` unchanged · no
carryover added · no other grant touched · no other account touched (neighbour `updated_at =
created_at`) · destroyed no room · created no Event · no queue rows invented · an ACTIVE label
with a past `expires_at` authorized nothing · repeat reconciliation emitted no duplicate audit ·
cross-path reconciliation emitted no duplicate audit.

## Closure interpretation (binding)

```
stored status = ACTIVE
expires_at   <= now()
entitlement   = false
```

means **logically expired, not yet materially reconciled**. This must never again be filed as an
authorization defect on the strength of the stored status alone. The entitlement predicate is the
security truth; `EXPIRED` is its bookkeeping, materialized at the next reconciliation.

## Founder device retest — NOT REQUIRED

No production executable code changed, so there is no new binary to observe. The live cutoff was
already witnessed in production on the real paid grant `98f52997`: at 18:54:28Z, 20 s past its
`expires_at`, the row still read `ACTIVE` with `expired_at` null and `updated_at` untouched, while
entitlement returned `false` / source `NONE` and the projection returned `FREE` with no activePass.

## Two instrumentation failures this build caught in its own harness

R0 printed a conclusion saying entitlement had refused while the same output showed
`entitled=true, 291s remaining` — a hardcoded string, not a measurement. §R was written from it.

The harness then reproduced the same class of failure: its first run printed **PASS three times on
empty values** returned by queries that had errored. `ok()` now fails on an empty measurement, and
the fixture aborts rather than running 30 void assertions. A verdict may only be computed from a
value that actually came back.

A third, smaller one: the concurrency re-arm selected a second grant before releasing the first,
violating `timed_pass_one_selected_per_account_idx`, so section P silently measured an AVAILABLE
grant instead of an expired ACTIVE one. The order is now explicit and asserted.

## Regression

Web 274 files / 3438 tests · lint clean · targeted §Q suites 6 files / 164 tests.
Harness: `scripts/verify-r4c-expiry.sh` — **0 failures**.
