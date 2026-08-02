# GATE B24 — END-TO-END HARNESS

Companion to [`BUILD24_LIVE_PLAYBACK_CLOCK_FREE_BALANCE_TRUTH_V1.md`](BUILD24_LIVE_PLAYBACK_CLOCK_FREE_BALANCE_TRUTH_V1.md).

**Why this exists as a script and not a README.** BUILD 20M shipped its Postgres integration
tests as README *instructions*. Nobody re-ran them, and a green-but-mistitled assertion
(`# 04:00 America/Los_Angeles attribution` → `'charged_window_start is local midnight'`) let the
FREE reset boundary sit four hours wrong for a whole build cycle. A gate you have to remember to
run by hand is not a gate.

---

## 1. Run it

```bash
cd bty-karaoke
bash supabase/tests/b24/run.sh          # build cluster → migrate → assert → destroy
KEEP=1 bash supabase/tests/b24/run.sh   # leave the cluster up for psql poking
```

Builds a **throwaway** PostgreSQL cluster on `127.0.0.1:54331`, applies the seven-migration chain
in order, re-applies the BUILD 24 migration to prove idempotency, runs three suites, and tears
the cluster down.

It never touches the linked Supabase project, the local `supabase start` stack, or any port those
use (`54321/54322/54421/54422`). Prerequisites: `initdb`, `pg_ctl`, `psql`, `node`.

### Expected

```text
# BUILD 24 authority                      76 passed, 0 failed
# BUILD 20M regression replay (lease)     72 passed, 0 failed
# BUILD 20M-R4 regression replay (grace)  71 passed, 0 failed
```

---

## 2. What the harness records

Per §11, at controlled instants:

| Required | Where |
|---|---|
| canonical request ID | `begin_v2` → `karaoke_requests.id`; anchor `requestId` |
| canonical playback state | `requests.status`; `activePlaybackCount` |
| `serverNow` | `karaoke_room_playback_authority.serverNow` |
| trusted duration | `segments.duration_seconds` (the exact `v_dur` the gate compared) |
| lease timing | `lease_ends_at`, `lease_seconds`, `karaoke_active_lease_ends_at` |
| persisted FREE balance | `..._entitlement_at_v2.remainingSeconds` |
| projected displayed FREE | `freeRemainingForDisplay` — **deliberately identical** to persisted |
| displayed current-song time | `projectSongClock` / `projectPlaybackClock` at injected instants |
| segment closure result | `end_v2` outcome + post-close entitlement |
| next-request result | the following `begin_v2` outcome |

Timelines covered: normal playback · finish · skip · auto-advance refusal · FREE exhaustion ·
Final Song Grace · client resume/reload.

---

## 3. Deterministic suites

| Suite | Command | Count |
|---|---|---|
| Postgres authority (B24) | `bash supabase/tests/b24/run.sh` | 76 |
| Postgres lease replay (20M) | (same script) | 72 |
| Postgres grace replay (20M-R4) | (same script) | 71 |
| Web clock projection | `npx vitest run src/domain/playback-clock.test.ts` | 39 |
| Web clock render | `npx vitest run "src/app/r/[slug]/dj/NowSingingClock.render.test.tsx"` | 13 |
| Web usage banner (D1/D2) | `npx vitest run "src/app/r/[slug]/dj/UsageBanner.render.test.tsx"` | 17 |
| Web full | `npm test` | 2044 |
| Native Host | `bash Tests/run.sh` | 1560 |
| Native Guest | `bash Tests/run-guest.sh` | 653 |

Every clock case runs on an **injected** clock. "15 seconds of playback" is a number passed to
the projection — no suite sleeps.

---

## 4. §9 coverage map

| §9 case | Where |
|---|---|
| active playback advances | `playback-clock.test.ts` "active playback advances" · `B24-B` |
| inactive playback does not advance | "inactive playback does not advance" · `B24-C` |
| request change resets projection | "request change resets projection" · `B24-D` |
| server poll reconciles drift | "server poll reconciles drift" · `B24-E` |
| background/foreground recalculates | "background/foreground and browser sleep" · `B24-F` |
| browser sleep recalculates | same |
| unknown duration remains honest | "unknown duration remains honest" · `B24-G` |
| negative values clamp to zero | "negative values clamp to zero" · `B24-H` |
| FREE never exceeds canonical | "FREE balance is not projected" |
| active lease does not double-charge | same + `window-truth` "charge 0 inside an open lease" |
| segment closure converges | `window-truth` "Finish does NOT refund the lease" |
| Final Song Grace converges | `window-truth` grace block (5 assertions) |
| FREE exhaustion is server-only | `window-truth` "exhausted FREE is refused" |
| 04:00 America/Los_Angeles boundary | `window-truth` D3 block + both DST transitions |
| client wall-clock change | "client wall-clock change does not corrupt projection" · `B24-F` |
| stale response cannot overwrite | "stale response cannot overwrite" · `B24-D` |

---

## 5. Device gates — NOT RUN

These need a real device or browser and a live deployment. **None has been performed.** The
deterministic column is what a command actually proved; it is not a substitute.

| Gate | Manual procedure | Deterministic half |
|---|---|---|
| **G1** Host Web | start a song; watch ≥15s without refreshing | render test: value changes 0:00 → 0:15, `남은 시간 2:27` |
| **G2** Mobile browser | repeat G1 in the supported mobile flow | shared code path with G1 |
| **G3** Native Host | repeat on device; compare against G1 | `B24-K`: VM advances 15s with no new response |
| **G4** Native Guest | join as Guest; compare with Host | `B24-G4`: identical projection; **no lease reaches a Guest** |
| **G5** Finish / auto-advance | let a song complete | clock `.idle` the instant the server reports no on-stage row |
| **G6** Skip | skip mid-song | same mechanism as G5; a new request resets the anchor immediately |
| **G7** Relaunch / sleep | background, foreground, sleep tab, refresh, relaunch | sleep + backwards-monotonic + clamp cases (`B24-F`) |
| **G8** Exhaustion + grace | ordinary exhaustion; one eligible grace; one non-eligible | **DB half proven** in `window-truth` |
| **G9** 04:00 boundary | *not needed* | **fully automated** — no real 04:00 wait |
| **G10** Full regression | *not needed* | **fully automated** — §3 |

### Device pre-conditions for G8

Reuse the BUILD 23 approach: a REAL backdated ACTIVE Timed Pass / a genuinely consumed FREE
balance in an isolated local Supabase — **never a server bypass**. BUILD 23-GATE proved a client
injection upstream of the network cannot gate a server contract; that finding stands.

---

## 6. Founder attestation

No gate in this document is founder-attested yet. When one is, record it as:

```text
G<N> — FOUNDER ATTESTED <date> · device/browser · <observation>
```

and leave the automated column untouched. A manually attested gate is never relabelled automated.
