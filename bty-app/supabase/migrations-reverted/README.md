# migrations-reverted — applied-then-reverted migrations

`supabase db push` does **not** scan this directory — only `supabase/migrations/`.
Files here were **applied to the remote**, then their feature code was reverted.

⚠ **Opposite semantics from `../migrations-hold/`.** Those are deferred /
not-yet-applied migrations whose forward path is to be *fixed and returned* to
`supabase/migrations/`. The files here are **already live** on the remote and
must **NOT** re-apply — the forward path is a `DROP`, not reactivation.

## Currently held (reverted)

| File | version | What it does |
|---|---|---|
| `20260525000000_signup_requests_approval_gate.sql` | 20260525000000 | Lane B `signup_requests` table + RLS (self-read) |
| `20260525000001_signup_requests_add_role_check.sql` | 20260525000001 | Lane B role-taxonomy CHECK on `signup_requests` |
| `20260525000002_signup_requests_backfill_existing_users.sql` | 20260525000002 | Lane B backfill of existing `auth.users` → `signup_requests` (15 rows, status=approved) |

## Why these are held (Lane B signup_requests — 2026-05-25, D-5)

These 3 were **successfully applied** to the shared Supabase remote during Lane B
email/password signup development (2026-05-24/25). The Lane B *code* was reverted
on 2026-05-25 (D-5) after the S2 diagnostic confirmed **OAuth-only** is the
intended architecture (my-page profile → `/admin/arena-membership` approval, not
email/password signup + `signup_requests`). Full forensic record:
`docs/archive/LANE_B_SIGNUP_APPROVAL_GATE.md`.

The `signup_requests` table is now **dormant**: no code reads or writes it
post-revert (verified: 0 references in `src/`). The 15 backfilled rows remain
(all status=approved) and are harmless.

## Forward path (Commander-gated, post-launch α)

1. Author a forward DROP migration (`DROP TABLE IF EXISTS public.signup_requests;`)
2. Apply via `supabase db push`
3. Verify table absent: `\dt signup_requests` returns nothing
4. Delete the 3 files in this directory
5. Optionally delete this README if no other reverted migrations exist
