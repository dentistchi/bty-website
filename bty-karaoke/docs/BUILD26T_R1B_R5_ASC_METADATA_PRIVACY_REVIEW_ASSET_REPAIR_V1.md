# BUILD 26T-R1B-R5 — ASC Metadata / Privacy / Review-Asset Repair

**Status: HELD — 2026-08-14. Preparation complete; three gates await Founder action.**

**No build uploaded. No build attached or selected. Nothing added for review. Nothing submitted.
No ASC field written by this session. No catalog write. `PASS_1H` inactive.**

This session cannot drive a browser, so it did not write App Store Connect and does not claim to
have. What follows is the prepared write package (§J), grounded in a source-to-server data-flow
census (§C) rather than in assumption.

---

## 1. Verdict

```
BUILD 26T-R1B-R5                      HELD          preparation complete, Founder gates open
App Privacy forensic census           COMPLETE      8 declarable types (timezone resolved §3.7)
privacy policy consistency            NO CONTRADICTION FOUND · 1 disclosure gap (§4.3)
privacy policy amendment              SHIPPED       §4a live in production, proven 200 (§14)
privacy / support URL live            PROVEN        HTTP 200 both, measured this session
Korean version metadata               READY_TO_ENTER  description · keywords · support URL
copyright holder                      APPROVED      "2026 Hanbit Chi"
App Store screenshots                 FOUNDER_CAPTURE_REQUIRED  no CLI path exists (§6.1)
IAP review screenshots (×3)           PREPARED      Founder-approved capture, alpha stripped (§7)
App Review contact fields             FOUNDER_INPUT_REQUIRED  must not be guessed
App Review demo credentials           AUTHORIZED — not yet created or proven (§8.3)
release mode → Manual                 READY_TO_ENTER
build 100                             NOT UPLOADED (unchanged, deliberate)
PASS_1H                               INACTIVE (no write issued this session)
```

**Founder decisions of 2026-08-14 are recorded inline** at §3.5, §3.7, §4.3, §5.4 and §8.3.
The only production change made under them is the policy-only repair in §14.

**R1B-R5 is HELD, not PASS.** §M forbids faking a PASS when Founder input is the remaining item,
and here Founder input is three items, not one.

---

## 2. What this session did not do

```
build 100 upload / attach / select    NOT PERFORMED
Add for Review / submission           NOT PERFORMED
IAP submission                        NOT PERFORMED
ASC field writes                      NONE  (no browser, no ASC API key — see R1B memory)
karaoke_product_catalog write         NONE
Apple purchase                        NONE
production reviewer account creation  NOT PERFORMED — authorization requested instead
code changes                          NONE — no shipping defect was found
.xcscheme Founder edit                UNTOUCHED
Localizable.xcstrings                 UNTOUCHED
TRACK_B0                              UNTOUCHED
```

---

## 3. §C — App Privacy forensic: source-to-server data-flow census

Method: read-only inspection of the shipping iOS sources (53 Swift files, 21,911 lines), the
Xcode project, the resolved package graph, the server route handlers, and the Supabase migration
schema. No customer values were read or reproduced.

### 3.1 The third-party surface, enumerated rather than assumed

The whole resolved package graph, from `Package.resolved`:

```
GoogleSignIn-iOS 9.2.0      ← the ONLY direct dependency (products: GoogleSignIn, GoogleSignInSwift)
  AppAuth-iOS 2.1.0                 transitive
  GTMAppAuth 5.0.0                  transitive
  gtm-session-fetcher 3.5.0         transitive
  GoogleUtilities 8.1.2             transitive
  app-check 11.3.1                  transitive
  interop-ios-for-google-sdks 101.0.0   transitive
  promises 2.4.1                    transitive
```

Zero analytics, advertising, attribution, or crash-reporting SDKs. Proven by absence *and* by the
absence of every API that would use one:

```
Analytics / Crashlytics / Sentry / Firebase        0 references
ATTrackingManager / AppTrackingTransparency        0 references
advertisingIdentifier (IDFA)                       0 references
identifierForVendor (IDFV)                         0 references
CoreLocation / CLLocation                          0 references
PhotosUI / PHPicker / UIImagePicker / AVCapture     0 references
Contacts / CNContact / HealthKit / AVAudioRecorder  0 references
WKWebView / SFSafariViewController                  0 references
INFOPLIST_KEY_NS*UsageDescription                   0 keys in the project
```

The last line is the structural corroboration: an app that touched location, camera, photos,
microphone or contacts could not launch those APIs without a usage-description key, and there is
not one in either configuration.

**On-device diagnostics.** `PerfSignpost.swift` emits `os_signpost` markers under subsystem
`com.bty.BTYNorebangAdmin`. Those are consumed by Instruments over a local debug connection; they
are not transmitted anywhere by the app. **Not a collected data type.**

**Worker-side log retention.** `wrangler.toml` declares no `[observability]` and no logpush. No
request-log retention is configured.

### 3.2 The data-flow matrix

Every row is a data type that **leaves the device**. Purpose is App Functionality for all of them;
none is used for tracking; none goes to a data broker; none is used for advertising.

