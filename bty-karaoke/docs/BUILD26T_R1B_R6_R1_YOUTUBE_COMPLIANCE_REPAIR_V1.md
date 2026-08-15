# BUILD 26T-R1B-R6-R1 — YouTube Compliance Repair: measurement and halts

**Status: ALL FOUR WORKSTREAMS HELD — 2026-08-15. `E. MULTIPLE_GAPS`.**

**No code changed. No migration written or applied. No production write. No ASC write. No build
uploaded — native shipping code is unchanged, so the identity stays 104 and 105 was not minted.
`PASS_1H` / `PASS_4H` / `PASS_24H` inactive.**

Two independent blockers were measured, and both were found before writing code rather than after.

---

## 0. A correction to BUILD 26T-R1B-R6, made first because it changes the cost of E1

R6 presented `src/domain/playback-lease.ts → authorizeStart(...)` as the decisive playback gate.
**That function has no server call site.** It is a pure mirror of the rule, kept for unit tests;
its own file header says so — *"The authoritative persistence (v2 RPCs + a lease column) calls this
logic."*

The authority that actually refuses a song in production is a **PostgreSQL function**:

```
public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
  last redefined  supabase/migrations/20260813120000_karaoke_timed_pass_carryover_v1.sql:288
  called from     src/lib/metering.server.ts:136  →  /api/rooms/{slug}/dj/start
  refuses with    'duration_unavailable'  (line 335)
                  'pass_insufficient'     (line 382)  — v_song_end > v_pass_expires
                  free shortfall path     (v_charge > v_remaining → upgrade_required)
```

The R6 *conclusion* is unchanged — the SQL performs the same duration arithmetic, so the paid unit
was still the video. What changes is the **cost of E1**: removing the meter from the authority is a
database function change, i.e. a production migration, not a TypeScript edit.

---

## PART A/B — PLAYBACK INTEGRITY — **HELD**

### The complete refusal census (§B)

Every shipping location where a quota concept can refuse a song start:

```
AUTHORITATIVE (production)
  karaoke_begin_song_v2                     duration_unavailable · pass_insufficient · free shortfall
    ├ v_dur      (video duration)           duration_unavailable when unresolved
    ├ v_charge   (lease extension)          compared against v_remaining
    ├ v_remaining (FREE entitlement)        karaoke_free_minutes_entitlement_at_v2
    ├ v_pass_expires (ACTIVE/SELECTED)      v_song_end > v_pass_expires → refuse
    └ v_plan = 'FREE' / PRO                 PRO bypasses the meter entirely

MIRRORS / TRANSPORT (no independent authority)
  src/domain/playback-lease.ts authorizeStart      pure, unit-tested, NOT called by the server
  src/app/api/rooms/[slug]/dj/start/route.ts       maps the RPC outcome to 402/503
  src/app/api/rooms/[slug]/dj/pass-turn/route.ts   same outcomes on auto-advance
  src/app/api/rooms/[slug]/requests/[id]/route.ts  same outcomes on promotion
  src/lib/metering.server.ts / rooms.server.ts     typed pass-through of the RPC verdict
```

### Why this is HELD rather than repaired

E1 requires redefining `karaoke_begin_song_v2` so that no quota concept participates in the
start decision. That is a **migration against production**, and:

```
supabase projects list  →  only  gdqqivlzhgtqdqmvndkf  (bty-release-manager)
                           the karaoke project zycwaqignioawtqynopj is NOT listed
.env / DB password      →  absent
wrangler secret list    →  names only, by design; no values are retrievable
```

So this session can neither **apply** the migration nor **validate** it — the function is ~400
lines of PL/pgSQL with pass activation, carryover minting, grace accounting and a lease column,
and authoring a rewrite that cannot be executed even once would be the opposite of a safe forward
repair. §B says *"Trace first, then make the smallest forward contract repair"*; the trace is what
established that the repair is not the shape it appeared to be.

**What is needed to proceed (either one unblocks it):**

```
1  production DB access for the karaoke project (read + migrate), or
2  approval to stand up an isolated LOCAL Supabase (the BUILD 23 pattern, ports 54421/54422)
   so the rewritten function can be executed and its refusal paths proven before any
   production apply
```

### The repair, scoped (ready to write once unblocked)

