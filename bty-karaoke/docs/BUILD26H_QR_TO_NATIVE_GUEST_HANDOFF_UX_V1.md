# BUILD 26H — QR TO NATIVE GUEST HANDOFF UX V1

**Status: PASS / CLOSED — 2026-08-09**

Implemented, promoted to production as the exact pre-verified artifact, and Commander-attested
on a physical device. **G1–G8 all PASS.**

```text
Commit      5f37f34dc7da90ec60432a445556723510294453   (main, pushed, 0/0 vs origin)
Worker      9b2701e4-f4bb-4443-a1f8-29fa33d35c97 @ 100%  (superseded 72b018f1 / BUILD 26G)
Deployment  2026-08-09T04:40:39.402Z
Build       /api/karaoke-build → 5f37f34dc7da
Migration   NONE
Native      NO source change · CFBundleVersion 86 · MARKETING_VERSION 1.0 · xcscheme byte-identical
Tests       web 2395/2395 · tsc clean · production build SUCCESS
            26G localization 81/81 · responsive 16/16 · 26H mutants 8/8
Rollback    72b018f1-b2ad-48c0-92f5-dfe497c2da68 (BUILD 26G, a77b1efc15d5) — preserved
```

## The product rule

> **A QR identifies the room.** Opening the app is **navigation** — not admission, and not
> request creation.

A Guest with the app installed can now enter a valid live Norebang from the QR Web Guest
surface **before entering a name or choosing a song**.

---

## 1. The audit correction — the friction was never a UI boolean

The task was authorized on the assumption that the gate looked like this:

```text
openEnabled = guestName.length > 0 && selectedSong != nil && requestId != nil
```

**It did not exist.** There was no boolean to flip. The dependency was architectural, at the
bottom of the stack:

```sql
-- 20260730120000_karaoke_guest_app_handoffs.sql
source_request_id uuid not null unique references public.karaoke_requests(id) on delete cascade
```

A handoff row **cannot exist without a real request row**. Everything above it was a faithful
consequence, not a mistake:

| Layer | Behaviour |
|---|---|
| DB | `source_request_id` NOT NULL UNIQUE FK → `karaoke_requests` |
| Service | `createGuestAppHandoff` refuses: `REQUEST_NOT_FOUND` / `REQUEST_ROOM_MISMATCH` / `EVENT_INVALID` |
| API | `POST /api/guest-app-handoffs` → 400 `INVALID_REQUEST` without `requestId` |
| Web | `maybeShowAppInvite(String(req.id))` called from exactly one place — the submit-success branch |
| CTA | `resolvePersistentCta` active only when a Universal Link exists; otherwise a disabled button |

The codebase already said so, in a comment predating this build: *"a handoff REQUIRES a
source_request_id — no fake request is ever created."*

**Implementation was therefore halted at the audit and the difference reported before any code
was written.** The repair chosen was the one the contract mandates: **separate room navigation
from request handoff** rather than relax the column or fabricate a request.

## 2. Final architecture

Two identifier forms now share the **one** already-AASA-claimed path. Nothing was migrated,
nullable-ised, or faked.

```text
request-backed   /app/join/<32-char-token>     DB-backed, source_request_id required   UNCHANGED
room-only        /app/join/rnav1-<slug>        no row, no writes, revalidated live     ADDED
```

### Disjointness is structural — and the prefix is not the proof

Measured, not assumed: `randomToken(24)` is base64url of 24 bytes. 24 is divisible by 3, so
there is never padding — a real token is **always exactly 32 characters** (verified over 2000
samples). Its alphabet is the full 64-symbol base64url set, which is byte-for-byte the charset
the native parser accepts, so **no character exists that a token cannot contain** and a
character-based namespace is impossible.

Length is therefore the only structural axis, and it is enforced as an invariant:

> a room-nav identifier is **never** 32 characters, and never below the resolver's 8-character
> guard — by construction, for every slug length.

A bare `rnav1-` prefix alone would **not** be collision-proof, and a test asserts exactly that by
feeding a hand-crafted 32-character string inside the namespace and requiring refusal.

**Belt and braces:** the resolver tries the real hash-backed token **first, always**. A genuine
handoff can never be re-interpreted as navigation even if the length invariant were broken by a
future token-format change.

### Zero-write contract

Room-only resolution is all reads. Every DB call the resolver makes is recorded in test and
classified read-vs-write:

| | |
|---|---|
| request writes | **0** |
| queue writes | **0** |
| admission writes | **0** |
| handoff-table writes | **0** |
| handoff-audit writes | **0** |

`open_count` / `first_opened_at` / `last_opened_at` are deliberately **not** stamped. That
telemetry belongs to a real request-backed handoff, and simulating it would corrupt that funnel
with navigation that never happened.

Repeated opens are idempotent by construction: nothing is stored, so there is no counter to
advance. A malformed identifier never reaches the database at all.

### Live event revalidated on every resolve

The current live Event is checked **at resolve time**, never trusted from the identifier or from
whatever was live when the CTA rendered. The exact scenario is covered: CTA shown while live →
Guest waits → Host ends the event → the open refuses safely. Never a previous, latest-ended, or
synthesized event.

