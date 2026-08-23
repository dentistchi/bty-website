# BUILD 26U-R3 — LEGACY-SAFE PRODUCTION INSTALL + BUILD 110 READINESS

**Status: PASS / CLOSED — 2026-08-23.** All Founder device gates observed and corroborated by
production. Rollout mode `legacy_free`. Commerce OFF. Nothing submitted, nothing uploaded.

---

## 1. What R3 changed in production

| | Before | After |
|---|---|---|
| Migration head | `20260821120000` | `20260823120000` |
| Worker version | `dd0f80f1-8326-4148-8411-eedc2661f20c` | `a1101992-6a59-4d63-8188-5682c476fe60` |
| Served build id | `03360ff45864` | `691896c671da` |
| `premium_room_mode` | column absent | **`legacy_free`** |
| Catalog `is_active` | 3 × false | **3 × false (unchanged)** |
| Native build | 109 | **110** (local only — not uploaded) |

**Behaviourally, nothing changed for anyone.** Under `legacy_free` the matrix returns `legacy`
for every client shape, so build 109, build 110 and web all get exactly the pre-R1 contract.

---

## 2. Migration hashes

```
20260822120000_karaoke_premium_room_session_entitlement_v1.sql
  sha256 f0889c80181a2862f74cac720e752d387eb7f26737b2b3e25768bdb64bb500bc
20260823120000_karaoke_premium_room_rollout_v1.sql
  sha256 8be5af65f2edef84fa0f631295774ed69038cb0a7a3b8f81035b34c111ace5ec
```

Applied via `supabase-karaoke db push --linked` (the Keychain-PAT wrapper — bare `supabase`
returns a misleading 403; see the CLI memory). Dry run listed exactly the two expected files, in
order, and nothing else. Post-apply: `Remote database is up to date.`

---

## 3. The legacy contract, proven from the INSTALLED production body

`supabase db dump --linked` (read-only) was used to read back what production actually runs.

| Gate | Evidence from the installed body |
|---|---|
| LEGACY-DB-1 | the legacy path reaches the Event INSERT with no entitlement step before it |
| LEGACY-DB-2/3 | the legacy `ELSE` block is, verbatim: `else v_source := 'LEGACY_FREE';` — it contains no `v_activated`, no `entitlement_at`, no `timed_access_pass_grants`, no `v_entitled`, no `v_armable` |
| LEGACY-DB-4 | the function contains no `product_catalog` and no `is_active` reference at all |
| LEGACY-DB-5 | `'premium_room_required'` occurs before `insert into public.karaoke_events` |
| LEGACY-DB-6 | no `youtube`, `video_duration` or `karaoke_requests` reference anywhere in the function |
| LEGACY-DB-7 | line 21 of the installed body is `v_legacy boolean := (coalesce(p_contract, 'premium') = 'legacy');` — the NULL-contract hole is closed **in production** |