| # | DATA TYPE | Source field / endpoint | Persisted (table.column) | Linked | Tracking | Third party | Proposed ASC category |
|---|---|---|---|---|---|---|---|
| 1 | Email address | Apple/Google ID-token `email` claim, verified server-side at `POST /api/host/auth/apple` · `/google` | `karaoke_accounts.email`, `karaoke_account_identities.email` | **YES** | NO | Apple, Google (as identity providers) | Contact Info → **Email Address** |
| 2 | Name | host `displayName` (Apple full name, first authorization only) → auth routes; guest `guestName` → `POST /api/rooms/{slug}/requests` | `karaoke_accounts.display_name` (≤80), `karaoke_requests.guest_name` (1–40) | **YES** | NO | — | Contact Info → **Name** |
| 3 | User ID | account id; opaque host session token; `purchase_owner_ref`; `authority_ref` | `karaoke_accounts.id / purchase_owner_ref / authority_ref`, session rows | **YES** | NO | Apple (as StoreKit `appAccountToken`) | Identifiers → **User ID** |
| 4 | Purchase history | StoreKit signed transaction → `POST /api/host/purchases/apple/verify` (body is exactly one field) | `karaoke_apple_purchases` (apple_transaction_id, original id, environment, product), `karaoke_timed_pass_grants` | **YES** | NO | Apple | Purchases → **Purchase History** |
| 5 | Search history | `GET /api/youtube/search?q=` (public, server holds the API key); `searchQuery` in the request body | `karaoke_requests.search_query`; KV search cache keyed by biased query, TTL 1h, **carries no user identifier** | **YES** | NO | Google/YouTube (server-side Data API call) | **Search History** |
| 6 | Song requests + saved songs | `youtubeVideoId`, `youtubeTitle`, `youtubeChannelTitle`, `youtubeThumbnailUrl`; `POST /api/host/saved-songs` | `karaoke_requests.*`, `karaoke_user_saved_songs.*` | **YES** | NO | — | User Content → **Other User Content** |
| 7 | Playback / queue activity | queue lifecycle + external-playback metering (BUILD 20M lease, FREE window) | `karaoke_requests.started_at/completed_at/status`, lease + usage-segment rows | **YES** | NO | — | Usage Data → **Product Interaction** |

### 3.3 What is sent to a third party, and what is not

```
Apple    identity token + nonce HASH (Sign in with Apple) · StoreKit purchase, carrying
         appAccountToken = purchase_owner_ref (an OPAQUE per-account UUID, deliberately NOT the
         account primary key — BUILD 26E)
Google   Google Sign-In authentication (GoogleSignIn SDK); the ID token is returned to the app,
         forwarded once to OUR server, and never stored on the device
YouTube  search terms reach the YouTube Data API through OUR SERVER (the key never reaches the
         app); the device itself contacts img.youtube.com for thumbnails and opens
         youtube.com/watch?v=… for playback handoff
Nobody   no data broker, no ad network, no analytics vendor
```

### 3.4 Stored ONLY on-device (traced, and they do not leave)

`PrivacyInfo.xcprivacy` already declares `NSPrivacyAccessedAPICategoryUserDefaults` / **CA92.1**
(BUILD 26T-R1B-R1). These keys are app-private `UserDefaults`, no app group, and none of them is
transmitted:

```
bty.guestsession.v1 · bty.guestsessionrestore.v1 · bty.guestcap.v2.<slug> ·
bty.guestresolved.v1.<slug> · bty.guestintent.v1 · bty.pendingGuestHandoff.v1 · bty.savedsongs.v1
```

Two of these deserve the explicit note, because a careless reading would over-declare them:

- **`guestSessionId` is NOT sent.** The guest request body is built by exactly one function,
  `guestRequestBody(_:)`, and it emits `youtubeVideoId`, `guestName`, `idempotencyKey`, and the
  optional title/channel/thumbnail/searchQuery/eventId. The session id is not among them.
- **`bty.savedsongs.v1`** is the *local* saved-song store used before a Host account exists; the
  account-backed library is the separate server table in row 6.

A value that only ever lives in `UserDefaults` is not an ASC-collected data type, and these were
traced rather than presumed.

### 3.5 IP address — a reasoned position, stated openly rather than buried

The app never sends an IP address as data. The server reads `cf-connecting-ip` /
`x-forwarded-for` at four routes (`/api/host/auth/apple`, `/api/host/auth/google`,
`/api/guest-app-funnel`, `/api/guest-app-handoffs`) and uses it for **one** purpose: abuse rate
limiting. What is stored is not the IP:

```
src/lib/rate-limit.server.ts
  ipPseudonym()   HMAC-SHA256(dedicated KARAOKE_RATELIMIT_SECRET, "roomId|ip") → 128-bit hex
  storage         Cloudflare KV, TTL'd (IP_WINDOW 900s / IP_LOCK 900s / ROOM_WINDOW 3600s)
  raw IP          never written to a table, never logged
```

**Position: do not declare an IP-derived data type.** The raw value is never persisted, the
pseudonym is one-way and expires, the use is security-only, and no user-facing feature reads it.
The raw IP that Cloudflare processes to deliver the request is inherent to any network service and
is disclosed as such in the privacy policy §9. **This is a judgement, and it is recorded here so
the Founder can overrule it rather than discover it.**

