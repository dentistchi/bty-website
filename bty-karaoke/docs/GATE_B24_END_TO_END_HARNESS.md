# GATE B24 — END-TO-END HARNESS

**Status: all gates resolved — BUILD 24 PASS / CLOSED 2026-08-02.**
G1, G3–G8 Founder-attested · G2 deferred / non-blocking · G9, G10 automated.

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

Counts below are the **closure re-run of 2026-08-02**, on the shipped trees (`abece404` web ·
`7a8a6b3` native build 79). The "at implementation" column is the pre-correction baseline.

| Suite | Command | Count | At impl. |
|---|---|---|---|
| Postgres authority (B24) | `bash supabase/tests/b24/run.sh` | **76** | 76 |
| Postgres lease replay (20M) | (same script) | **72** | 72 |
| Postgres grace replay (20M-R4) | (same script) | **71** | 71 |
| Web clock projection | `npx vitest run src/domain/playback-clock.test.ts` | 39 | 39 |
| Web clock render | `npx vitest run "src/app/r/[slug]/dj/NowSingingClock.render.test.tsx"` | 13 | 13 |
| Web usage banner (D1/D2) | `npx vitest run "src/app/r/[slug]/dj/UsageBanner.render.test.tsx"` | 17 | 17 |
| Web full | `npm test` | **2071** (200 files) | 2044 |
| Native Host | `bash Tests/run.sh` | **1631** | 1560 |
| Native Guest | `bash Tests/run-guest.sh` | **653** | 653 |
| Native Debug / Release | `xcodebuild … -destination 'generic/platform=iOS'` | **BUILD SUCCEEDED** ×2 | ✓ |

The web and Native Host increases are the G1 and G3 corrections' own coverage
(`admission-copy.g1.test.ts`, `UsageBanner.render.test.tsx`, `build24G3EntitlementCopyTests`),
not a re-count of existing cases.

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

## 5. Device gates — RESOLVED

The upstream block recorded here in earlier revisions (production migration not applied) is
**RESOLVED**: migration `20260807120000` is live, Worker `dca14ffc` serves 100%, and the gates
below were run against that stack. See §7 of
[`BUILD24_LIVE_PLAYBACK_CLOCK_FREE_BALANCE_TRUTH_V1.md`](BUILD24_LIVE_PLAYBACK_CLOCK_FREE_BALANCE_TRUTH_V1.md).

| Gate | Result | Manual procedure | Deterministic half |
|---|---|---|---|
| **G1** Host Web | **PASS — FOUNDER ATTESTED** (after correction `abece404`) | start a song; watch ≥15s without refreshing | render test: value changes 0:00 → 0:15, `남은 시간 2:27` |
| **G2** Mobile browser | **DEFERRED / NON-BLOCKING** | not run — see below | shared code path with G1 |
| **G3** Native Host | **PASS — FOUNDER ATTESTED** (failed build 78 · passed build 79, `7a8a6b3`) | repeat on device; compare against G1 | `B24-K`: VM advances 15s with no new response |
| **G4** Native Guest | **PASS — FOUNDER ATTESTED** | join as Guest; compare with Host | `B24-G4`: identical projection; **no lease reaches a Guest** |
| **G5** Finish / auto-advance | **PASS — FOUNDER ATTESTED** | let a song complete | clock `.idle` the instant the server reports no on-stage row |
| **G6** Skip | **PASS — FOUNDER ATTESTED** | skip mid-song | same mechanism as G5; a new request resets the anchor immediately |
| **G7** Relaunch / sleep | **PASS — FOUNDER ATTESTED** | background, foreground, sleep tab, refresh, relaunch | sleep + backwards-monotonic + clamp cases (`B24-F`) |
| **G8** Exhaustion + grace | **PASS — FOUNDER ATTESTED** | ordinary exhaustion; one eligible grace; one non-eligible | **DB half proven** in `window-truth` |
| **G9** 04:00 boundary | **PASS (automated)** | *not needed* | **fully automated** — no real 04:00 wait |
| **G10** Full regression | **PASS (automated)** | *not needed* | **fully automated** — §3 |

