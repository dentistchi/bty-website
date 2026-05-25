> **ARCHIVED 2026-05-25 (D-5)**
> Lane B email/password signup flow was reverted after S2 diagnostic
> confirmed OAuth-only intended architecture. This document preserves
> the original spec/governance record for forensic purposes.
> Current state: see `bty-app/supabase/migrations-reverted/README.md`

---

# Lane B — Signup Approval Gate

**Purpose**: Pre-launch external-signup approval gate (Q1-a all-block). New external user signups land in `signup_requests` with `status='pending'`; admin reviews and approves/rejects. Middleware blocks non-approved users from app access.

**Path**: α (minimum role for approval). Region / tenure / training authority / specialty detail are deferred to a post-launch profile lane.

**Scope artifacts**:
- DB: `public.signup_requests` (Step 1 substrate + Step 2b CHECK + Step 2b backfill of 15 existing users as `approved` / `role='unspecified'`)
- Code: `register/route.ts` (INSERT path), `middleware.ts` (gate at L283)
- UI: `/[locale]/bty/signup`, `/[locale]/pending-approval`, `/[locale]/admin/signup-approvals` (Step 3, pending)

**Step trail**:
- Step 1 substrate: inner `17d4d989` / outer `73eaf4f`
- Step 2b code + 2 migrations + test mock: inner `8d30a59a` / outer `e9ca973`
- Step 2c DB apply: this anchor
- Step 3 UI: pending
- Step 2d worker deploy: pending (after Step 3)

**Forensic note (Step 2c)**: The earlier PGRST205/42P01 error was caused by probing `signup_requests` before the Step 1 substrate migration had been applied; file/DB/tracking drift was not present. Resolution path: standard `supabase db push` applied all 3 Lane B migrations in timestamp order.
