# BUILD 24 — LIVE PLAYBACK CLOCK & FREE BALANCE TRUTH V1

**Status: PASS / CLOSED — 2026-08-02**

Deployed, migrated, Founder-attested on device, and re-verified end to end.

- **G1, G3–G8 — FOUNDER ATTESTED** on the live production stack.
- **G2 — DEFERRED / NON-BLOCKING** by explicit Founder decision: the mobile browser fallback is
  not part of the primary Native operating path (§6).
- **G9, G10 — automated PASS.**
- **The production migration is APPLIED.** The block recorded in earlier revisions of §7 is
  **RESOLVED**; §7 now records what was positively verified against production.
- Native **build 79** is installed on the Founder device. Worker `dca14ffc` serves 100%.

Two gates failed on first attempt and were corrected before passing: **G1** (web,
`abece404`) and **G3** (native build 78 → **79**, `7a8a6b3`). Both are recorded as such in §6 —
a corrected gate is never backdated to a clean pass.

**One deviation from the closure checklist is recorded in §7.3 and is not claimed as verified:**
the Supabase CLI ledger comparison (`migration list --linked` / `db push --linked --dry-run`)
still returns 403 from this machine. Direct read-only schema verification was substituted and is
reported in full; it establishes that the migration is applied, but it cannot detect ledger drift.

---

## 1. The reported defect, and what it actually was

> During an active song, the displayed current-song remaining time and the displayed FREE
> remaining time can appear frozen instead of visibly decreasing.
> Observed: FREE stuck around `13분`, current song stuck around `2:42`.

**The original "frozen clock" report was a misdiagnosis.** Both observations were real; neither
had the cause the report assumed, and nothing was frozen. `2:42` was a **static duration badge**
that had no countdown to freeze, and the FREE balance is **charged upfront by lease-union
authority**, so holding steady during playback is the contract working. This is recorded as the
build's founding finding, not as a retrospective excuse: acting on the report as written would
have added a client-side per-second countdown against a balance the server had already debited —
a double-charge. Tracing *why* the report looked true surfaced the five defects in §2, which are
the real content of BUILD 24.

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