### G2 — deferred, and not covered by G1

G2 is **DEFERRED / NON-BLOCKING** by explicit Founder decision: the mobile browser fallback is not
part of the primary Native operating path. It is recorded as **deferred, not passed**. The
"shared code path with G1" note above is a *deterministic* observation only — G1 is a desktop
administrative-console gate and does not exercise the mobile surface. If the mobile browser
fallback is later promoted to an operating path, **G2 must be run before that promotion**.

### G8 result — the changeover seam did not present

**G8 note (retained, as written before the run): the changeover seam is expected, not a failure.**
On the changeover day an account that already consumed Final Song Grace under the midnight window
key may be granted **one** additional grace admission (shortfall ≤ 90 seconds) under the restored
04:00 key. If G8 case C observed this, it was to be recorded as the **documented one-time
transition seam**, not as a G8 FAIL. Every other case C refusal must still come from server
authority.

**What the Founder actually observed** — an ordinary, in-contract grace admission, not the seam:

| Observation | Value |
|---|---|
| FREE before grace | 14 s |
| Song duration | 48 s |
| Shortfall | 34 s (≤ 90 s bound) |
| Result | admitted; NOW SINGING; FREE → 0 |
| Copy | `마지막 곡으로 재생합니다.` / `오늘 남은 무료 시간은 모두 사용돼요.` |
| During playback | continued at zero balance (`zero_playing` reachable — **D1** fixed) |
| After completion | no further song started; queued song stayed queued |
| Exhausted copy | displayed **truthfully** (balance genuinely 0) — the G1/G3 correction |

**The seam remains accepted and documented** regardless: it was not exercised here, so it was
neither confirmed nor retired by this run. It stays on the record in §4/§8 of the companion doc.

### Device pre-conditions for G8

Reuse the BUILD 23 approach: a REAL backdated ACTIVE Timed Pass / a genuinely consumed FREE
balance in an isolated local Supabase — **never a server bypass**. BUILD 23-GATE proved a client
injection upstream of the network cannot gate a server contract; that finding stands.

---

## 6. Founder attestation

```text
G1  — FOUNDER ATTESTED 2026-08-02 · Host Web · administrative-console smoke
                                    (FAILED first attempt; corrected in abece404)
G3  — FOUNDER ATTESTED 2026-08-02 · Native Host, iPhone · entitlement truth,
                                    reset presentation, no double debit
                                    (FAILED on build 78; PASSED on build 79 / 7a8a6b3)
G4  — FOUNDER ATTESTED 2026-08-02 · Native Guest · canonical convergence
G5  — FOUNDER ATTESTED 2026-08-02 · Native · natural finish and auto-advance
G6  — FOUNDER ATTESTED 2026-08-02 · Native · manual finish / skip transition
G7  — FOUNDER ATTESTED 2026-08-02 · Native · background, relaunch, authority restoration
G8  — FOUNDER ATTESTED 2026-08-02 · Native · Final Song Grace, zero-playing truth,
                                    second-start refusal (evidence in §5)
G2  — DEFERRED / NON-BLOCKING 2026-08-02 · mobile browser fallback is not part of the
                                    primary Native operating path
G9  — automated PASS
G10 — automated PASS
```

The automated column is untouched. **A manually attested gate is never relabelled automated**, and
a gate that failed before it passed is recorded with both results — G1 and G3 above.

---

## 7. Closure

```text
BUILD 24 — PASS / CLOSED   2026-08-02
```

Carried forward, **not** closed by this build:

- the one-time grace-window transition seam — accepted and documented, not exercised by G8;
- the Supabase CLI ledger deviation (`migration list --linked` / `db push --linked --dry-run`
  still 403; direct schema read-back substituted) — see §7.3 of the companion doc. **Clear this
  before the next migration is authored.**