> **FOUNDER DECISION 2026-08-14 — omission APPROVED**, on the measured architecture above: raw IP
> never persisted, transformed for rate limiting only, short-lived HMAC token alone retained.
> Directed: disclose the short-lived pseudonymous anti-abuse identifier in the policy amendment,
> and **do not classify it as Coarse Location**. Both done — §14.

### 3.6 Account deletion and export

Deletion is in-app (Account → Delete Account), server-authoritative (BUILD 26E/26I), and erases
email, display name and timezone from the account record while keeping an anonymized tombstone so
19 foreign keys keep a valid target. Verified in the shipping app and in migration
`20260809120000`. **There is no data-export feature** — no export path exists in
`AccountDeletion.swift` or anywhere else. Deletion requests by email are offered by the policy §12.

### 3.7 The one uncertainty — NOT guessed

**TIMEZONE.** `POST /api/host/timezone { timezone }` sends the device's IANA timezone (e.g.
`Asia/Seoul`) once per account; it is persisted to the account row and decides the daily FREE-reset
boundary. It leaves the device and it is linked to the account, so it is **collected**. What is
uncertain is only its **ASC category**:

```
candidate A   Other Data → Other Data Types      (recommended)
candidate B   Location → Coarse Location          (an IANA zone names a city, but it is a device
                                                   SETTING, not a Location Services reading)
candidate C   not declared                        (defensible; also the riskiest error)
```

Per the §C instruction this was **HALTED, not guessed**. Recommendation was **A**, with purpose App
Functionality, Linked YES, Tracking NO — over-declaring here costs nothing, under-declaring is the
error that matters.

> **FOUNDER DECISION 2026-08-14 — RESOLVED as A.**
> `Other Data → Other Data Types` · Purpose **App Functionality** · Linked to user **YES** ·
> Used for tracking **NO**. The declarable set is therefore **8 types**, not 7. The policy
> amendment states in both languages that the time zone is not location data and is not derived
> from location services, matching this classification (§14).

### 3.8 Everything measured as NOT collected

```
Health & Fitness · Financial Info (payment is handled end-to-end by Apple; the app never sees a
card or bank detail) · Precise Location · Sensitive Info · Contacts · Browsing History ·
Photos or Videos · Audio Data · Gameplay Content · Customer Support · Emails or Text Messages ·
Advertising Data · Device ID · Crash Data · Performance Data · Other Diagnostic Data
```

**Device ID — why NOT declared.** The room device token is a random, server-issued, revocable
bearer credential scoped to a room; it is not a device-level identifier in Apple's sense (IDFA,
IDFV, hardware ID), and neither IDFA nor IDFV is read anywhere in the app. It is covered by row 3
(User ID). Stated explicitly because "the app has a device token" would otherwise look like an
undeclared Device ID.

**Tracking = NO, across every type.** No ATT prompt exists, no IDFA is read, no advertising or
analytics SDK is linked, and no data leaves for a data broker. Nothing is combined with
third-party data to target advertising or measure it.

---

## 4. §D — Privacy policy consistency

### 4.1 Both endpoints live, measured this session

```
https://norebang.btydaily.com/privacy    HTTP 200   56,446 bytes   (ko + en, effective 2026-07-19)
https://norebang.btydaily.com/support    HTTP 200   18,592 bytes
```

### 4.2 No contradiction found

The policy scope clause (§2) explicitly names the iOS app: *"This policy covers the public
btyNorebang web service **and the BTY Norebang iOS app**. They are the same service."* Checked
against the §3.2 matrix, the policy's statements hold:

```
display name, search terms, chosen video, song request record   §3, §4   MATCHES rows 2, 5, 6
"We do not use analytics, advertising, or third-party tracking
 services, and we do not sell personal information"             §4       MATCHES §3.1 (0 SDKs)
Google Sign-In is authentication only, no YouTube scopes        §5       MATCHES GoogleAuthReal
                                                                         (no extra scopes requested)
server-side YouTube key, never exposed to the client            §13      MATCHES the search route
Cloudflare KV search cache ≤ 1 hour                             §11      MATCHES the KV TTL
processors: Google/YouTube, Cloudflare, Supabase                §9       MATCHES the deployment
"Cloudflare processes … IP address … inherent to any website"   §9       MATCHES §3.5
host account deletion: email, display name, time zone erased;
 identities deleted; sessions revoked; Google/Apple grants
 withdrawn; saved songs deleted; tombstone retained             §12a     MATCHES BUILD 26E/26I
```

### 4.3 One disclosure gap — reported, not silently repaired

The policy's **collection** sections (§3 "Information you provide", §4 "Information created
through use") were written for the guest web flow and enumerate guest data only. Four host-scoped
data types appear in the policy **only inside the deletion section §12a**, which discloses them by
saying they are erased:

```
email address            disclosed only at §12a   (collection not described in §3/§4)
host display name        disclosed only at §12a
time zone                disclosed only at §12a
saved songs              disclosed only at §12a
purchase / pass records  §12a mentions "pass records … kept for accounting" and "an opaque
                         reference … so any future purchase or refund can be honoured";
                         purchase data COLLECTION is nowhere described
```

**This is an incompleteness, not a contradiction** — the policy never asserts anything that the
code disproves. So §D does not halt App Privacy publication. But the App Privacy disclosure the
Founder is about to publish will declare **Email Address, Name, User ID and Purchase History**, and
a policy whose collection sections do not mention them is a weak spot a reviewer or a regulator can
see.

