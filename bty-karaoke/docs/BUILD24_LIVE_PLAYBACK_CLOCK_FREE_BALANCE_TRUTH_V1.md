# BUILD 24 — LIVE PLAYBACK CLOCK & FREE BALANCE TRUTH V1

**Status: IMPLEMENTED · DEVICE GATE PENDING · NOT DEPLOYED**

Deterministic authority work is complete and green, and the commits are pushed.

- **G1–G8 remain NOT RUN** — they are device/browser gates. (An earlier revision of this line said
  "G1–G9", which was wrong: G9 is automated and passed.)
- **G9 and G10 are automated PASS.**
- **The production migration is BLOCKED** — remote migration authority is unavailable (§7).
- Nothing is deployed; native build 78 is not distributed.

This document does not claim PASS.

---

## 1. The reported defect, and what it actually was

> During an active song, the displayed current-song remaining time and the displayed FREE
> remaining time can appear frozen instead of visibly decreasing.
> Observed: FREE stuck around `13분`, current song stuck around `2:42`.

Both observations were real. Neither had the cause the report assumed.

### `2:42` — there was no clock to freeze

No client rendered a playback clock at all. `karaoke_requests.started_at` was selected into the
`/dj/queue` payload and read by **nobody** — zero references in the web console, and the only
native `startedAt` symbol (`HostModels.startedAtLabel`) is the *room/event* start time.

`2:42` was [`DurationAdmission.label(seconds:)`](../../bty-norebang-admin-ios/BTYNorebangAdmin/GuestMode.swift)
— a **static song-length badge**. It was correctly static. It never froze, because it was never
a countdown.

### `13분` — the FREE balance genuinely does not move during a song, and that is correct

BUILD 20M made the charge **atomic and up front**. `karaoke_begin_song_v2` writes the entire
union extension as `lease_seconds` inside the admission transaction, and the entitlement bills
`SUM(lease_seconds)`. Nothing accrues while the song plays; `endSong` never touches the lease.

So the balance drops in one step at song start and then holds. **Ticking it down per second
would have been a client-side lie and a double-charge against a balance already debited.**

Two things made a correct value look broken:

1. `compactFreeLabel` rendered whole minutes, so 780s and 838s both printed `13분` — up to 59
   seconds of real change was invisible.
2. Across consecutive songs it can *also* legitimately hold: a song that ends inside an open
   lease charges `max(0, N−E) = 0`. That is the union contract preventing a double-charge.

**Verdict on the reported defect: NOT A DEFECT in the accounting.** It was a presentation
failure (no clock, minute-granularity) sitting on top of correct server truth.

Tracing it, however, surfaced four real defects.

---

## 2. Proven defects

All four are in `karaoke_free_minutes_entitlement_at_v2` (migration `20260803120000`) or its
client consumers. That function was written fresh rather than ported from the v1 body, and
silently dropped fields and moved a policy boundary. `lease_write_mode='on'` is GLOBAL, so every
FREE Host reads through it.

### D1 — `activePlaybackCount` was dropped; `zero_playing` became unreachable

v1 published it; v2 does not. `domain/usage.ts` coerces the missing key to `0`, so `isPlaying`
is **permanently false**.

Consequence: a Host who exhausts FREE mid-song is shown the **red `zero_idle` block**
("다음 곡을 시작할 수 없어요 · PRO 업그레이드") instead of `zero_playing`
("이 곡은 끝까지 부를 수 있지만, 다음 곡은 시작할 수 없어요").

This lands hardest on **FREE Final Song Grace**, whose entire purpose is "this song plays, the
next cannot". The server admitted the song; the UI called it blocked.

### D2 — `nextResetAt` was dropped

`"N시에 초기화돼요"` silently vanished from both the normal and the exhausted copy, on web and
native.

### D3 — the FREE daily window moved from 04:00 to local midnight

v1 anchors on `karaoke_usage_policy.reset_hour_local` (= 4). v2 used `date_trunc('day', ...)`.
Between 00:00 and 04:00 local, FREE reset four hours early.

