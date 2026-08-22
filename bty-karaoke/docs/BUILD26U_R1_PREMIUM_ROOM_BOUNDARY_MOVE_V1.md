# BUILD 26U-R1 — PREMIUM ROOM BOUNDARY MOVE V1

**Status:** IMPLEMENTED / NOT DEPLOYED. Migration authored + applied locally only.
Production untouched. Commerce remains OFF (`is_active = false` on all three products).

---

## 1. What changed, in one sentence

A Timed Access Pass stopped meaning *"time in which YouTube videos may be played"* and started
meaning *"wall-clock time in which this account may run a hosted BTY karaoke-room session"*.

---

## 2. The R0 correction this build rests on

BUILD 26U-R0 reported that `karaoke_begin_song_v2` still carried the video-duration paid gates.
It does not, and has not since **BUILD 26T-R1B-R6-R1A (E1, migration `20260817120000`)**, which
removed `pass_insufficient`, `upgrade_required`, the FREE grace branch, lease minting, the
900-second ceiling, the pass expiry sweep **and the SELECTED→ACTIVE activation**. R0 read the
`20260803` definition of that function without checking for later redefinitions of the same name.

E1 is live: production usage segments from 2026-08-18 onward are `metered=false` with all five
lease columns NULL, while rows up to 2026-08-16 carry the old metered shape.

**The consequence R0 missed, and R1's actual starting problem:** E1 removed the only activation
site in the product. A purchased grant could reach `SELECTED` and could never reach `ACTIVE`
(`v_activate` is initialised false in `begin_song_v2` and never assigned). The paid product was
inert. R1 gives activation a new and correct home.

---

## 3. The new authority

```
verified Apple purchase       karaoke_apple_purchases (VERIFIED)         26P / 26R-R2
  → fulfilled timed grant     fulfil_apple_purchase                      26S-R1
  → AVAILABLE / SELECTED      select_timed_access_pass                   BUILD 17
  → ACTIVE                    karaoke_start_premium_room_session         26U-R1  ← NEW
  → active hosted Event       karaoke_events.status = 'active'
  → room capabilities         premiumRoomCapabilities(entitled)
```

`migration 20260822120000` adds three functions and nothing else:

| Function | Volatility | Role |
|---|---|---|
| `karaoke_premium_room_entitlement_at(account, as_of)` | STABLE | the ONE read: PRO / ACTIVE_PASS / SELECTED_PASS / NONE |
| `karaoke_room_premium_entitlement_at(room, as_of)` | STABLE | room → canonical owner → entitlement |
| `karaoke_start_premium_room_session(room, name, code, slug, by)` | VOLATILE | entitlement + activation + Event, atomically |

### The write order is the design

1. **locks** — account advisory lock FIRST, then room. Identical ordering to `begin_song_v2`, so
   the two cannot deadlock against each other.
2. **idempotency** — a live Event returns `already_live` and activates NOTHING. A double-tap can
   never spend a second pass.
3. **sweep** — expire past-expiry ACTIVE grants under the lock. Truthful regardless of what
   follows, so it may survive a later refusal.
4. **resolve** — refuse HERE, before anything is created and before any grant is activated.
5. **INSERT event** — a `public_code` / `guest_slug` collision returns `code_conflict` for the
   caller to retry. Activation has not happened yet, so a collision costs the customer nothing.
6. **ACTIVATE** — last. A lost race **raises** rather than returning, rolling the Event back with
   it: never open a session whose clock failed to start.

`expires_at = now + (duration_seconds + carryover_seconds)` — exactly the arithmetic
`timed_pass_expires_matches_duration` enforces, so 26M-R2 carryover is honoured identically.

---

## 4. Local behavioural proof (isolated Postgres, all 51 migrations applied in order)