### Native

**NO source change.** `GuestJoinContext.make(roomSlug:)` already accepted a slug alone; the
envelope shape is unchanged; `handoffId` carries an explicit non-UUID marker `room-nav:<slug>`
that Native decodes and never reads. No UUID was fabricated, and the **already-installed build
works as-is**. CFBundleVersion stayed 86, MARKETING_VERSION 1.0, xcscheme bytes untouched.

The uncommitted BUILD 26F localization work in the Native tree was preserved exactly — 30 dirty
entries before and after, not cleaned, staged, reverted, or normalized.

### Language authority unchanged

No locale is passed. The identifier is byte-identical in both languages — measured in-browser:
EN "View in the app" and KO "앱에서 보기" render **the same href**. BUILD 26F / 26G authority
stands: Web Guest language is the Web Guest's, Native Guest language is the device's, and the
room's language controls neither.

## 3. The consent qualification — stated plainly

The real sequence is:

```text
QR → required first-use consent (one tap) → Open in App available immediately
```

**not** QR → CTA. The app CTA lives inside `RequestForm`, which is wrapped in
`GuestConsentGate`; that gate returns `null` until its client effect runs, so a brand-new Guest
sees nothing in that slot until they accept.

This is **pre-existing** — `PersistentAppEntry` has always lived there — and it was **not
bypassed or moved**. Consent is a legal gate, categorically different from the name/song/request
friction BUILD 26H was scoped to remove; relocating it is a product/legal decision, not a
refactor. It is recorded here so "immediately" is never read as stronger than it is.

The qualification was discovered during preview verification, not asserted afterwards: the
in-browser check accepts consent **before** measuring, which is why the CTA numbers in this
document are honest rather than flattering.

## 4. The first G1 failure — recorded, not backdated

**G1 initially FAILED on the Founder's device**, showing:

> "This app link can't be opened. The link has expired or is not valid."

**It was not a defect in BUILD 26H. 26H was not the code under test.**

At that moment production was still serving **BUILD 26G** (`a77b1efc15d5`, Worker `72b018f1`);
26H existed only as a preview version, exactly as authorized. Measured at the time:

| Origin | Build | `rnav1-bty-home` |
|---|---|---|
| production | `a77b1efc15d5` | **404** `{"resolution":"invalid"}` |
| 26H preview | `5f37f34dc7da` | **200** `{"resolution":"active", …}` |

Same identifier, same instant, same live room — the only variable was the deployed build. The
room was confirmed live (`eventStatus: active`), ruling out the no-live-event guard.

**Which guard rejected it:** the **token-hash lookup inside the legacy resolver**. Verified
against the deployed commit's own source (`git show a77b1efc:…/route.ts`), 26G imports and calls
only `resolveGuestAppHandoff` — `isRoomNavIdentifier` and `resolveRoomNavigation` do not exist in
it. So `rnav1-bty-home` passed the length guard, matched no stored hash, and became `invalid`,
with no room-navigation branch to fall through to.

**A second, independently fatal fact surfaced in the same diagnosis:** the CTA href is pinned to
the production origin by design (`canonicalUniversalLink` always uses the fixed AASA origin,
never the request origin). So tapping the CTA sends the tap to **production even when the page
was opened on the preview URL** — meaning this feature **cannot be gated on a preview URL at
all**, and G1 could not have passed from either surface.

**Was Native reached?** The observed copy exists in both surfaces, so the message alone does not
answer it. Comparing catalogs: the Web fallback renders *title + body* together
("This app link can't be opened" / "The link has expired or is not valid."), while Native has the
title string but **no matching body string**. The Founder saw both, so the evidence indicates
**Safari's web fallback rendered it**. Whether iOS declined to intercept, or intercepted and the
app bounced back, was not determinable from this evidence and was not asserted.

26H was then promoted as the exact pre-verified artifact — no rebuild — and the gate was rerun
successfully.

## 5. Rollout convergence — the claim waited for the evidence

Immediately after promotion, production returned a **mix** of builds while the Cloudflare control
plane already reported 100%: old isolates draining. Polling to convergence:

| Round | Result |
|---|---|
| 1 (40 samples, both origins) | 38 × 26H, **2 × 26G** — not converged |
| 2 (60 samples) | **60 / 60 26H** |
| 3 (50 samples, confirmation) | **50 / 50 26H** |

The build was **not** declared deployed until it converged. This is the second consecutive build
to show the behaviour (BUILD 26G did the same), and it is now a known property of this Worker's
rollout: a single early sample will report a deploy as clean before it is.

## 6. Verification

| | |
|---|---|
| Web suite | 2342 → **2395 / 2395** |
| `tsc --noEmit` | **0 errors** |
| Production build | **✓ Compiled successfully** |
| BUILD 26G localization | **81 / 81** |
| Responsive (Chromium + WebKit × en/ko × 320/375/390/430) | **16 / 16 clean** |
| BUILD 26H mutants | **8 / 8 killed** |

