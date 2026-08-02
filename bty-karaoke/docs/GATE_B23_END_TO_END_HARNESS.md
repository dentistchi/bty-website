# BUILD 23 — END-TO-END GATE HARNESS

> **CLOSED 2026-08-02 — Gates G1–G11 PASS, including G8 Safari PASS and G8 Chrome PASS.**
> BUILD 23 — AUTO-ADVANCE ADMISSION FAILURE HONESTY V1 is **PASS / CLOSED**.
> Canonical closure record: [`BUILD23_AUTO_ADVANCE_ADMISSION_HONESTY_V1.md`](BUILD23_AUTO_ADVANCE_ADMISSION_HONESTY_V1.md).
> **Production remained unchanged throughout** — every G2/G3/G4/G8 fixture ran against the local
> authority described below; see §4 of the closure record for the enforced guarantees.
>
> This document stays as the reproducible harness, not as an open work item.

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

## G8 — WEB DJ Console parity (browser, same authority)

G1–G4 exercise the **native** client. G8 asks the other half of BUILD 23: does the **web** DJ
Console render the same honest refusal? Same isolated authority, same real Worker code, same real
`/dj/pass-turn` — only the client differs. **No browser-side or client-side synthetic response is
involved: the refusal is produced by `karaoke_begin_song_v2`'s upstream duration classifier.**

**Result: G8 Safari PASS, G8 Chrome PASS (2026-08-02).**

`too_long` is the reason of choice for a browser run because it is classified in `beginSong`
**before** any entitlement/pass check, so — unlike G1 — **there is no deadline**. The fixture stays
armed indefinitely and the operator can take their time.

```bash
# Authority (already running for G1–G4; ports from supabase/config.toml)
export KARAOKE_SUPABASE_URL="http://127.0.0.1:54421"
export KARAOKE_SUPABASE_SERVICE_ROLE_KEY="$(supabase status --output json \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')"

npm run gate:b23:rearm:g2                        # arm too_long
KARAOKE_RATELIMIT_SECRET=gate-b23 npm run dev    # real server, port 3002
```

Exporting **both** Supabase vars before `next dev` makes `hydrateFromDevVars()` early-return, so
`.dev.vars` — which points at production — is never read.

Browser: `http://localhost:3002/r/gate-b23/dj` → **Use host code instead** → `gate-b23-dj-secret`
→ press **▶ 다음 곡 재생 exactly once**.

Verified over HTTP on this authority (2026-08-02):

```json
{"ok":true,"completed":true,"promoted":null,"reason":"duration_unavailable",
 "blockedRequestId":"<the seeded next request id>","durationFailureReason":"too_long",
 "message":"이 영상은 너무 길어요 (15분을 넘습니다). 노래는 대기열에 그대로 있습니다.\n더 짧은 버전을 선택해 주세요."}
```

| Check | Result |
|---|---|
| current song | `completed`, `completed_at` set |
| blocked next request | still `waiting`, `ready_at` intact |
| usage segment | the current song's closed `close_reason='completed'`; **no second segment** |
| lease columns for the refused start | **none** — `lease_ends_at`/`lease_seconds`/`charged_window_*` all null, and no row exists for the blocked request at all |

Web-specific acceptance, on top of the server post-conditions:

- the red banner carries the **server's** two-line `too_long` copy (`whiteSpace: pre-line`) with a
  `data-admission-block="<blockedRequestId>"` attribute and a 확인 button
- the false sentence **`다음 준비된 참가자를 기다리는 중이에요.`** must NOT appear — that is exactly
  the `not_promoted` branch BUILD 23 removed this case from
- the notice **survives the 4s poll** (`reconcileAdmissionBlock` returns the same object while the
  request is still queued) and clears only on 확인, on a successful start of that same request, or
  when the request leaves the canonical queue (⋯ → 곡 빼기)
- no YouTube navigation: the console tab never navigates, and no `bty-player-command` is posted.
  The web path does open the **same-origin** BTY Player tab synchronously inside the click gesture
  (`playerHref` = `/r/gate-b23/player`) and `closePlayerOnFailure()` closes it again when the
  refusal lands — so start the run with **no Player tab already open**, otherwise a pre-existing
  one is left in place (it still receives no play command).

## Fixture index

| Command | Gate | Reason produced |
|---|---|---|
| `npm run gate:b23:seed` | G1 | `pass_insufficient` — real backdated ACTIVE Timed Pass, ~14 min left, next song 900s |
| `npm run gate:b23:rearm` | G1 | re-arm without dropping paired devices |
| `npm run gate:b23:rearm:g2` | G2 / G8 | `duration_unavailable` / `too_long` — cached 8917s duration, **no deadline** |
| `npm run gate:b23:rearm:g3` | G3 | `duration_unavailable` / `lookup_failed` — needs `GATE_B23_UPSTREAM_FAULT=lookup` |
| `npm run gate:b23:rearm:g4` | G4 | `duration_unavailable` / `quota_exceeded` — needs `GATE_B23_UPSTREAM_FAULT=quota` |
| `npm run gate:b23:g3:clear` | G3/G4 recovery | restores the cached duration so a deliberate Start succeeds from cache |
| `npm run gate:b23:clean` | — | removes exactly the `gate-b23`-marked rows |

## What this harness still does NOT cover

- Real Apple StoreKit purchase → pass activation. Out of BUILD 23 scope entirely.
- `video_unavailable` and `not_configured` duration classifications. Both share the G2/G3 seams
  (cached-row state and upstream fault) and neither was required by G1–G11.