**Why this is a schema proof and not a behavioural one.** §4 permits read-only proof "when
sufficient" and forbids mutating real accounts. I searched for a room where a `premium` probe
provably could not write — no live Event, and an owner holding neither an ACTIVE grant (which the
sweep would expire) nor a SELECTED grant (which the premium path would **activate**, spending a
real customer's purchased window). **No such room exists**: every eligible room's owner holds one
or the other. So the write path was not probed in production. The behavioural gates were run
instead against an isolated Postgres carrying the identical 52-migration set (R2 §G1–G9, R3 local
re-run), and production was verified to be running the identical function body.

---

## 4. Rollout telemetry

Installed shape, from the production dump:

```sql
CREATE TABLE public.karaoke_release_clients_hourly (
    hour_utc  timestamp with time zone NOT NULL,
    bucket    text NOT NULL,
    requests  integer DEFAULT 0 NOT NULL,
    CONSTRAINT ..._bucket_check   CHECK (bucket = ANY (ARRAY['NATIVE_LEGACY','NATIVE_PREMIUM','WEB','UNIDENTIFIED'])),
    CONSTRAINT ..._requests_check CHECK (requests >= 0)
);
```

Three columns. No account, room, event, session, token, IP, user agent, device id or fingerprint.

**LIVE READING, ~1 hour after deploy:**

```
hour_utc                     bucket          requests
2026-08-22T18:00:00+00:00    UNIDENTIFIED          79
```

79 real, **authenticated** hosted-room requests (the counter fires inside `resolveRelease`, which
runs only after `authorizeDj` passes) arrived carrying no `x-bty-client` header — i.e. the shipped
build 109 and/or the web console. They were served the legacy contract. `NATIVE_PREMIUM`, `WEB`
and `NATIVE_LEGACY` are all absent, which is consistent: build 110 is not distributed.

**And nothing was consumed.** Across those 79 requests the grant table is unchanged from the
preflight census — 56 rows, `{AVAILABLE:24, REVOKED:8, ACTIVE:2, EXPIRED:22}` — and
`timed_access_pass_audit` still holds exactly 156 rows with its newest entry dated 2026-08-14.
**No `ACTIVATED` and no `EXPIRED` audit row was written after deploy.** That is the legacy
contract's central guarantee, observed on real production traffic rather than inferred, and it is
direct server-side evidence for gate F7. The two stale ACTIVE rows remain untouched per Founder
decision B.

**`UNIDENTIFIED` is a ceiling, not a count.** Build 109 sends no header, so it lands there
together with scripts and curl. It bounds remaining build-109 traffic from above; it does not
measure it.

---

## 5. Build 110 identity and header

```
CFBundleShortVersionString  1.0
CFBundleVersion             110      (Debug and Release identical)
CFBundleIdentifier          com.bty.BTYNorebangAdmin
ReleaseClientHeader.value   native/110   → parses as kind=native build=110 → premium-capable
```

Runtime proof of the **mechanism**: a harness compiling the shipped `ReleaseClientHeader.swift`
and performing the same `URLSessionConfiguration` construction `APIClient.init` performs sent
three real requests to a capture server. All three carried `x-bty-client` alongside
`Authorization`:

```
POST /api/rooms/x/dj/start-event   x-bty-client=native/0   auth=True
POST /api/rooms/x/dj/start         x-bty-client=native/0   auth=True
POST /api/rooms/x/dj/pass-turn     x-bty-client=native/0   auth=True
```

`native/0` is correct there: a bare process has no bundle, so the value degrades to the
documented safe non-build (which the server classifies as legacy). The shipped app has
`CFBundleVersion = 110`, so it emits `native/110`.

**Stated as an evidence substitution:** the *value* `native/110` is proven from the built
Info.plist plus the pure formatter, not from the shipped app's own network traffic. Observing
`native/110` on the wire from the installed app is part of the Founder device gates.

---

## 6. Build-identity pins advanced

Three pins hard-coded 109 and correctly failed on the bump — the same pattern as
26T-R1B-R6-R1B-R10. Advanced to 110, keeping the **count-based** form (26J: a `contains` check
would pass while shipping a Debug/Release split). 109 joins the must-not-remain list, because it
is the public binary and must never be confused with the first Premium Room build.

---

## 7. Update Required contract — DESIGN ONLY, NOT ACTIVATED

Defined in [`src/domain/release-contract.ts`](../src/domain/release-contract.ts) and reachable
**only** under `premium_all`, which is not in force.

| Field | Value |
|---|---|
| Code | `CLIENT_UPDATE_REQUIRED` |
| HTTP | `409` (a conflict of state, deliberately **not** 402 — this client cannot pay, only update) |
| KO | 앱을 최신 버전으로 업데이트해 주세요. 노래 검색과 YouTube에서 열기는 계속 사용할 수 있어요. |
| EN | Please update to the latest version. You can still search for songs and open them on YouTube. |
| Blocks | hosted-room actions only — start session, start song, pass turn, request transitions |
| Never blocks | YouTube search, result rendering, **Open on YouTube**, attribution, Saved Songs |
| Retry | the refusal is stateless and idempotent; retrying returns the same answer until the app is updated |
| Dismiss | client-side only; it must never be interpretable as having satisfied the requirement |

**Not yet built, and required before `premium_all`:** an App Store destination mechanism (a
`itms-apps://` / product-page link), an update sheet, and a server-advertised minimum build so
the client can present the prompt rather than merely receive a 409. This is R4+ work.

**This cannot improve build 109.** That binary is shipped and has no code to render such a
prompt; under `premium_all` it would simply see a failed hosted-room action. That is precisely
why the sunset must be driven by telemetry rather than by a date.

---

## 8. Test totals

| Suite | R2 | R3 |
|---|---|---|
| Web (vitest) | 271 files / 3366 | 271 files / **3366** |
| Native host | 3035 passed, 3 failed | **3035** passed, 3 failed |
| Native guest | 1069 | **1069** |

The 3 native failures are the long-standing pre-existing ones (26F-1 / 26F-2 / 26F-16b — DEBUG
gate-harness literals auto-extracted into the string catalog with no localizations), with
byte-identical orphan lists.

`tsc --noEmit` clean · `npm run build` compiled · native Debug **and** Release BUILD SUCCEEDED ·
`node scripts/verify-r3-deploy.mjs` → **6/6 DEPLOY gates pass against production**.

---

## 9. Founder device gates — OUTSTANDING

R3 cannot be closed without these. They require physical devices and a human.

**Build 109 (the App Store binary) — F1–F7.** Install from the App Store, sign in, start a hosted
room, guest joins by QR, guest submits a <15-minute song, host starts it. Expect: everything
works, no Premium Room prompt, no purchase prompt, no visible 402. F7 additionally needs a server
read confirming no SELECTED pass was activated by legacy use.

**Build 110 free path — N1–N8.** Signed out, reach Search songs, search, see the *Developed with
YouTube* mark, tap a result, YouTube opens; repeat with a >15-minute result; no purchase prompt
anywhere; a malformed result opens nothing.

**Build 110 hosted room — H1–H7.** Sign in, start a hosted room (must work **without** purchase,
because the mode is `legacy_free`), guest joins by QR, adds a song, host operates the queue and
starts a song; a >15-minute item stays blocked from the shared queue with queue-quality wording
only.

**Copy review** — EN and KO surfaces show no retired playback-time language and use the BTY
Premium Room vocabulary where surfaced, with no active purchase CTA.

---

## 10. FOUNDER DEVICE VERIFICATION — COMPLETE (2026-08-23)

### Build 109 (public App Store binary) — F1–F7 PASS

F1–F6 observed by the Founder: launch, sign-in, hosted room started, Guest joined by QR, Guest
submitted a <15-minute song, Host started it. No Premium Room message, no purchase message, no
error. F7 verified server-side: all eight tripwires held.

Corroborated independently: a request created 19:15:22Z and **started 19:15:31Z**, and a
`UNIDENTIFIED = 2` telemetry row in the 19:00 hour — build 109 sends no header, so that is
exactly where its authenticated hosted-room calls must land.

### Build 110 — N1–N8 and H1–H7 PASS

Installed to the physical device and read back **from the device**:
`BTY Norebang · com.bty.BTYNorebangAdmin · 1.0 · 110`.

### THE ON-WIRE PROOF (R3 §K's evidence substitution, now closed)

```
2026-08-23T04:00:00+00:00   NATIVE_PREMIUM   requests = 1
2026-08-22T19:00:00+00:00   UNIDENTIFIED     requests = 2
2026-08-22T18:00:00+00:00   UNIDENTIFIED     requests = 79
```

`NATIVE_PREMIUM` was **0 rows** immediately before the device action. The server assigns that
bucket **only** when the received `x-bty-client` header parses as `native/<build>` with build
≥ 110. Its appearance is therefore production's own proof that the physical device put
`native/110` on the wire. No local Info.plist inference is involved.

### The start, and what it did NOT do

```
request pos 189  status=playing  started_at=2026-08-23T04:48:48.19154Z
segment          started_at=2026-08-23T04:48:48.19154Z
                 metered=false · pass_grant_id=NULL · metering_paused_by_pass=false
                 duration_seconds / lease_ends_at / lease_seconds /
                 charged_window_start / charged_window_end  ALL NULL
```

All five lease/meter columns NULL together is the E1 unmetered arm, and `pass_grant_id = NULL`
is the legacy contract's signature: **a premium-capable client (`native/110`) was served the
`legacy` contract because the mode is `legacy_free`, and no entitlement was activated or
consumed.** That is R3-FV checks 10 and 11, observed rather than argued.

### Invariants after the full device session

| | Baseline | After | |
|---|---|---|---|
| `premium_room_mode` | legacy_free | **legacy_free** | ✅ |
| grants | 56 | **56** | ✅ |
| audit rows | 156 | **156** | ✅ |
| latest `ACTIVATED` | 2026-08-13T02:00:05Z | **2026-08-13T02:00:05Z** | ✅ |
| catalog | 3 × false | **3 × false** | ✅ |
| PAID grants | 1 (26S-R1) | **1** | ✅ |

### The visual policy-boundary evidence

On an **18:04** search result, build 110 showed simultaneously:

* **"Open on YouTube ↗" — AVAILABLE**
* **"Can't request" — DISABLED**, with *"Over 15 minutes, so it can't be requested · pick a
  shorter version"*

This is the separation the entire 26U build exists to establish, observed on a device:
**YouTube access is open; BTY shared-queue admission is independently constrained.** The
15-minute rule is confirmed a queue-quality rule, not a paywall and not a YouTube gate.

### Copy — PASS

Founder visual review found no production copy stating or implying YouTube playback time for
sale, external playback time, "pass cannot cover this song", "upgrade to play this video",
first-song timer start, or payment required to keep watching. No active purchase CTA appeared.

### Instrumentation note, recorded honestly

The `[GATE-FV]` console instrumentation covers `/dj/start-event`, the free-path YouTube open,
and the startup client identity — it does **not** cover `/dj/start`. So the console could not
answer whether the Start tap reached the server, and the server had to. If a future slice needs
the Start path observable on-device, that is the gap to close first.