| Gate | Result |
|---|---|
| G1 no pass → start | `premium_room_required`, 0 events created |
| G2 AVAILABLE grant → start | `premium_room_required` — a grant is not entitlement |
| G3 SELECTED grant → read | `entitled:false, armable:true, effectiveWindowSeconds:3600` |
| G4 SELECTED → start | `ok`, `activated:true`, grant ACTIVE, audit `SELECTED→ACTIVE by premium_room_session` |
| G5 double-tap | `already_live`; ACTIVE grants 1, events 1, activations 1 |
| **G6 13s room time left, 600s video → start song** | **`ok`** — admitted, pass untouched, segment `metered=false` |
| G7 time reaches zero | entitlement `NONE`; `end_karaoke_event` → event `ended`, song `skipped`, **room still open** |
| G7b start after expiry | `premium_room_required`, no new event |
| G8 lapsed ACTIVE row | swept to `EXPIRED` by the next session start, audited `SYSTEM` |
| G9 carryover 4h + 1234s | window `15634s` — exactly base + carried |

**G6 is the load-bearing one.** With 13 seconds of BTY Room time and a ten-minute video, the song
was admitted and the pass was not consulted. A video's length is no longer an input to anything.

Migration re-applied 3× with no error (idempotent).

---

## 5. What R1 removed

| Removed | Why |
|---|---|
| `beginSong`'s fail-closed duration pre-check | E1 removed the SQL half; this TS half above the RPC survived the cutover and still refused any video over 15:00 or of unresolvable length. Resolution is now best-effort, feeding the clock only. |
| `playback.lease.*` (5 strings) + both render sites | "YouTube에 허용된 재생 시간이에요" / "%@ of external playback left" — a countdown of purchased YouTube playback time. Dead since E1. |
| `admission.pass_insufficient.*`, `admission.upgrade_required.*` (9 strings) | Priced a specific video by its length; told Hosts to pick a shorter song or upgrade to play one. |
| `UsageBanner.tsx`, `UsageBannerView.swift` + render sites | Counted down the retired 900-second allowance; its zero states claimed "다음 곡은 시작할 수 없어요" and offered an upgrade to "start new songs" — both false since E1. |
| `startNewEvent` (unconditional) | An ungated way to open a hosted session is an ungated way to obtain the paid product. Replaced by `startHostedRoomSession`. |

Constant NAMES (`PASS_INSUFFICIENT_COPY`, `upgradeRequiredCopy`, `AdmissionCopy.passInsufficient`)
survive with collapsed VALUES: three routes and two clients still reference them on branches the
server can no longer reach, and collapsing the value removes the meaning from all of them at once
without editing proven decode machinery.

---

## 6. Retained deliberately

`karaoke_usage_policy` (900 / enforcement_enabled / lease_write_mode), the lease columns on
`karaoke_event_usage_segments`, `karaoke_video_durations`, `domain/usage.ts`, `UsageProjection.swift`
and `/dj/usage` are **untouched dormant history**. Nothing reads them to authorize a start.
Deleting historical accounting to tidy a boundary move would destroy the record of what was
charged before it.

---

## 7. Known residual — carried to R2

The **15-minute queue-length rule** on guest submit (`too_long` → "더 짧은 버전을 선택해 주세요")
and the matching `blocked` state on the web result card are still live duration predicates. They
gate entry to the BTY shared queue, are identical for paying and non-paying rooms, and sell
nothing — so they are not UX-1 violations and were left in place rather than silently widened
into R1. The free **Open on YouTube** action is unconditional and works for those videos.

---

## 8. Test totals

| Suite | Before | After |
|---|---|---|
| Web (vitest) | 262 files / 3233 | 266 files / **3278** |
| Native host | 2788 passed, 3 failed | **3000** passed, 3 failed |
| Native guest | 1069 | **1069** |

The 3 native failures are **pre-existing** (26F-1 / 26F-2 / 26F-16b: DEBUG gate-harness literals
auto-extracted into the catalog with no localizations). Their orphan lists are byte-identical
before and after this build.

8 mutants applied, 8 killed.
