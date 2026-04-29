# BTY identity flow — Supabase (Arena → Growth → My Page)

## Assumptions

- Authenticated users have `auth.users` + Supabase session cookies on `/api/*` (see `requireUser` in `src/lib/supabase/route-client.ts`).
- **Identity metrics** on My Page use `computeMetrics` / `computeLeadershipState` / `mergeLeadershipReflectionLayer` only — **not** Arena weekly/core XP ledger or leaderboard ranking (those stay in existing Arena tables/APIs).
- Guest / unauthenticated flows may keep using `localStorage` until the client switches to these routes.

## Schema

Migration: `supabase/migrations/20260413000000_bty_identity_flow.sql`

| Table | Purpose |
|-------|---------|
| `bty_arena_signals` | Sealed Arena decision fingerprint (`traits`, `meta`, choices). |
| `bty_reflection_seeds` | Arena-generated reflection prompt (audit + Growth handoff). |
| `bty_reflection_entries` | Completed reflection writing. |
| `bty_recovery_entries` | Recovery / re-entry commitments (interpretive record). |

RLS: **SELECT** and **INSERT** on own `user_id` only (`auth.uid() = user_id`; policy names match the SQL Editor baseline, e.g. `users can read own arena signals`). Legacy policy names from an earlier repo revision are dropped in the same migration for idempotency.

## API routes (Next App Router)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/bty/arena/signals` | Insert signal + insert seed (`buildReflectionSeed` on server). |
| `GET` | `/api/bty/growth/seeds/latest` | Latest seed for Growth UI. |
| `POST` | `/api/bty/growth/reflections` | Save reflection entry (optional `seedId`). |
| `GET` | `/api/bty/growth/history` | `{ reflections, recoveryTriggered }` (same compound logic as My Page). |
| `POST` | `/api/bty/growth/recovery` | Save recovery entry. |
| `GET` | `/api/bty/my-page/state?locale=en|ko` | `{ metrics, leadershipState, recoveryTriggered, recoveryEntryCount }`. |

Supabase in Route Handlers: `src/lib/supabase/server.ts` (`createSupabaseRouteClient` — `getAll` / `setAll` for `@supabase/ssr`).

Server helpers: `src/lib/bty/identity/*` (`fetchIdentityRows`, `getMyPageIdentityState`, `saveArenaSignalWithSeed`, `mappers`, `validation`).

## Business rules (identity)

- **Season / leaderboard:** Not read or written by these routes.
- **Core vs weekly XP:** Not duplicated here; `metrics.xp` is **identity trace XP** from `computeMetrics(signals)` only.
- **UI:** Responses are **interpreted** `leadershipState` — no raw dump-first contract in API JSON (fields are labels/copy, not “scores to brag”).

## Edge cases

- **401:** No session — all routes return `{ error: "UNAUTHENTICATED" }` with cookie merge headers as in other Arena APIs.
- **Double POST arena/signals:** Creates duplicate rows (no idempotency key in v1).
- **Seed vs entry:** `seed_id` on reflection is optional; orphan entries allowed if seed deleted (`ON DELETE SET NULL`).
- **Locale:** My Page state requires `locale` query for i18n copy; default `en`.

## Test plan

1. Run migration on Supabase project.
2. Sign in; `POST /api/bty/arena/signals` with valid body → 200 + `signalId`, `seedId`.
3. `GET /api/bty/growth/seeds/latest` → `seed` matches latest insert.
4. `POST /api/bty/growth/reflections` with `seedId` → 200 + `id`.
5. `GET /api/bty/my-page/state?locale=ko` → `metrics` + `leadershipState` change as more signals/reflections exist.
6. `GET /api/bty/growth/history` → `recoveryTriggered` aligns with compound recovery helper.

## Client integration (implemented)

| Area | Client helper | Fallback (guest / offline) |
|------|----------------|---------------------------|
| Arena Result | `saveArenaSignal` → `POST /api/bty/arena/signals` | `pushSignalIfNew` + `pushReflectionSeedIfNew` |
| Growth airlock | `getLatestReflectionSeed` + `getGrowthHistory` | local seeds + `shouldShowCompoundRecovery` |
| Reflection write | `saveReflectionEntry` | `pushReflection` |
| Growth history | `getGrowthHistory` | `loadReflections` + compound helper |
| Recovery | `getMyPageState` (signals+reflections for prompt), `saveRecoveryEntry` | local load + `pushRecoveryEntry` |
| My Page overview | `getMyPageState` | `loadSignals` / `loadReflections` + domain merge |

Files: `src/features/arena/api/saveArenaSignal.ts`, `src/features/growth/api/*.ts`, `src/features/my-page/api/getMyPageState.ts`.