It survived because **the repo's own test asserted the bug**: under a section titled
`# 04:00 America/Los_Angeles attribution`, the assertion read
`'charged_window_start is local midnight (date_trunc day)'`. A green test whose title
contradicted its own assertion.

**Founder decision (BUILD 24): the v1 policy is canonical. 04:00 is restored.**

### D4 — native's FREE per-second countdown was dead code that D1's fix would have re-armed

`QueueViewModel.advanceDisplay` decremented the FREE number once per second while `isPlaying`.
Under lease v2 that is a double-count. It only ever looked correct because D1 pinned
`isPlaying` false so it never ran. **Fixing D1 alone would have switched the double-count on**,
so the countdown is removed explicitly rather than left to luck.

### D5 — `activeLeaseEndsAt` never survived relaunch

Native learned the lease **only from a start response** and never re-read it, so the honest
"외부 재생 시간 차감 중" note vanished on foreground / relaunch / a second device while the
authorized window was still open.

---

## 3. Authority graph

### Before

```
FREE balance     SUM(lease_seconds) charged AT ADMISSION   → static during playback (correct)
                 window = date_trunc('day')                → 00:00 local  ✗ D3
                 activePlaybackCount = (absent)            → isPlaying always false  ✗ D1
                 nextResetAt        = (absent)             → reset line gone  ✗ D2
Song clock       started_at published, consumed by nobody  → NO CLOCK EXISTS
Lease window     leaseEndsAt from the START RESPONSE only  → lost on relaunch  ✗ D5
Native FREE tick anchor − elapsed, gated on isPlaying      → dead code, latent double-charge ✗ D4
```

### After

```
SERVER (authoritative, unchanged in every admission decision)
  karaoke_begin_song_v2         debits the whole union extension at admission
  ..._entitlement_at_v2         SUM(lease_seconds) over [reset_hour_local, +1 day)
                                + activePlaybackCount, nextResetAt, windowStart/End, warnLevel
  karaoke_room_playback_authority(room, as_of) -> ONE server instant carrying
      serverNow · requestId · startedAt · durationSeconds · leaseEndsAt
  karaoke_active_lease_ends_at(account, as_of) -> account-level open lease

CLIENT (presentation only; never decides admission, consumption, or exhaustion)
  anchor = (serverNow, startedAt, durationSeconds, leaseEndsAt, monotonicAtReceipt)
  elapsed = (serverNow − startedAt) + (monotonicNow − monotonicAtReceipt)

  projectSongClock    ticks     progress through THIS song
  projectLeaseWindow  ticks     how much authorized external playback remains
  FREE balance        STATIC    the persisted server value, verbatim
```

**Why the FREE balance is deliberately not projected.** §6.3 permits subtracting an active
lease's elapsed portion *only if that matches the BUILD 20M contract*. It does not — the charge
is already persisted. `freeRemainingForDisplay()` exists as a named, tested function taking **no
clock argument**, so the decision is reviewable code rather than an absence someone later
"fixes". The honest live counterpart is the **lease window**, which genuinely elapses.

### Clock authority (§6.4)

Every projection is `server anchor + monotonic delta`. `performance.now()` on web,
`DispatchTime.uptimeNanoseconds` on native. **The device wall clock is never read**, so changing
the phone's clock cannot move any displayed value — asserted directly on both sides. Every poll
re-anchors, so drift is bounded by one poll interval (4s Host, 2.5s Guest).

---

## 4. Changes

### Migration — `20260807120000_karaoke_free_window_truth_v1.sql`

Forward-only. No schema change, no backfill, no data migration. Republishes two functions and
adds two read-only ones.

- `karaoke_free_minutes_entitlement_at_v2` — 04:00 window restored (D3); `activePlaybackCount`
  (D1), `nextResetAt` (D2), `windowStart`/`windowEnd`/`warnLevel` restored.
- `karaoke_begin_song_v2` — identical to `20260805120000` **except** the charged-window anchor,
  so the window a segment stores is the window the entitlement bills against.
- `karaoke_active_lease_ends_at(account, as_of)` — NEW, read-only (D5).
- `karaoke_room_playback_authority(room, as_of)` — NEW, read-only; the five-value anchor in one
  round trip so `serverNow` cannot drift from `startedAt`.