Mutants killed: name required again · requestId required again · live-event validation removed ·
room-only writes handoff telemetry · room-only creates a request · Web locale injected into the
identifier · resolution order broken · disjointness weakened to a bare prefix.

**A real defect was found by these tests during development and fixed:** a short slug produced a
7-character identifier — below the resolver's pre-lookup guard — and would have failed for a
reason unrelated to the room. The builder now enforces both length bounds for every slug length.

### Production smoke (post-promotion, read-only)

| Check | Result |
|---|---|
| `/api/karaoke-build`, both origins | `5f37f34dc7da` |
| `rnav1-bty-home`, both origins | **200 / active**, `handoffId: room-nav:bty-home` |
| unknown room / malformed / garbage | identical generic `404 {"resolution":"invalid"}` |
| CTA at 390px, name empty, no song — EN | enabled link → `…/app/join/rnav1-bty-home` |
| CTA at 390px, name empty, no song — KO | enabled link → **same href**, localized label |
| Application writes during verification | **0** (only Cloudflare's own RUM beacon) |
| Queue before/after verification | unchanged — `waitingCount 1`, stats identical |
| BUILD 26G locale resolution on production | EN→English · KO→Korean · FR→English · KO+stored `en`→English |

## 7. Known limitations and deferrals

- **The request-backed handoff was verified read-only, not end-to-end.** Its reachability and
  ordering are proven (a 32-char token still routes to the legacy resolver; room-nav never claims
  a 32-char id; ordering is unit-tested and mutation-covered), but no live token was minted and
  resolved. At verification time `bty-home` had **a real guest song waiting on a live event**, and
  injecting a test request into a possibly-live queue was judged a worse risk than the marginal
  evidence. `bty-home` was the only room with a live event, so no isolated path existed. **Open:
  run the full lifecycle (request → mint → resolve → cancel) at a quiet time.**
- **Room-slug probing** through this resolver is possible. Accepted: room existence is already
  observable via the public `/r/<slug>` surface, only Guest-public fields are returned, refusals
  are one generic outcome, and the existing rate limiter is untouched.
- **`expiresAt` is advisory** for room navigation — nothing is stored, and revalidation on every
  open is strictly stronger than a TTL. Native decodes and ignores it (pinned by test).
- **No live event → no room-nav CTA.** The informational disabled state is preserved and the
  resolver refuses anyway.
- **The one-time post-request invitation still requires a request**, by design. That path is
  untouched.

## 8. "BTY Norebang Admin" — audit only, deferred

**Not changed by BUILD 26H.**

Authoritative source: **`INFOPLIST_KEY_CFBundleDisplayName = "BTY Norebang Admin"`** in
`project.pbxproj` (Debug and Release), confirmed in the built bundle. Not `CFBundleName`
(`BTYNorebangAdmin`, the target name), not `PRODUCT_NAME` (`$(TARGET_NAME)`), and not the Web
side — there is no `apple-itunes-app` / Smart App Banner meta and `appStoreUrl` is `null`.

Changing it to "BTY Norebang" is a **display-metadata edit only**: it does not affect
`PRODUCT_BUNDLE_IDENTIFIER` (`com.bty.BTYNorebangAdmin`), the target name, schemes, signing, the
associated-domains entitlement, or the AASA `appIDs` entry. The App Store listing name is managed
in App Store Connect, not here.

**Deferred to a separately authorized build.**

## 9. Device gates — G1–G8 PASS

Executed by the Commander on a physical device against production after promotion.

| Gate | Result |
|---|---|
| G1 — immediate handoff, no name and no song | PASS *(after promotion; see §4)* |
| G2 — Native opens the intended Guest room | PASS |
| G3 — zero request / queue / admission side effects | PASS |
| G4 — Continue on Web remains normal | PASS |
| G5 — Web Korean + Native English → Native English | PASS |
| G6 — Web English + Native Korean → Native Korean | PASS |
| G7 — open → back → reopen → repeated open | PASS |
| G8 — app unavailable, Guest can continue on Web | PASS |

## 10. Preserved exactly

Unchanged by this build: database schema, migrations, QR room identity semantics, Guest admission
authority, request creation authority, queue authority, cancel capability, playback authority,
Pass/FREE accounting, entitlement logic, Host behaviour, auth/account behaviour, StoreKit scope,
BUILD 26F localization, BUILD 26G Web localization and locale persistence, Native language
authority, MARKETING_VERSION 1.0, and the existing xcscheme bytes.

The 26H commit touches **8 files, all under `bty-karaoke/src/`** — **0** under `supabase/`,
`*.sql`, `wrangler.toml`, `open-next.config.ts`, `next.config.mjs`, or `bty-app/`.

Pre-existing dirty/untracked files were preserved throughout and deliberately excluded from the
commit: `docs/BUILD17_TIMED_ACCESS_PASS.md` (modified), `brand/` (untracked),
`docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md` (untracked), and
`docs/BUILD26G_QR_WEB_GUEST_KOREAN_ENGLISH_LOCALIZATION_V1.md` (untracked).