**Recommendation (NOT performed at the time — §D forbids rewriting the policy in this slice): add
one short "Host account information" subsection to §3/§4 covering email address, display name, time
zone, saved songs, and Apple purchase records, before publishing App Privacy.**

> **FOUNDER DECISION 2026-08-14 — one minimal production policy amendment AUTHORIZED**, to be
> deployed and proven 200 before the ASC App Privacy disclosure is published. Performed: **§14**.

---

## 5. §E — App version metadata package (Korean)

### 5.1 Description — READY_TO_ENTER

Every sentence below maps to functionality proven in the shipping Release app during this census
(source: `Localizable.xcstrings` ko strings + the corresponding view/service code). It makes **no
claim that passes can currently be purchased**.

```
BTY Norebang은 모임과 홈파티를 위한 노래방 진행 앱입니다. 호스트가 노래방을 열면 손님은 QR 코드로
바로 참여해 부르고 싶은 노래를 신청하고, 모두가 같은 대기열을 함께 봅니다.

■ 호스트
· Apple 또는 Google 계정으로 로그인하고 내 노래방을 만듭니다.
· 노래방을 시작하면 손님 초대용 QR 코드와 새 대기열이 만들어집니다.
· 대기열 순서 변경, 신청곡 삭제, 다음 곡으로 넘기기를 한 화면에서 처리합니다.
· 재생은 YouTube로 넘겨서 진행하고, 지금 부르는 노래와 다음 곡을 계속 확인할 수 있습니다.
· 자주 부르는 노래는 '내 노래'에 저장해 두고 다시 꺼내 쓸 수 있습니다.

■ 손님
· QR 코드로 참여하고, 앱에서는 게스트 모드로 바로 들어옵니다.
· 노래를 검색해 신청하고, 내 순서가 어디쯤인지 실시간으로 확인합니다.
· '준비됐어요'로 호스트에게 알리고, 아직 부르기 전이라면 직접 신청을 취소할 수 있습니다.
· 내 신청곡이 대기열에서 사라졌다면 그 이유를 앱이 알려줍니다.

■ 이용 시간
· 매일 무료 이용 시간이 제공됩니다.
· 1시간 · 4시간 · 24시간 이용권을 보유한 경우, 선택해서 이용 시간을 늘릴 수 있습니다.
· 이용권은 선택만으로 시작되지 않습니다. 첫 곡이 실제로 재생될 때 시작됩니다.
· 시작된 뒤에는 재생을 멈추거나 앱을 닫아도 만료될 때까지 시간이 흐릅니다. 남은 시간은 화면에서
  언제나 확인할 수 있습니다.

■ 그 밖에
· 한국어와 영어를 지원합니다.
· 계정 삭제는 앱 안에서 직접 할 수 있습니다.

BTY Norebang은 YouTube에 공개된 영상을 검색해 신청하고, 재생은 YouTube로 넘겨 진행합니다.
YouTube 및 Google과 제휴하거나 후원받는 앱이 아닙니다.
```

Two lines earn their place for honesty rather than marketing: the wall-clock warning (the app's own
`pass.wallclock.notice`) and the non-affiliation line.

### 5.2 Keywords — READY_TO_ENTER (57 / 100 characters)

```
노래방,가라오케,노래신청,대기열,홈파티,모임,호스트,이용권,행사,파티,신청곡,노래방앱,QR,플레이리스트
```

No competitor or third-party brand name (금영 / TJ / YouTube are all deliberately absent), no term
already in the app name, no repetition, no misleading claim.

### 5.3 Support URL — READY_TO_ENTER

```
https://norebang.btydaily.com/support        proven HTTP 200 this session
```

### 5.4 Copyright — APPROVED

```
2026 Hanbit Chi        FOUNDER-APPROVED 2026-08-14
```

Measured basis: the Apple Developer team resolved during R1B-R3 distribution is **`Hanbit Chi`**,
team `CS92W2HFCH`, and the distribution certificate common name is `Apple Distribution: Hanbit Chi
(CS92W2HFCH)` — an individual, not a company. The privacy policy's operator string is *"BTY (Better
Than Yesterday), operated by Dr. Chi"*, which reads as a trade name over the same individual rather
than a separate legal entity. The Founder has confirmed the legal entity, so the value is entered
as approved rather than inferred.

### 5.5 Deliberately left blank

Promotional Text and Marketing URL are optional and are **not** invented to fill a blank field.
No new localization is created — Korean is the version localization already present.

---

## 6. §F — App Store screenshot asset

### 6.1 The capture route, measured

```
xcrun devicectl list devices     "Hanbit Chi's iPhone"  iPhone 17 Pro Max (iPhone18,2)  CONNECTED
xcrun devicectl device --help    subcommands: copy, info, install, notification, orientation,
                                 process, reboot, sysdiagnose, uninstall
                                 → NO screenshot subcommand
idevicescreenshot / ideviceinfo  not installed
```

**There is no CLI path from this session to a physical-device screenshot.** `simctl io screenshot`
exists but is simulator-only, and a simulator cannot show real App Store prices without a StoreKit
configuration file — which would be fabricated UI, forbidden by §F and §G. So the honest capture
route is the Founder's device, and this is reported as a measured limit rather than presented as if
it had been solved.