**Attribution change (required by D3).** Lease rows were summed by
`charged_window_start = v_ws` — exact equality against a value frozen at write time. Correct only
while the window *definition* never changes, and it is changing here: existing rows carry a
midnight anchor and would stop matching, silently refunding real usage. Since the charge is
committed at admission, the segment's own `started_at` identifies its window exactly as well and
is invariant to the definition. Rows are now summed by `started_at ∈ [v_ws, v_we)` — identical
for every row under a stable definition, correct across this one. `charged_window_start` is still
written as the audit record of the window in force at authorization.

**Known one-time entitlement seam — knowingly accepted for rollout.**

On the changeover day, shifting the Final Song Grace ledger from the midnight-based window key to
the canonical 04:00 America/Los_Angeles window key may make **one additional Final Song Grace
admission available to an account that already consumed grace under the prior key.**

The exposure is bounded to one admission whose duration shortfall is no more than 90 seconds. It
is a one-time transition seam and cannot recur after the account is fully operating under the
restored 04:00 window key.

**No historical grace-ledger rows or `charged_window_start` values are rewritten.**

What this seam is, and what it is not:

- It **is knowingly accepted** for rollout. It is not an oversight and is not being worked around.
- It is **not evidence that normal authorization was bypassed.** Every start still passes the full
  `karaoke_begin_song_v2` gate — duration must be trusted, the union charge must be computed, and
  the once-per-window `NOT EXISTS` check must pass under the account advisory lock, with
  `unique(account_id, charged_window_start)` as the durable backstop.
- It is caused **solely by the one-time identity change of the entitlement window.** The
  once-per-window rule is keyed on the window; changing what "the window" means changes which
  ledger row a new attempt collides with. The rule itself is unchanged.
- It **must not be described as zero exposure.** One extra ≤ 90-second grace admission per
  affected account is a real, if small, entitlement grant, and this document does not claim
  otherwise.

Deliberately not mitigated: rewriting historical grace ledgers to eliminate the seam would destroy
an accurate record of what was granted under the prior window in order to hide a bounded, one-time
effect. The audit trail is worth more than the ≤ 90 seconds.

> **Known documentation inconsistency (open).** The header comment of
> `20260807120000_karaoke_free_window_truth_v1.sql` still carries the earlier, incorrect phrasing
> *"No refund, no double-charge, no unauthorized start."* That file is out of scope for this
> documentation-only change and was deliberately left untouched, as was the already-pushed commit
> message of `ad88cef9`, which repeats it. **This section supersedes both.** The SQL comment should
> be corrected in the next change that legitimately touches the migration.

**Rollback.** Re-run the function bodies from `20260803120000` (entitlement) and `20260805120000`
(begin_v2); drop the two new read-only functions. No data is altered by this migration.

### API — additive only

| Endpoint | Field | Notes |
|---|---|---|
| `GET /api/rooms/[slug]/dj/queue` | `playback` | full anchor incl. `leaseEndsAt` |
| `GET /api/rooms/[slug]/requests` | `playback` | **guest-safe**: no `leaseEndsAt` |

`toGuestPlaybackAuthority` is an explicit **allowlist**, not a `delete` or a spread-minus, so a
private field added later is absent until someone publishes it deliberately. `leaseEndsAt` is
account metering state — the class of field that turned the BUILD 18B replay into an ownership
oracle.

`readPlaybackAuthority` is fail-soft: a hiccup yields a null anchor (no clock) rather than
failing the queue poll. **No new migration was needed for the clock itself** — `started_at`,
`karaoke_video_durations` and `lease_ends_at` already existed; only the read was missing.

### Web

- `src/domain/playback-clock.ts` — the pure projection (new).
- `src/app/r/[slug]/dj/usePlaybackClock.ts` — re-anchor on poll, 1s tick, recompute on
  `visibilitychange`. Renders only when a *displayed* value changed.
- `src/app/r/[slug]/dj/NowSingingClock.tsx` — the clock + lease line.
- `UsageBanner.tsx` — exact MM:SS in **every** FREE+enforced state (native parity; the web
  previously printed the number only in `normal`).