```
karaoke_begin_song_v2 keeps      room/request validity · event live · the row's queue state ·
                                 lease bookkeeping AS A RECORD (not as a gate)
karaoke_begin_song_v2 drops      every refusal derived from v_dur / v_charge / v_remaining /
                                 v_pass_expires / v_plan
outcome surface                  duration_unavailable · pass_insufficient · upgrade_required
                                 must stop being reachable on the start path
clients                          BUILD 21/23's admission-failure copy becomes dead on that path;
                                 it must not be deleted blindly — pass-turn/auto-advance share it
```

**A hidden-meter warning §B was right to demand.** `MAX_LEASE_SECONDS = 900` is pinned *equal to
the FREE daily limit*, and `trustedLeaseDurationSeconds` fails closed outside `[1, 900]`. So even
after quota removal, **a video longer than 15 minutes would still be refused** — a duration-derived
refusal wearing a sanity-check costume. E1 is not satisfied until that path is addressed too.
(The guest UI already says `15분을 초과해 신청할 수 없어요`, so this is a *product* rule as well as
a technical one, and it needs a Founder decision of its own.)

### §C — user-facing quota surfaces, classified (read-only, nothing changed)

```
1. PLAYBACK-METER-ONLY → remove/hide for 1.0
   access-status chip "FREE · 15m 0s left"       RootView entitlementChip
   UsageBannerView (severity/remaining copy)     usage.remainingSeconds
   TimedPassCardView remaining / expiry / carryover
   pass.wallclock.notice, pass.free_exhausted, pass.selected.*, pass.switch.* copy
   playback.lease.* ("외부 재생 시간 … 남음")
   AdmissionCopy duration/pass-shortfall sentences ON THE START PATH

2. STILL INDEPENDENT BTY FUNCTIONALITY → retain
   room · queue · QR/guests · requests · ready/cancel · saved songs · host controls ·
   event lifecycle · Now Singing / Up Next

3. HISTORICAL / ACCOUNT DATA → retain if truthful
   timed_access_pass_grants rows · karaoke_apple_purchases · issuance attribution ·
   the Sign-In Methods / account surfaces

4. UNCERTAIN → REPORTED, NOT CHANGED
   PRO plan and the PRO pilot request flow. If quota no longer gates playback, "what does PRO
   buy" has no answer in the product today. Founder decision, not an engineering one.
   The 15-minute per-song limit (above) — product rule or removable sanity bound?
```

**Nothing in class 1 was touched**, because removing the UI before the authority would leave the
app hiding a meter that still refuses playback — the exact "silently leave it" failure §E warns
about, inverted.

---

## PART E/F/G — API DATA RETENTION — **HELD**

§E requires a production census **before** the migration, and forbids inferring production age.

```
production DB access   UNAVAILABLE (evidence above)
census                 NOT PERFORMED — and NOT estimated
```

Per §E the destructive-cleanup portion is **HALTED**, and because §E orders the census before §F,
the migration was **not written**. What is already established from *schema* (a schema fact, not a
production inference) stands from R6 Part 3: no table carries an API-fetch timestamp, and
`karaoke_video_durations` carries none at all, so its age is unknowable by construction.

The census SQL is ready to run the moment access exists; it reads counts and timestamps only and
exposes no customer values:

```sql
select 'karaoke_requests' as t, count(*), min(created_at), max(created_at),
       count(*) filter (where created_at < now() - interval '30 days') as older_than_30d
  from public.karaoke_requests
union all select 'karaoke_user_saved_songs', count(*), min(created_at), max(created_at),
       count(*) filter (where created_at < now() - interval '30 days')
  from public.karaoke_user_saved_songs
union all select 'karaoke_video_durations', count(*), null, null, null
  from public.karaoke_video_durations;
```

`karaoke_video_durations` returns NULL timestamps **because it has no timestamp column** — that is
the finding, not a query defect.

---

## PART H — ATTRIBUTION — **HELD** (measured; placement proposed, not implemented)

§H requires showing the exact proposed placement before any visual work, so nothing was changed.

**Source composition, measured:** every result on the guest search surface comes from
`GET /api/youtube/search` → YouTube Data API v3. **There is no second provider**, so no result can
be mis-attributed by labelling the list — but equally, no result is currently identifiable as
YouTube-originated at all. Displayed YouTube API Data per result: title, channel title, thumbnail,
duration.