### 6.2 What the Founder captures — FOUNDER_CAPTURE_REQUIRED

Release build (build 100 is already installed on the connected iPhone 17 Pro Max), Side button +
Volume Up. A native screenshot is already **1320 × 2868**, an accepted 6.9" size — do not crop or
scale it.

```
6.9-01-queue.png       the running norebang: 지금 부르는 노래 + 다음 곡 + 대기열
6.9-02-guest.png       the guest request surface: search result / 신청하기 / my position
6.9-03-pass.png        the timed-pass surface: 1시간 · 4시간 · 24시간 with App Store prices
```

One is the minimum §M requires; three is the recommendation, and they are the same three screens
the IAP asset needs, so one capture session covers §F and §G together.

Constraints, restated because they are the ones that get violated by accident: Release UI only, no
DEBUG gate visible, no developer overlay, no console output, **no guest name or email belonging to
anyone but the Founder**, no fake UI.

Deliver to `bty-karaoke/release-assets/appstore/1.0/screenshots/`. Dimensions and SHA-256 will be
verified and recorded here on arrival; if ASC still demands a separate 6.5" set, the 1320 × 2868
originals will be downscaled to 1284 × 2778 locally rather than re-shot.

---

## 7. §G — IAP App Review screenshots

```
com.btydaily.norebang.pass.1hour
com.btydaily.norebang.pass.4hour
com.btydaily.norebang.pass.24hour
```

**One honest source screenshot serves all three records**, and the reason is measured, not assumed:
BUILD 26T-R1A recorded the Release commerce surface physically showing all three rows —
`1시간`, `4시간`, `24시간` (`pass.type.one_hour` / `four_hours` / `twenty_four_hours`) — each beside
its own App Store price, with `storekit offered=3`. A single capture of that surface therefore shows
each item, individually labelled and individually priced, which is exactly what the IAP review
screenshot is for.

> **FOUNDER DECISION 2026-08-14 — APPROVED, and the asset is now PREPARED.** One clean Release
> screenshot showing Access Status · Buy a pass · 1 hour $1.99 · 4 hours $4.99 · 24 hours $9.99
> serves all three IAP Review Screenshot fields, because all three products are individually and
> unambiguously visible. Directed: use the **original iPhone Photos file at native 6.9-inch
> resolution**, never a re-uploaded/resized copy. **This does not authorize activation.**

### 7.1 The delivered asset

Founder-captured on the connected iPhone 17 Pro Max, Release build. Provenance was checked rather
than trusted — a resized copy could not survive this test:

```
native size            1320 × 2868   = the iPhone 17 Pro Max screen, an accepted 6.9" size
EXIF ImageDescription  "Screenshot"          DateTimeOriginal 2026:08:14 22:37:05
EXIF GPS IFD           ABSENT                no Make / Model / Software tag
private data in frame  NONE — no guest name, no email, no customer identifier
DEBUG gate / overlay   NONE · console output NONE · fabricated UI NONE
```

### 7.2 The defect the file arrived with — an alpha channel

App Store Connect **rejects screenshots containing an alpha channel**, and the original had one:

```
source PNG colortype   6 (RGBA), bitdepth 8
non-opaque pixels      184 of 3,785,760  (0.0049%)
their location         46 px in EACH of the four corners, nothing anywhere else
                       = the device's rounded display-corner arcs
```

Composited over black — what the device physically shows at those corners — and then **proved** the
UI was untouched rather than assumed:

```
fully-opaque source pixels   3,785,576
  RGB preserved exactly      3,785,576
  RGB altered                        0        ← the whole claim
output colortype             2 (RGB), hasAlpha=no, 1320 × 2868
```

Only the 184 corner pixels changed, and only from transparent to black. Not one pixel of app UI
moved. This is format normalization, not retouching.

### 7.3 Files and checksums

```
release-assets/appstore/1.0/iap/
  source/6.9-pass-surface-original.png    250,928 B  sha256 665fe9cffa36001c3ac507074837a0f2
                                                            6eca973b1fe8676df406d9686ab2a9ca
  iap-1h.png                              162,114 B  sha256 6288799eaac1d5ccc601b2ba97393ed9
  iap-4h.png                              162,114 B          83d92f9cff80c79e863b84c8a63a479a
  iap-24h.png                             162,114 B          (all three byte-identical, by design)
```

The untouched original is committed beside the deliverables so the chain from device to ASC stays
auditable. **No product was activated to improve the screenshot, and no enabled Buy state was
fabricated.** The optional 1024×1024 promotional IAP image is not created.

### 7.4 Why the "not on sale" copy is the right thing to show

The frame contains `Passes are not on sale right now.` and three disabled Buy buttons. That is not
a flaw in the asset — it is the Release app telling the truth about a deliberately inactive
production catalog, which is exactly the state BUILD 26T-R1A built the pre-purchase gate to
produce. A screenshot showing an enabled Buy state today would be a fabrication of a condition that
does not exist.

**Founder-recorded, and it is the distinction this whole section turns on:**

```
the ASSET requirement            can be repaired NOW           ← done, §7.3
actual IAP review SUBMISSION     remains BLOCKED until controlled activation makes the
                                 products testable by App Review
```