### Native (build **78**)

- `PlaybackClock.swift` — faithful Swift mirror; Foundation-only, self-contained ISO parsing so
  both standalone harnesses compile it.
- `QueueViewModel` — anchors on every poll, projects `songClock` + `leaseWindow`, reads
  `leaseEndsAt` from the **poll** (D5), and **no longer decrements the FREE balance** (D4). The
  300/120/0 threshold-resync machinery is deleted with the countdown it served.
- `QueueView` — the clock under NOW SINGING; the lease note now shows a live remaining time.
- `GuestRoomView` — same anchor, same projection, 1s ticker sharing the poll lifecycle (§G4).
- `compactFreeLabel` — now carries seconds (`13분 0초` / `13분 58초`).
  **R3.1-A is deliberately preserved**: it keeps unit suffixes rather than adopting the banner's
  colon clock, because a device Host previously read a bare `0:48` as *48 minutes*. The surfaces
  differ in **form**, never in **value**.

---

## 5. Tests

| Suite | Result |
|---|---|
| Web `tsc --noEmit` | clean |
| Web Vitest | **2044 passed** (199 files) — was 1983 |
| Web `next build` | success |
| Native Host harness | **1560 passed, 0 failed** — was 1502 |
| Native Guest harness | **653 passed, 0 failed** — was 642 |
| Xcode Debug / Release (generic iOS) | exit 0, 0 errors |
| Postgres — BUILD 24 authority | **76 passed, 0 failed** |
| Postgres — BUILD 20M lease replay | **72 passed, 0 failed** |
| Postgres — BUILD 20M-R4 grace replay | **71 passed, 0 failed** |

All §9 cases are covered on **injected clocks**; there are no real-time sleeps in any unit test.

Two of my own initial expectations were wrong and the harness caught both: a song starting inside
an already-open lease is admitted at **charge 0** (union, correct), so the naive
"exhaustion blocks" and "grace is once per window" fixtures had to elapse the lease first. Those
cases are now in the suite as documented behaviour — they are the same mechanism that makes the
FREE balance legitimately hold across consecutive songs.

---

## 6. Gate status — honest accounting

| Gate | Status | Evidence |
|---|---|---|
| G1 Host Web active clock | **NOT RUN** (device/browser) | deterministic half green: `NowSingingClock.render.test.tsx` proves the value changes across 15s with no refresh |
| G2 Mobile browser parity | **NOT RUN** | — |
| G3 Native Host parity | **NOT RUN** | deterministic half green: `B24-K` VM cases |
| G4 Native Guest convergence | **NOT RUN** on device | deterministic half green: `B24-G4` proves identical projection + that no lease reaches a Guest |
| G5 Finish / auto-advance | **NOT RUN** | deterministic half green: clock is `.idle` the instant the server reports no on-stage row |
| G6 Skip transition | **NOT RUN** | same mechanism as G5 |
| G7 Relaunch / sleep recovery | **NOT RUN** | deterministic half green: sleep/backwards-monotonic/clamp cases |
| G8 FREE exhaustion + Final Song Grace | **NOT RUN** on device | **DB half PROVEN** — grace admits, charges only the balance, converges to 0, once per window |
| G9 04:00 reset boundary | **PROVEN (automated)** | `window-truth.pg.test.mjs` — v1/v2 window equality, 02:00 vs 04:30 attribution, both DST transitions |
| G10 Full regression | **PROVEN (automated)** | the eight suites in §5 |

**No gate here is labelled automated unless a command produces it.** G1–G8 need a real device or
browser; G9 and G10 are fully deterministic and were run.

---

## 7. Deployment

**Commits are pushed. Nothing is deployed.** The production migration is **BLOCKED**.

```text
Worker (live)        d49c3835-49d2-4051-a68e-28c7876b8767 @ 100%   (BUILD 23, UNCHANGED)
/api/karaoke-build   c58a2c60e945                                   (BUILD 23, UNCHANGED)
Migration            20260807120000 — pushed, NOT APPLIED to production
Native               build 78 — pushed, NOT distributed
```

