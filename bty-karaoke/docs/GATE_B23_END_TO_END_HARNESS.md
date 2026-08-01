# BUILD 23 — G1 END-TO-END GATE HARNESS

## Why this exists

The BUILD 23 native client injection (`-BTYAdmissionFailureInjection`) returns **upstream of
`POST /dj/pass-turn`**. It synthesizes `completed:true` without the server completing anything, so
it can never establish the four properties G1 is actually about:

1. the current song completed **canonically on the server**
2. the blocked next request stayed **waiting + Ready**
3. the response carried a **real, server-produced `blockedRequestId`**
4. polling **converged** to the correct post-completion state

The client injection is therefore retained only as a **client-rendering sub-gate** (C1/C2/C3), and
the app refuses to report it as G1 — see `GateB23Validity` in `PlayHandoff.swift`.

## What this harness is

An **isolated authority**: the real Worker code, the real migrations, the real RPCs, over a **local
Postgres**, where a **real ACTIVE Timed Pass** whose remaining window is shorter than the next song
makes `karaoke_begin_song_v2` return `pass_insufficient` through its **ordinary production logic**.

**There is no debug bypass in the server anywhere.** The production Worker is untouched. The only
difference from production is the *data*.

The short pass window is produced by **backdating `activated_at`**, because
`timed_pass_expiry_math_chk` forces `expires_at = activated_at + duration_seconds`. A ONE_HOUR pass
activated 50 minutes ago is a genuinely ACTIVE pass with ~10 minutes left — every constraint, index,
status machine and RPC is the real one.

## Safety

`scripts/gate-b23-seed.mjs` **refuses to run** against:

- the production project ref `zycwaqignioawtqynopj` — **even with** `GATE_B23_ALLOW_REMOTE=1`
- any non-local host unless `GATE_B23_ALLOW_REMOTE=1` is set for a dedicated staging project

Every row it writes carries the `gate-b23` marker; `npm run gate:b23:clean` removes exactly those
rows. No production data is ever read, written, or deleted.

## Run it

```bash
# 1. Local authority (ports remapped in supabase/config.toml so they never collide with
#    another local Supabase project).
cd bty-karaoke
supabase start -x studio,imgproxy,inbucket,realtime,storage-api,edge-runtime,logflare,vector,supavisor,mailpit
supabase db reset --local            # applies all 35 real migrations

# 2. Seed the fixture (prints the DJ credential and the EXPECTED blockedRequestId)
export KARAOKE_SUPABASE_URL="http://127.0.0.1:54421"
export KARAOKE_SUPABASE_SERVICE_ROLE_KEY="$(supabase status --output json | python3 -c 'import sys,json;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')"
npm run gate:b23:seed

# 3. Real server against the local authority (binds 0.0.0.0 → reachable from the device)
KARAOKE_RATELIMIT_SECRET=gate-b23 npm run dev
```

### Device run

Xcode → Edit Scheme → Run → Arguments, add:

```
-BTYAPIBaseURL      http://<your-mac-LAN-ip>:3002
```

Confirm at startup:

```
[GATE-B23] api-base=<your-mac-LAN-ip>      # NOT `production`
```

Then tap 현재 곡 완료 and read the `[GATE-B23]` block. **Do not arm
`-BTYAdmissionFailureInjection` for this run** — the whole point is that the real server produces
the refusal.

`-BTYAPIBaseURL` is Debug-only: `DebugAPIBaseOverride.resolved` is a compile-time `nil` in Release,
so a shipped build can never be pointed anywhere.

## G1 acceptance (verified 2026-08-01 on the local authority)

```
POST /api/rooms/gate-b23/dj/pass-turn
HTTP 200
{
  "ok": true,
  "completed": true,
  "promoted": null,
  "reason": "pass_insufficient",
  "blockedRequestId": "<the seeded next request id>",
  "message": "남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.",
  "durationSeconds": 880,
  "remainingSeconds": 590,
  "passExpiresAt": "..."
}
```

Server-side post-conditions (read straight from Postgres):

| Check | Result |
|---|---|
| current song | `completed`, `completed_at` set |
| blocked next request | `waiting`, `ready_at` set |
| usage segment | closed, `close_reason='completed'` |
| lease rows for the refused start | **0** — fail-closed, no lease written |
| timed pass | still `ACTIVE`, untouched |
| DJ queue poll | converged to the single blocked waiting row |

## Negative control (equally important)

A harness that can only produce one answer proves nothing about the other:

```bash
GATE_B23_NEXT_DURATION_SECONDS=200 npm run gate:b23:seed
```

200s < ~600s remaining → the **same** fixture must promote normally:

```json
{ "ok": true, "completed": true, "promoted": { "id": "…" }, "reason": "promoted" }
```

with the next request now `playing` and **one** real lease row written. Verified.

## Teardown

```bash
npm run gate:b23:clean
supabase stop --project-id bty-karaoke-gate-b23
```

## What this harness still does NOT cover

- `duration_unavailable` (G2/G3/G4) — reachable on this authority by seeding an over-limit
  `karaoke_video_durations` row (`too_long`) or omitting the row with no `YOUTUBE_API_KEY`
  (`lookup_failed` / `not_configured`). Not yet exercised.
- Real Apple StoreKit purchase → pass activation. Out of BUILD 23 scope entirely.