### Native (implemented in build **78**; shipped as build **79** after the G3 correction)

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
- **Build 79 (G3 correction)** — `AdmissionCopy.upgradeRequired` gained `remainingSeconds` as its
  sole discriminator (with the refusal's own usage projection as fallback), wired into both Start
  entry points and the auto-advance path; `UsageBannerModel` now attaches the reset line in every
  FREE + enforced state. See §6.

---

## 5. Tests

Final closure re-run, 2026-08-02, on the shipped trees (`abece404` web · `7a8a6b3` native):

| Suite | Result | At implementation |
|---|---|---|
| Web Vitest | **2071 passed** (200 files) | 2044 (199) |
| Native Host harness | **1631 passed, 0 failed** | 1560 |
| Native Guest harness | **653 passed, 0 failed** | 653 |
| Xcode Debug (generic iOS) | **BUILD SUCCEEDED** | success |
| Xcode Release (generic iOS) | **BUILD SUCCEEDED** | success |
| Postgres — BUILD 24 authority | **76 passed, 0 failed** | 76 |
| Postgres — BUILD 20M lease replay | **72 passed, 0 failed** | 72 |
| Postgres — BUILD 20M-R4 grace replay | **71 passed, 0 failed** | 71 |

The web count rose 2044 → 2071 with the G1 correction (`admission-copy.g1.test.ts` +
`UsageBanner.render.test.tsx`); the Native Host count rose 1560 → 1631 with the G3 correction
(`build24G3EntitlementCopyTests`). Both increases are the corrections' own coverage, not a
re-count of existing cases.

All §9 cases are covered on **injected clocks**; there are no real-time sleeps in any unit test.

Two of my own initial expectations were wrong and the harness caught both: a song starting inside
an already-open lease is admitted at **charge 0** (union, correct), so the naive
"exhaustion blocks" and "grace is once per window" fixtures had to elapse the lease first. Those
cases are now in the suite as documented behaviour — they are the same mechanism that makes the
FREE balance legitimately hold across consecutive songs.

---

## 6. Gate status — final record

| Gate | Status | Evidence |
|---|---|---|
| G1 Host Web active clock | **PASS — FOUNDER ATTESTED** (after correction) | failed first attempt; corrected in `abece404`; re-run by Founder |
| G2 Mobile browser parity | **DEFERRED / NON-BLOCKING** | explicit Founder decision — see below |
| G3 Native Host entitlement truth | **PASS — FOUNDER ATTESTED** (after correction) | failed on build 78; corrected in `7a8a6b3`/build 79; re-run by Founder on device |
| G4 Native Guest convergence | **PASS — FOUNDER ATTESTED** | device; matches Host projection |
| G5 Natural finish / auto-advance | **PASS — FOUNDER ATTESTED** | device |
| G6 Manual finish / skip transition | **PASS — FOUNDER ATTESTED** | device |
| G7 Background / relaunch / authority restoration | **PASS — FOUNDER ATTESTED** | device |
| G8 Final Song Grace + zero-playing + second-start refusal | **PASS — FOUNDER ATTESTED** | device; evidence below |
| G9 04:00 America/Los_Angeles boundary | **PASS (automated)** | `window-truth.pg.test.mjs` — v1/v2 window equality, 02:00 vs 04:30 attribution, both DST transitions |
| G10 Full regression baseline | **PASS (automated)** | the eight suites in §5 |

**No gate is labelled automated unless a command produces it, and no manually attested gate is
relabelled automated.** G1 and G3–G8 are Founder attestations against the live production stack;
G9 and G10 are deterministic.

### G2 — deferred, and why that is not a silent pass

G2 (mobile browser parity) is **DEFERRED / NON-BLOCKING** by explicit Founder decision: the mobile
browser fallback is **not part of the primary Native operating path**, which is what BUILD 24
ships against. It is recorded as deferred, **not** as passed, and not as covered by G1 — G1 is a
desktop administrative-console gate and does not exercise the mobile surface. If the mobile
browser fallback is later promoted to an operating path, G2 must be run before that promotion.

### Two gates failed first, and were corrected

Neither is backdated to a clean pass. Both failures were the **same defect class**, found on two
clients a day apart.

- **G1 — FAILED.** With 1:50 of FREE time left and a 4:41 next song, Host Web showed the correct
  balance and *"오늘의 무료 이용 시간을 모두 사용했어요"* on one screen. Corrected in
  [`abece404`](#) — `upgradeRequiredCopy()` in `@/domain/admission-copy` became the one selector,
  wired into `/dj/start`, `/dj/pass-turn` and `/requests/[id]`.
- **G3 — FAILED on native build 78.** The identical contradiction, reached through the real
  auto-advance refusal path: *"이용권 5개 · FREE 1분 2초"* beside *"오늘의 무료 이용 시간을 모두
  사용했어요"*. Corrected in `7a8a6b3` (**build 79**).

**Root cause, common to both.** `karaoke_begin_song_v2` raises `upgrade_required` for the whole
predicate `v_charge > v_remaining`. Exhaustion is only the special case where `v_remaining` is 0.
Call sites had hard-coded "all time used" as the sole wording for that outcome, so every refusal
claimed a zero balance regardless of the real one — and pointed the Host at the wrong remedy. At
zero you wait for the reset or upgrade; with time left, a shorter song works immediately.

**The native-specific finding.** On build 78 the manual Start path was already authority-aware
(it had itemised from the published admission detail since R1). Only `finishCurrentAndOpenNext`
— the auto-advance path — discarded **both** the admission detail and the usage projection that
the same `/dj/pass-turn` response carries, and substituted a hard-coded constant. The branch
previously described as latent was reachable on the real refusal path.

**Both fixes are presentation only.** `remainingSeconds` is the sole discriminator and always
comes from the authority (published detail first, then the usage projection carried by the same
refusal). No client-side admission decision, no re-derivation of the 90-second Final Song Grace
bound, and no client-side grace calculation was introduced. An absent remaining still reads as
exhausted — the safe direction, since it never claims time the Host cannot be shown to have.

A second, independent defect was corrected alongside each: `nextResetAt` was attached only to the
`normal` and `zero_idle` states, so it was **omitted precisely in the warning states** — `two_min`
among them — which are the states a Host actually reads it in. It is now present in every
FREE + enforced state on both clients, formatted from the server instant in the account timezone.
04:00 is never hard-coded, and an absent server value omits the line rather than guessing.

### G8 — Founder device evidence

| Observation | Value |
|---|---|
| FREE balance before grace | 14 seconds |
| Admitted song duration | 48 seconds |
| Shortfall | 34 seconds — within the ≤ 90-second grace bound |
| Admission | song began as NOW SINGING |
| FREE after admission | 0 seconds |
| Native copy shown | `마지막 곡으로 재생합니다.` / `오늘 남은 무료 시간은 모두 사용돼요.` |
| During playback | playback continued while FREE was zero |
| After completion | no further song started |
| Queue | the queued song remained queued |
| Zero-balance copy | exhausted wording displayed **truthfully** — the balance really was 0 |

This exercises the whole §2 defect set at once: `zero_playing` is reachable again (**D1**), the
grace notice is distinguishable from a refusal, the charge is upfront and not re-billed on
completion, and the exhausted copy appears only where it is true — the G1/G3 correction.

---

## 7. Deployment — final verified state

**Deployed, migrated, and re-verified 2026-08-02.** The block recorded in earlier revisions of
this section is **RESOLVED**: every BUILD 24 object is live on production.

```text
Worker (live)        dca14ffc-4cdf-4305-9eed-d52a5e631580 @ 100%
                     created 2026-08-02T16:33:30Z
/api/karaoke-build   abece404917a                          (= web HEAD abece404, the G1 fix)
Migration            20260807120000_karaoke_free_window_truth_v1 — APPLIED
Native               build 79 (7a8a6b3) — installed on the Founder device
```

### 7.1 Production contract, read back from the live database

Read-only verification against `zycwaqignioawtqynopj` with the `service_role` key. Only `stable`
projection functions and bounded `select` reads were used — **no row was written, no account was
touched, and `karaoke_begin_song_v2` / `karaoke_end_song_v2` were never invoked.**

`karaoke_free_minutes_entitlement_at_v2(account, 2026-08-02T21:00:00Z)` returned:

```json
{ "plan": "FREE", "model": "lease_v2", "timezone": "America/Los_Angeles",
  "windowStart": "2026-08-02T11:00:00+00:00", "windowEnd": "2026-08-03T11:00:00+00:00",
  "nextResetAt": "2026-08-03T11:00:00+00:00", "activePlaybackCount": 0,
  "limitSeconds": 900, "remainingSeconds": 900, "usedSeconds": 0,
  "warnLevel": "none", "enforcementEnabled": true }
```

| Closure check | Result |
|---|---|
| `activePlaybackCount` present | **YES** — D1 fixed in production (was missing) |
| `nextResetAt` present | **YES** — D2 fixed in production (was missing) |
| 04:00 America/Los_Angeles window | **YES** — `11:00Z → 11:00Z` is exactly `04:00 → 04:00` PDT (D3 fixed; was local midnight) |
| `warnLevel` present | **YES** |
| Entitlement model | `lease_v2` |

The three defects this document proved (§2) are confirmed **corrected in production**, by the same
probe that previously confirmed them **present** in production.

### 7.2 Playback authority RPCs — all available

Enumerated read-only from the live PostgREST OpenAPI document (31 RPCs exposed):

| RPC | Introduced | Present |
|---|---|---|
| `karaoke_begin_song_v2` | 20260803 → republished 20260807 | **YES** |
| `karaoke_end_song_v2` | 20260803 | **YES** |
| `karaoke_free_minutes_entitlement_at_v2` | 20260807 | **YES** |
| `karaoke_active_lease_ends_at` | 20260807 (D5) | **YES** |
| `karaoke_room_playback_authority` | 20260807 | **YES** |

v1 coexistence is preserved: `karaoke_free_minutes_entitlement` and
`..._entitlement_at` are both still exposed, as the migration intends.

`karaoke_room_playback_authority(room, as_of)` returned the full five-value anchor
(`serverNow`, `requestId`, `startedAt`, `leaseEndsAt`, `durationSeconds`), and
`karaoke_active_lease_ends_at` returned cleanly.

Migration-chain markers, each unique to one migration, all present on production:

| Migration | Marker | Present |
|---|---|---|
| `20260803120000` | `karaoke_event_usage_segments.{lease_ends_at,lease_seconds,charged_window_start,charged_window_end,duration_seconds}` · `karaoke_usage_policy.lease_write_mode` | **YES** |
| `20260804120000` | folded into `karaoke_begin_song_v2` | **YES** |
| `20260805120000` | `karaoke_free_final_song_grace` | **YES** |
| `20260806120000` | `karaoke_video_durations` | **YES** |
| `20260807120000` | the four functions above | **YES** |

### 7.3 DEVIATION — the CLI ledger comparison could not be executed

**This is recorded as a deviation, not as a pass.** Two items on the closure checklist could not
be run from this machine:

```text
supabase migration list --linked      403  LegacyDbConfigLoginRoleStatusError
supabase db push --linked --dry-run   403  LegacyDbConfigLoginRoleStatusError
```

The authenticated Supabase CLI identity still cannot access project `zycwaqignioawtqynopj`, and
`supabase_migrations` is not an exposed PostgREST schema (`PGRST106`), so the ledger cannot be
read by the substitute path either.

**What was substituted:** §7.1–§7.2 — direct read-back of every object and every field the
migration produces, plus a per-migration marker probe across the whole `20260803`–`20260807`
chain.

**What that substitution does and does not establish.**

- It **does** establish that `20260807120000` is applied to production and behaving to contract:
  the objects exist, and the entitlement contract returns the post-migration field set with the
  restored 04:00 window. Earlier revisions of this section recorded those same objects as
  **absent**, so this is a positive, discriminating observation, not an assumption.
- It **does not** establish ledger equality. A schema probe cannot see a migration that is
  recorded-but-not-applied, applied-but-not-recorded, or partially applied — and it cannot confirm
  that local and remote migration *ordering* agree. `db push --linked --dry-run is empty` is
  therefore **unverified**, not verified-empty.

Independent corroboration, which is why this deviation was not treated as blocking: the Founder's
G1 and G3–G8 attestations were performed **against this same production stack**, and G8 in
particular exercised Final Song Grace with 04:00-window semantics end to end. Behaviour that only
exists after `20260807120000` was observed working on a real device.

**To clear the deviation**, any one of these suffices — none is required for the gates already
attested, and each is a prerequisite for the *next* migration, not for this closure:

1. `supabase login` as the account/org owning `zycwaqignioawtqynopj` (or add that account to the
   org), so both CLI commands become executable;
2. supply a database password so the ledger can be read via `psql`;
3. supply the output of `supabase migration list --linked` from a machine with access.

**This should be cleared before the next migration is authored.** BUILD 24 is closed with the
deviation on the record; the next build should not begin by assuming the ledger is clean.

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
  rewritten. **The seam remains accepted and documented at closure** — it was not retracted,
  re-scoped, or quietly resolved, and closing BUILD 24 does not close it.
- **Remote migration ledger unverified** — the CLI ledger comparison could not be executed
  (403). Remote head, ordering agreement, and partial-application detection remain unknown; the
  migration's *application* is confirmed by direct schema read-back. Recorded as an explicit
  deviation in §7.3, to be cleared before the next migration is authored.
- **G2 deferred** — the mobile browser fallback was not gated. It is recorded as deferred rather
  than passed, and G1 does not cover it (§6).

---

## 9. References

### Final implementation record

| | |
|---|---|
| Server/web implementation | `ad88cef93a437e3233f4b7ceeefc049aa029a229` — *BUILD 24 live playback clock + FREE balance truth V1* |
| G1 web correction | `abece404917a0dcb348d630da6c6122527b45eb5` — *honest upgrade_required copy + always-visible reset line* |
| Native implementation (G3 correction) | `7a8a6b394d1fc619c2350f7f3483daa622512bd6` — **build 79** |
| Native repo | `github.com/dentistchi/bty-norebang-admin-ios` (private) |
| Migration | `20260807120000_karaoke_free_window_truth_v1.sql` — **applied to production** |
| Deployed Worker | `dca14ffc-4cdf-4305-9eed-d52a5e631580` @ 100%, 2026-08-02T16:33:30Z |
| `/api/karaoke-build` | `abece404917a` |
| Documentation commits | `9ef4fe41` (authority graph, defect proof, gate accounting) · `0a76f86a` (grace window transition seam) · `1d0d6e39` (migration transition comment) |
| Closure commit | this change |

### Source references

| | |
|---|---|
| Migration | `supabase/migrations/20260807120000_karaoke_free_window_truth_v1.sql` |
| Harness | `supabase/tests/b24/run.sh` · `window-truth.pg.test.mjs` |
| Gate doc | [`GATE_B24_END_TO_END_HARNESS.md`](GATE_B24_END_TO_END_HARNESS.md) |
| Web domain | `src/domain/playback-clock.ts` · `src/domain/admission-copy.ts` (+ `.g1.test.ts`) |
| Native domain | `BTYNorebangAdmin/PlaybackClock.swift` · `AdmissionCopy` in `QueueSong.swift` |
| Prior build | [`BUILD23_AUTO_ADVANCE_ADMISSION_HONESTY_V1.md`](BUILD23_AUTO_ADVANCE_ADMISSION_HONESTY_V1.md) |

---

## 10. Closure

```text
BUILD 24 — PASS / CLOSED          2026-08-02

G1  PASS   Founder attested (after the abece404 correction)
G2  DEFERRED / NON-BLOCKING — mobile browser fallback is not the primary Native operating path
G3  PASS   Founder attested (failed build 78 · passed build 79, 7a8a6b3)
G4  PASS   Founder attested
G5  PASS   Founder attested
G6  PASS   Founder attested
G7  PASS   Founder attested
G8  PASS   Founder attested
G9  PASS   automated
G10 PASS   automated

Carried forward, NOT closed by this build:
  · the one-time grace-window transition seam (§4, §8) — accepted and documented
  · the Supabase CLI ledger deviation (§7.3) — clear before the next migration
```