### BLOCKED — REMOTE MIGRATION AUTHORITY UNAVAILABLE

The migration changes **entitlement semantics** (the 04:00 restoration) and must not be applied
against an unverified ledger. Root cause of the 403: the authenticated Supabase CLI identity
**cannot see the karaoke project at all.**

```text
CLI-accessible project refs   gdqqivlzhgtqdqmvndkf   (bty-release-manager)
Karaoke project ref           zycwaqignioawtqynopj
Accessible?                   NO

supabase migration list --linked      403  LegacyDbConfigLoginRoleStatusError
supabase db push --linked --dry-run   403  LegacyDbConfigLoginRoleStatusError
```

Both the inspection path and the apply path fail identically, so even a verified ledger could not
be acted on from here.

**What read-only probing did establish** (authenticated `service_role`, `stable` functions and
`limit=0` reads only — nothing mutated, no account touched):

| Question | Answer |
|---|---|
| Production project identity | `zycwaqignioawtqynopj` — URL, JWT claim, and `project-ref` agree |
| Parent migrations `20260726`–`20260806` | **all present** |
| BUILD 24 objects (`karaoke_active_lease_ends_at`, `karaoke_room_playback_authority`) | **absent** (`PGRST202`) → migration **not applied** |
| Live entitlement contract | returns the exact `20260803120000` field set — `activePlaybackCount`, `nextResetAt`, `warnLevel` all **missing**, independently confirming **D1**, **D2**, and **D3** in production |

**What remains unverifiable**, because `supabase_migrations` is not an exposed PostgREST schema
(`PGRST106`) and no database credential is available locally:

- the current remote migration head as recorded in the ledger;
- whether local and remote migration ordering agree;
- whether any migration is recorded-but-not-applied or applied-but-not-recorded.

A schema probe cannot see a partially-applied migration, which is exactly the condition that makes
`db push` behave unpredictably. Rollout stays blocked until one of these is true:

1. `supabase login` as the account/org owning `zycwaqignioawtqynopj` (or that account is added to
   the org), so that **both** `supabase migration list --linked` and
   `supabase db push --linked --dry-run` are executable;
2. a database password is provided so the ledger can be read and the migration applied via `psql`;
3. the output of `supabase migration list --linked` is supplied from a machine with access.

---

## 8. Limitations

- **Web Guest (`/r/[slug]`) renders no song clock.** The anchor is published to it, but the
  surface was not wired in V1. It shows *nothing* rather than something wrong, so there is no
  cross-client disagreement — but it is not at parity either.
- **iOS deep sleep.** `uptimeNanoseconds` can stop advancing while the device is suspended, so
  the clock can under-read until the foreground poll re-anchors (≤ 2.5–4s). The projection is
  clamped so it can never move backwards; asserted in `B24-F`.
- **The grace-ledger changeover seam** in §4 — on the changeover day, one additional Final Song
  Grace admission may become available to an account that already consumed grace under the prior
  window key. Bounded to one admission with a shortfall of ≤ 90 seconds, one-time, and unable to
  recur once the account is fully on the restored 04:00 key. **This is a real, accepted exposure
  and is not zero.** No historical grace-ledger rows or `charged_window_start` values are
  rewritten.
- **Remote migration state unverified** — the ledger is unreachable, so remote head, ordering
  agreement, and partial-application detection are all unknown. See §7.

---

## 9. References

| | |
|---|---|
| Migration | `supabase/migrations/20260807120000_karaoke_free_window_truth_v1.sql` |
| Harness | `supabase/tests/b24/run.sh` · `window-truth.pg.test.mjs` |
| Gate doc | [`GATE_B24_END_TO_END_HARNESS.md`](GATE_B24_END_TO_END_HARNESS.md) |
| Web domain | `src/domain/playback-clock.ts` (+ `.test.ts`) |
| Native domain | `BTYNorebangAdmin/PlaybackClock.swift` |
| Prior build | [`BUILD23_AUTO_ADVANCE_ADMISSION_HONESTY_V1.md`](BUILD23_AUTO_ADVANCE_ADMISSION_HONESTY_V1.md) |