**⚠ The one thing that must not be misread as an asset problem.** These screenshots satisfy the
*asset* requirement. They do not make an IAP *pass review*. With the production catalog inactive,
a reviewer who taps to purchase is refused, and an IAP that cannot be purchased is normally
rejected. Ordering follows from that: assets now (R1B-R5), **activation before anything is actually
submitted** (R2/R3). Preparing the assets is not authorization to submit.

---

## 8. §H — App Review account and contact — HALTED

### 8.1 The measured auth architecture

```
Release login methods      Sign in with Apple  (SignInWithAppleButton, HostViews.swift:153)
                           Google Sign-In      (GoogleSignIn SDK 9.2.0, identity scopes only)
password / email login     DOES NOT EXIST anywhere in the app
Manager passcode           NOT a login — it authorizes CLAIMING an existing room AFTER a Host
                           session already exists (HostViews.swift:96, :547)
```

`Sign-In required = YES` in ASC is the truthful answer: the host surface is behind authentication.

### 8.2 Why no existing account can be handed to a reviewer

ASC's Sign-In Information requires a **user name and a password**. This app has no password
credential to give:

- Sign in with Apple issues no password we could supply, and a reviewer's own Apple ID would work
  but cannot be typed into ASC's two fields.
- Google Sign-In needs a real Google account's credentials. **No dedicated review account is known
  to exist**, and no customer's credentials may be disclosed or recovered — §B forbids it, and
  password hashes are not ours to hold in any case (Apple and Google hold them).

### 8.3 AUTHORIZED — created and proven by the Founder, not by this session

> **FOUNDER DECISION 2026-08-14 — a dedicated Google SSO review/demo account is AUTHORIZED.**
> Explicitly *not* authorized: a password-auth path in the app. Credentials must never enter code,
> git, documentation, terminal output or a closure doc — the Founder types them straight into ASC.

Account requirements, so a reviewer in another country on an unfamiliar device is not locked out:
no two-factor authentication, no recovery-phone challenge, no "verify it's you" device trust, and a
non-expiring password. It signs in through the **existing** Google Sign-In path — no code change,
no new auth path, no shipping-surface change.

**Before submission the account must be PHYSICALLY proven to do three things** (Founder-run on the
device; this is a gate, not a formality — a demo account that cannot reach the purchase surface
fails review exactly as a missing one would):

```
P1  sign in to the Release build with Google Sign-In
P2  reach the required room/app functionality (create or open a norebang, start a session, queue)
P3  reach the timed-pass commerce surface (1시간 / 4시간 / 24시간 with App Store prices)
```

**HALT CONDITION, standing.** If P2 or P3 turns out to need a *separate production room or
passcode grant* for this account, stop and request authorization before creating it. Provisioning
production data for a review account is a production write, and it is not covered by the account
authorization above.

Supplement, not substitute: Review Notes also tell the reviewer that Sign in with Apple is
available with their own Apple ID (§8.5). That is true and often accepted, but it does not fill
ASC's required username/password fields on its own.

### 8.4 Contact fields — FOUNDER_INPUT_REQUIRED, not guessed

```
First name     FOUNDER_INPUT_REQUIRED
Last name      FOUNDER_INPUT_REQUIRED
Phone          FOUNDER_INPUT_REQUIRED   ← never guessed
Email          FOUNDER_INPUT_REQUIRED   ← ywamer2022@gmail.com is the PUBLISHED support/policy
                                          contact; whether it is also the App Review contact is
                                          the Founder's call, not an inference
```

### 8.5 Review Notes — READY_TO_ENTER

```
BTY Norebang is a karaoke session app for private gatherings. The host opens a "norebang"
(room), guests join by QR code and request songs, and everyone watches the same shared queue.

SIGNING IN
Sign in with Apple and Google Sign-In are the only login methods; there is no password login.
The supplied demo account signs in with the "Google로 계속하기" (Continue with Google) button.
You may also use your own Apple ID via the Sign in with Apple button.

GETTING TO THE MAIN EXPERIENCE
1. Sign in on the first screen.
2. Tap "새 노래방 시작" (Start a new norebang) to create a room and begin a session. A guest
   QR code and an empty queue are created.
3. Tap the QR code to display it; scanning it on a second device opens the guest request
   screen. Guest mode is also reachable inside this app without signing in.
4. Search for a song and submit a request; it appears in the shared queue.

PLAYBACK
Playback is handed off to YouTube: tapping play opens the video in YouTube. The app does not
embed, re-host, or modify YouTube content, and it requests no access to a YouTube account.

TIMED PASSES (in-app purchases)
Each account has a daily free allowance. The 1-hour / 4-hour / 24-hour passes extend it and
are reachable from the pass card on the main host screen. A pass does not begin when it is
selected — it begins when the first song actually starts playing, and once started it runs on
wall-clock time. This is stated in the app before selection.

ACCOUNT DELETION
Account → "계정 삭제" (Delete Account) permanently deletes the account from inside the app.

LANGUAGES
Korean and English, following the device language.
```

No secret appears in these notes.

---

## 9. §I — Release mode

```
live (R1B-R4 census)   Automatically release this version
prepare                MANUALLY release this version          READY_TO_ENTER
```

Reason, unchanged from the brief: approval must not publish 1.0 on its own. Commerce activation
(R2/R3) and the Founder's explicit go decision come first, and automatic release removes exactly
that control.

