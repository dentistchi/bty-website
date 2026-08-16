# BUILD 17 — Timed Access Pass Foundation V1

**Status:** server + web + Host-API + tests IMPLEMENTED, COMMITTED (`e7c1cab4`), migration
`20260728120000` APPLIED remotely, Worker DEPLOYED (Version `88712fff-6493-4dea-9061-94aa97f50514`).
Post-migration verification + production integrity reconciliation PASS; no test-account data
mutation. Native SwiftUI Admin UI + Commander device Gates A–H PENDING (handoff). Not
PASS/CLOSED until the device gates pass.

## What this build does

Manager issues a fixed-duration access pass (1h / 4h / 24h) to a **canonical Host account**.
The Host **selects** one. The pass **activates exactly once** — only when the server's
first-song lifecycle transition (`karaoke_begin_song`, reached via `/dj/start`) actually
commits. Selection alone never starts the clock; expiry is computed from server time.

No billing exists (no price, SKU, StoreKit, Stripe, Apple/Google Pay, promo, refund,
transfer, custom duration, active-pass pause/extend/force-end, multi-active).

## Measured baseline (read-only, all STOP conditions cleared)

- `/dj/start` → `ensurePlaying` → `beginSong('promote')` → **one atomic RPC**
  `karaoke_begin_song` (flip waiting→playing + open usage segment + FREE `upgrade_required`
  block, fail-closed). Holds room + `acct:<account>` advisory locks; resolves the canonical
  owner via `karaoke_room_owner_account`. YouTube handoff is best-effort **client** UI after
  the committed 200 — never inside the txn.
- FREE metering: `karaoke_free_minutes_entitlement_at` sums only **`metered`** segments →
  a pass-covered **non-metered** segment pauses the FREE meter with zero plan mutation.
- Plan authority (`change_karaoke_host_plan` / `karaoke_host_plan_assignments`) and the PRO
  Pilot tables are **untouched**.

## Data model — `20260728120000_karaoke_timed_access_passes.sql` (additive)

- `timed_access_pass_grants` — account-scoped; `pass_type`+`duration_seconds` pinned
  (3600/14400/86400); status `AVAILABLE|SELECTED|ACTIVE|EXPIRED|REVOKED`; per-status time
  invariants; `expires_at = activated_at + duration`. Partial-unique **one SELECTED** and
  **one ACTIVE** per account; unique issue idempotency key.
- `timed_access_pass_audit` — append-only (UPDATE/DELETE blocked by trigger); partial-unique
  **exactly one `ACTIVATED`** row per pass.
- `karaoke_event_usage_segments` — additive `pass_grant_id`, `metering_paused_by_pass`;
  the `metered` CHECK relaxed to `metered = (plan_snapshot='FREE' and metering_paused_by_pass=false)`
  (byte-identical for all existing rows).
- RPCs (service_role only, idempotency-keyed, audited): `issue_timed_access_pass`,
  `select_timed_access_pass`, `revoke_timed_access_pass`, `karaoke_timed_pass_state_at`/`_state`.
- `karaoke_begin_song` **CREATE OR REPLACE** (pass-aware): after the not-playing/canonical
  guards + plan resolution, under the held account lock — lazily expire ACTIVE-past-window
  passes; a valid ACTIVE pass **covers** the start (non-metered segment, no FREE block); a
  SELECTED pass is the **first-start activation candidate** that bypasses the FREE 0:00 block
  and, once the flip commits, flips SELECTED→ACTIVE (`activated_at`=server now, `expires_at`
  fixed) with exactly one `ACTIVATED` audit. **PRO owners never consume a pass.**

## Effective entitlement (§1.7)

`karaoke_timed_pass_state_at` (server) + pure `src/domain/timed-pass.ts`:
`PRO base → PRO`; `FREE base + valid ACTIVE pass → TIMED_ACCESS`; else `FREE`. A SELECTED
pass grants nothing on its own.

## Surfaces

- Service: `src/lib/timed-pass.server.ts`. Validation: `src/lib/validation.ts`.
- Manager API: `POST /api/manager/timed-passes/issue`,
  `POST /api/manager/timed-passes/grants/[passGrantId]/revoke`,
  `GET /api/manager/timed-passes/[accountId]` (bty_mgr operator session).
- Host API: `GET /api/host/timed-passes`, `POST /api/host/timed-passes/select`
  (session-derived account; accountId never read from the body).
- Manager console: `src/app/admin/host-plans/TimedAccessPassSection.tsx` inside the Host
  plan detail sheet (issue / revoke / inventory / audit; PRO accounts show issuance blocked).

## Tests (all green)

`src/domain/timed-pass.test.ts` (12), `src/lib/timed-pass.server.test.ts` (12),
`src/lib/timed-pass-migration.schema.test.ts` (13), plus route tests for issue + select.
Full suite: 156 files / 1440 tests pass; `tsc --noEmit` clean.

## Deploy runbook (requires human approval — outward + hard to reverse)

1. **Migration-first**: apply `20260728120000_karaoke_timed_access_passes.sql` to the isolated
   bty-karaoke Supabase project (ref `zycwaqignioawtqynopj`) via `supabase db push --linked`
   or the SQL Editor. It CREATE-OR-REPLACEs `karaoke_begin_song` — depends on 20260726120000
   (shadow metering) already being applied.
2. Deploy the Worker (`npm run cf:build` → `npm run cf:deploy`).
3. Served-code check: the four RPCs exist; Manager `/admin/host-plans` detail shows the Timed
   Access Pass section; `GET /api/host/timed-passes` returns 401 unauth.

## Commander device gates (PENDING — native repo + real device)

Native SwiftUI Admin selection/active/expired UI (§5) lives in the **separate iOS repo**
(BTYNorebangAdmin). Gates:

- **A** Manager issuance (server+web READY to exercise): FREE test account, issue 1h → plan
  stays FREE, 1 AVAILABLE, 1 audit, no pilot request created.
- **B** Host selection durability (native).
- **C** No premature activation — SELECTED survives QR/foreground/relaunch/failed-start; no
  `activated_at`/`expires_at`.
- **D** Atomic first-song activation at FREE 0:00 → ACTIVE, `expires_at` exactly +duration,
  one YouTube handoff, no duplicate activation/audit.
- **E** Active durability (native) — relaunch restores ACTIVE, server-truth remaining,
  extra starts don't extend expiry.
- **F** Expiry enforcement (controlled clock) — current song not force-stopped, next start
  blocked, underlying FREE remaining preserved, another AVAILABLE pass selectable.
- **G** Multi-pass inventory — only the selected pass activates; others stay AVAILABLE.
- **H** Read-only reconciliation — plan/pilot unchanged, expected grant counts, one
  selected-or-active per account, one activation audit per activated pass, Room/Event/Queue
  intact, app fully native, no payment/StoreKit/Stripe/WebView.