**Proposed placement (for approval, not built):**

```
A  one attribution line directly beneath the "What do you want to sing today?" results header,
   scoped to the results list it introduces — not a floating global "Powered by YouTube"
B  wording + Brand Feature usage taken from the current YouTube Branding Guidelines rather than
   invented here; if a logo is used it follows current sizing/clear-space rules
C  if the chosen form requires clickable branding, it links to the specific video/channel it
   attributes, never to a generic destination
D  the native Guest surface (GuestRoomView results) takes the same treatment as the web surface
```

Deliberately **not** proposed: a global footer badge. It would fail §H's own test — it does not
identify the actual result source.

---

## PART I — RMF PLAYER — **HELD** (three measured overlay findings)

Measured from `PlayerClient.tsx` + `globals.css`:

```
player element        .player-frame iframe { width:100%; height:100%; border:0 }
container             .player-frame-wrap { position:relative; flex:1; background:#000 }
minimum size          NOT PINNED — no min-width/min-height anywhere. RMF requires ≥200×200,
                      and nothing in the CSS prevents a small breakpoint going under it.   GAP
player params         autoplay:1, playsinline:1, rel:0, modestbranding:1
modestbranding        DEPRECATED and inert — must not be relied on to hide branding.       GAP
simultaneous players  ONE (single YT.Player, created once) — compliant
Referrer-Policy       none set anywhere; browser default strict-origin-when-cross-origin
                      sends the origin to youtube.com. No `noreferrer` path found.  statically OK,
                      to be confirmed live rather than asserted.
```

**Overlays in front of the player — the clearest gap:**

```
.player-note      position:absolute; inset:0            full-bleed over the player
                  (pointer-events:none; shown only pre-ready / no video)
.player-gesture   position:absolute; bottom:8%; z-index:5   an INTERACTIVE button sitting over
                  the lower band of the player — exactly where YouTube's controls live      GAP
.player-fallback  position:absolute                     overlay on the unplayable case
```

RMF forbids overlays, frames or visual elements in front of **any** part of the embedded player,
including its controls. `.player-gesture` is the strongest violation candidate because it is
interactive and control-band-positioned; the other two are non-interactive and state-limited but
are still in front of the player.

**Native iOS handoff, documented:** `PlayHandoff` validates an 11-character id and builds
`https://www.youtube.com/watch?v={id}`, opened via the system opener. There is **no** embedded
player, no WKWebView, no SFSafariViewController (0 references), so the app presents no fake player
and obscures no YouTube attribution — playback is YouTube's own surface.

**Made For Kids:** the app performs **no upload** to YouTube and has no channel-management scope,
so the upload-side MFK workflow is not applicable. Whether embedded playback of a
made-for-kids video imposes obligations on the *embedder* was **not** resolved and is not invented
here.

---

## OUTPUT (§L)

```
PLAYBACK INTEGRITY     HELD   — authority is a Postgres function; migration needs DB access
API DATA RETENTION     HELD   — census impossible without production access; §E forbids inferring
ATTRIBUTION            HELD   — measured; exact placement proposed for approval per §H
RMF PLAYER             HELD   — min-size unpinned, deprecated modestbranding, 3 overlays

CONTENT RIGHTS         E. MULTIPLE_GAPS
```

Build 104 remains the paid-containment milestone and is **unweakened** — nothing in this slice
touched `BTY_PAID_PASSES`, `ReleaseCommerceCapability`, or any commerce path. No native shipping
code changed, so **105 was not minted**.

## What unblocks each

```
1  DB ACCESS for zycwaqignioawtqynopj (read + migrate) — or approval for an isolated LOCAL
   Supabase.  Unblocks BOTH the playback migration and the retention census.
2  Founder decision: does PRO still mean anything once quota stops gating playback?
3  Founder decision: is the 15-minute per-song ceiling a product rule or a removable bound?
   (It is a duration-derived refusal and E1 is not complete while it stands.)
4  Approval of the attribution placement above, then implementation.
5  Approval to repair the player overlays + pin a minimum size.
```

Nothing uploaded. Nothing submitted. No IAP activated. ASC Content Rights untouched.