---

## 10. §J — FOUNDER MANUAL-ENTRY PACKAGE

This session cannot drive the browser. Everything below is entered by the Founder in App Store
Connect.

### 10.1 App Store → 1.0 → App Information / Version

| Field | Value | Class |
|---|---|---|
| Description (KO) | §5.1 verbatim | READY_TO_ENTER |
| Keywords (KO) | §5.2 verbatim (57 chars) | READY_TO_ENTER |
| Support URL | `https://norebang.btydaily.com/support` | READY_TO_ENTER |
| Marketing URL | leave blank | READY_TO_ENTER |
| Promotional Text | leave blank | READY_TO_ENTER |
| Copyright | `2026 Hanbit Chi` | READY_TO_ENTER (Founder-approved, §5.4) |
| iPhone 6.9" screenshots | `release-assets/appstore/1.0/screenshots/6.9-0{1,2,3}-*.png` | FOUNDER_CAPTURE_REQUIRED (§6.2) |
| Version Release | **Manually release this version** | READY_TO_ENTER |
| Build | **do not attach — out of scope (§L)** | — |

### 10.2 App Privacy

| Field | Value | Class |
|---|---|---|
| Privacy Policy URL | `https://norebang.btydaily.com/privacy` | READY_TO_ENTER |
| "Do you or your third-party partners collect data from this app?" | **Yes, we collect data from this app** | READY_TO_ENTER |
| Email Address | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| Name | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| User ID | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| Purchase History | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| Search History | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| Other User Content | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| Product Interaction | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER |
| Other Data Types (time zone) | App Functionality · Linked **YES** · Tracking **NO** | READY_TO_ENTER (Founder-resolved, §3.7) |
| Every other data type | **not collected** — §3.8, and IP omission Founder-approved (§3.5) | READY_TO_ENTER |
| **Publish** | **safe** — all 8 types are source- and schema-grounded (§3.2), and the policy now discloses each of them in its collection copy (§14, live). **STOP for Founder before pressing Publish.** | READY_TO_ENTER |

The complete ASC App Privacy entry matrix, in the order the questionnaire asks:

```
"Do you or your third-party partners collect data from this app?"   →  Yes, we collect data

DATA TYPE                     PURPOSE            LINKED   TRACKING
Contact Info → Email Address  App Functionality   YES      NO
Contact Info → Name           App Functionality   YES      NO
Identifiers  → User ID        App Functionality   YES      NO
Purchases    → Purchase History  App Functionality YES     NO
Search History                App Functionality   YES      NO
User Content → Other User Content  App Functionality YES   NO
Usage Data   → Product Interaction App Functionality YES   NO
Other Data   → Other Data Types (time zone)  App Functionality  YES  NO

NOT SELECTED, every one measured (§3.8):
  Health & Fitness · Financial Info · Location (Precise AND Coarse) · Sensitive Info ·
  Contacts · Browsing History · Photos or Videos · Audio Data · Gameplay Content ·
  Customer Support · Emails or Text Messages · Advertising Data · Device ID ·
  Crash Data · Performance Data · Other Diagnostic Data

Tracking, every type:  NO — no ATT prompt, no IDFA, no ad/analytics SDK, no data broker.
Privacy Policy URL:    https://norebang.btydaily.com/privacy
```

### 10.3 App Review Information

| Field | Value | Class |
|---|---|---|
| Sign-in required | **Yes** (truthful — §8.1) | READY_TO_ENTER |
| User name | dedicated Google review account — **authorized, not yet created**; Founder types it directly into ASC | FOUNDER_INPUT_REQUIRED (§8.3, incl. P1–P3 proof) |
| Password | same account — never written to code, git, docs or logs | FOUNDER_INPUT_REQUIRED (§8.3) |
| First name / Last name | — | FOUNDER_INPUT_REQUIRED |
| Phone | — | FOUNDER_INPUT_REQUIRED |
| Email | — | FOUNDER_INPUT_REQUIRED |
| Notes | §8.5 verbatim | READY_TO_ENTER |

### 10.4 In-App Purchases — App Review Screenshot only

| Product | Asset | Class |
|---|---|---|
| `com.btydaily.norebang.pass.1hour` | `release-assets/appstore/1.0/iap/iap-1h.png` | **READY_TO_ENTER** (§7.3) |
| `com.btydaily.norebang.pass.4hour` | `release-assets/appstore/1.0/iap/iap-4h.png` | **READY_TO_ENTER** (§7.3) |
| `com.btydaily.norebang.pass.24hour` | `release-assets/appstore/1.0/iap/iap-24h.png` | **READY_TO_ENTER** (§7.3) |

Review Notes for the IAPs stay blank (optional). Attaching these three screenshots repairs the
asset requirement and nothing more — **do not submit any IAP**, per §7.4.

### 10.5 What still blocks a PASS

```
1  dedicated App Review account          AUTHORIZED — create, then prove P1/P2/P3   §8.3
2  contact first/last/phone/email        Founder-supplied, never invented           §8.4
3  App Store product-page screenshots    Founder-captured on the iPhone             §6.2
4  the ASC writes themselves             Founder-performed; this session has no browser

CLEARED since the first package:  timezone category (§3.7) · IP omission (§3.5) ·
                                  copyright (§5.4) · policy amendment (§14, live) ·
                                  IAP review screenshots ×3 (§7.3, prepared)
```

