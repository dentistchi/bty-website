# BTY Launch Operations Reference

Single source of truth for launch + ongoing operations. Created 2026-05-26 (D-4 afternoon) after launch reality correction. Supersedes prior assumptions about a 20-user pre-planned invite cohort.

## Launch model (corrected)

BTY is an internal leadership/practice-training system. Launch model is **organic OAuth + admin-approve**, not pre-planned invite distribution.

- User signs in via Google OAuth at landing page
- User submits `arena_membership_request` (job_function, joined_at, leader_started_at)
- Commander (admin) approves via `/admin/arena-membership`
- User gains Arena access

No email invite mechanism. No pre-created cohort. No public self-signup.

## Auth surface (locked 2026-05-26)

OAuth is the only sanctioned auth entry. Self-registration (email/password) is **disabled at two layers**:

- **UI**: AuthGate "회원가입" toggle hidden when `NEXT_PUBLIC_BTY_ALLOW_SELF_REGISTER` is unset
- **Backend**: `/api/auth/register` returns 410 Gone when `BTY_ALLOW_SELF_REGISTER` is unset

Both env vars are absent in production (verified). To temporarily re-enable for testing, set BOTH (not one).

Supabase email confirmation is ON (verified 2026-05-26 via Dashboard). This serves as a third defense layer: any account created via signUp must confirm email before sign-in.

## Access gates

All surfaces require sign-in. Beyond that:

- **Arena**: requires consent + approved `arena_membership_request`
- **Foundry**: requires consent (no membership gate)
- **Center**: requires consent (no membership gate)

Gate order in middleware: auth → onboarding → consent → forced-reset → membership → contract.

## Locale protocol

Default locale is **EN**. Middleware is path-based; no Accept-Language negotiation.

- `/`, `/en`, `/en/*` → EN
- `/ko`, `/ko/*` → KO
- Korean-audience users: Commander shares `/ko/...` links explicitly
- Users can switch locale via LangSwitch (hidden on `/admin/*`)
- EN/KO consent parity achieved (Phase 2.5)

## Admin authority

- Admin = membership in `BTY_ADMIN_EMAILS` env allowlist (`lib/authz.ts`)
- `approved_by` populated with admin email (lowercased)
- **Critical**: if `BTY_ADMIN_EMAILS` is unset, any authenticated user can approve membership (`authz.ts:53` dev fallback). Env var is verified set on `bty-arena-staging` worker (repo-level: `wrangler.toml` `[vars]` binding present since initial commit + Dashboard-side confirmation, 2026-05-26).
- No per-practice/tenant admin concept — single global allowlist

## Production users (snapshot 2026-05-26)

| UID prefix | Email | Role |
|---|---|---|
| ee9d2075 | ywamer2022@gmail.com | Commander primary (tier 1) |
| 38ce28d2 | ikendo1@gmail.com | Commander (tier 1, BTY test ID) |
| 52e543cc | hanbitchi@gmail.com | Commander rehearsal (tier 27, STAB evidence) |
| 9587a44e | chihanbit7@gmail.com | Commander variant (tier 0) |
| 2322beb7 | ddshanbit@gmail.com | Commander variant (tier 0) |
| 85bd8f1f | hanbitdds@gmail.com | Commander variant |

E2E fixtures + recall-test accounts: not user-facing. External approved users: 0 (organic post-launch).

## Tier semantics

`arena_profiles.tier` = cumulative count of DONE `arena_runs` for the user. Validated 2026-05-26 (hanbitchi: 27 DONE runs, tier=27; ikendo1/ywamer2022: tier=1). Not a discrete enum.

## Deployment

- Single staging worker (`bty-arena-staging`) backs production. No separate prod worker. Single Supabase project (us-east-1, NANO tier).
- DB mutations on staging worker = production-effective.
- Worker live: `47dca7a4` (as of 2026-05-26 D-4 close)
- Push and deploy held until D-1 (2026-05-29) final

## Critical incident handling

- **Rollback worker**: `wrangler rollback --version <UUID>` to prior version. Canonical safe anchor: `a27781f5` (post-STAB-03-A).
- **Admin allowlist leak**: re-set `BTY_ADMIN_EMAILS` immediately; revoke compromised email's Supabase OAuth access if Google account compromised.
- **Unintended self-signup**: env var leak check (`BTY_ALLOW_SELF_REGISTER` must be absent).

## Post-launch lanes (deferred)

- LRI Certified Admin sub-tab + approval flow
- Wrangler 4.85.0 → 4.94.0 upgrade
- STAB-07-P0 Stage 8 mid-check + late-stage gate
- Cross-border data transfer counsel review (LEGAL_FOLLOWUP_001)
- Re-acceptance flow for future consent revisions
- R2/R3 rollback integrity certification
- 12-axis architecture review deferred items
- Lane 6 (employee handbook addendum) — Commander own lane

## Verification provenance (D-4 2026-05-26)

Items verified this session:

- Auth surface two-layer disable: Claude Code session commit `8822e4e9`
- Wrangler env vars absent (`BTY_ALLOW_SELF_REGISTER`, `NEXT_PUBLIC_BTY_ALLOW_SELF_REGISTER`): `wrangler.toml` grep
- `BTY_ADMIN_EMAILS`: repo-VERIFIED (`authz.ts` + `wrangler.toml` `[vars]` binding) + runtime-VERIFIED (Cloudflare Dashboard check by Commander)
- Supabase email confirmation: ON (Commander Dashboard check)
- Worker live version `47dca7a4`: `wrangler versions list`
- Rollback anchor `a27781f5`: release-gate doc + wrangler history

Items pending Commander DB-side verify (non-blocking):

- Production users table 3 UID prefixes (`38ce28d2`/ikendo1, `2322beb7`/ddshanbit, `85bd8f1f`/hanbitdds) — Commander own accounts per Commander assertion
- Tier semantics empirical validation (hanbitchi `distinct_scenarios_done=17` vs `tier=27` cumulative interpretation) — repo not the authority on this; DB query results 2026-05-26 confirm relationship