**§6.2 note.** The §7 capture is the *pass surface*, approved for the IAP review fields only. It is
not proposed as an App Store product-page screenshot: `Passes are not on sale right now.` is the
right thing to show a reviewer and the wrong thing to show a shopper. The product-page set (queue,
guest request, and a pass screen the Founder judges suitable) is still open.

Two standing stops, both requested by the Founder and both honoured here:

```
STOP before publishing App Privacy
STOP before any action needing a new production review-account grant (room / passcode)
```

---

## 11. §K — After Founder manual entry

Not yet performed. On the Founder's read-back this document gains the live before/after table for:
version metadata present, ≥1 accepted screenshot, release mode **Manual**, App Review contact +
credentials present, App Privacy questionnaire complete and Privacy Policy URL present, and each of
the three IAP review screenshots present with its live ASC status label **read, never inferred**.

## 12. §L — Build 100 unchanged

```
archived · cloud distribution signed · App Store validation PASSED · NOT UPLOADED
not uploaded · not attached · not selected · not submitted — by this session or any other
```

## 14. The policy amendment — SHIPPED under Founder authorization

Scope was one thing: make the **collection** copy say what the app already does, so the ASC
disclosure and the public policy describe the same service. No practice changed, and nothing about
the app changed.

### 14.1 What was added

A new **§4a "Host account information" / "4a. 호스트 계정 정보"** in both languages, immediately
after §4, covering exactly the measured set — email address, display name, account identifiers,
time zone, saved songs, song requests and playback records, purchase and pass records, and the
short-lived pseudonymous anti-abuse identifier — each with its measured purpose.

Three sentences carry the weight, because they are the ones that could be got wrong:

```
"We never receive or store your card, bank or payment details — Apple handles payment."
"The IP address itself is never stored in our database or logs."   (+ expires within an hour,
                                                                    not used to determine location)
"[time zone] is not location data and is not derived from location services."
```

The closing paragraph states the absences — no location, camera, microphone, photo, contact, health
or advertising data, and no analytics, advertising, attribution or crash-reporting software — which
is the §3.8 measurement written where a user can read it.

Per the Founder's direction, nothing that does not exist was added, and the existing deletion
language (§11, §12, §12a) was left **byte-identical**.

### 14.2 The consent version was deliberately NOT bumped

```
LEGAL_EFFECTIVE_DATE   2026-07-19 → 2026-08-14      moved (policy §15 promises this)
LEGAL_VERSION          2026-07-19 → unchanged        NOT bumped
```

`LEGAL_VERSION` drives `GuestConsentGate` — bumping it re-prompts **every guest** to accept the
policy again. Nothing a guest consents to changed: §4a discloses host-account collection that was
already happening, and its practice-level content is unchanged. Re-prompting guests mid-event for
that would be a real production behaviour change dressed up as a policy-only repair. The reasoning
is recorded in `src/lib/legal.ts` beside the constant, where the next person to touch it will see
it. **Founder can overrule by bumping the one constant.**

### 14.3 Verification — measured, in this order

```
tsc --noEmit                          clean
vitest                                239 files · 2894 tests · 0 failures
new pinned test                       legal.render.test.tsx — asserts every §4a data type in BOTH
                                      languages, the "IP never stored" claim, the "not location"
                                      claim, and the absences
cf:build                              OpenNext bundle OK
wrangler versions upload              8436ee23-9c49-4638-8029-e999cbf0e0c9
preview readback                      /privacy 200 · §4a present in en AND ko · date 2026-08-14
wrangler versions deploy @100%        SUCCESS
```

Preview was read **before** promotion, not after — a version that has not been checked has no
business taking production traffic.

### 14.4 Production proof

```
https://norebang.btydaily.com/privacy   HTTP 200   §4a present, en + ko, effective 2026-08-14
https://norebang.btydaily.com/support   HTTP 200   untouched by this change
```

Polled repeatedly rather than once:

```
round 1, immediately after deploy   6 polls   5 NEW · 1 OLD  (poll 4 served the pre-amendment body)
round 2, over the next 3 minutes   12 polls  12 NEW · 0 OLD
round 3, confirmation               3 polls   3 NEW · 0 OLD
```

That single OLD is the known BUILD 26G behaviour — a rollout mixes versions across colos for
minutes — and it is exactly why one 200 proves nothing. A lone first-poll check would have been
just as likely to record the OLD body and call the deployment failed.

## 15. Repository state

```
native  /Users/hanbit/Dev/bty-norebang-admin-ios   HEAD e7724c6 == origin/main, 0 ahead / 0 behind
        working tree: the pre-existing .xcscheme Founder edit ONLY — untouched
server  /Users/hanbit/Dev/btytrainingcenter        R1B-R4 fb9f972b · R1B-R5 6068b684 pushed
        this slice: documentation, the release-asset convention, and the §14 policy-only repair
        (privacy page + legal constant + one render test). No engine, API, schema or app change.
```

---

**BUILD 26T-R1B-R5 — HELD.** Policy amendment live and proven; Founder gates in §10.5 remain open.
Nothing uploaded, nothing submitted, App Privacy not published, `PASS_1H` inactive.
