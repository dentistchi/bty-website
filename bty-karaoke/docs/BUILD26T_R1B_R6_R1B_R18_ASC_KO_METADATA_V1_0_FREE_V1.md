# BUILD 26T-R1B-R6-R1B-R18 — App Store KO metadata, V1.0 FREE — **SOURCE OF TRUTH**

**This file is the authority for the Korean App Store Description and Keywords of version 1.0.**
It supersedes §5.1 and §5.2 of `BUILD26T_R1B_R5_ASC_METADATA_PRIVACY_REVIEW_ASSET_REPAIR_V1.md`.

R5 is **preserved unedited**. It records what was true on 2026-08-14 and remains the evidence of
that state; nothing in it has been rewritten. Where the two disagree, **this file wins.**

```
B1_KO_METADATA                PASS / CLOSED
V1_0_PAID_COMMERCE_REFERENCES 0
FREE_CONTRACT_ALIGNMENT       PASS
ASC_SUBMISSION_METADATA       OPEN — Founder GUI gate; nothing entered into ASC by this pass
```

---

## 1. Why R5 §5.1 / §5.2 are superseded

The R5 copy was written on 2026-08-14, **before** the E1 retirement work landed. It advertised a
product the shipping binary can no longer be. Four independent measurements retired it:

```
1  paid pass UI retired      showsEntitlementStatus is a hardcoded `false` (RootView.swift:430) —
                             the ONLY mount of the ONLY button that writes showingEntitlement=true,
                             which is the ONLY presenter of every pass/premium view.
                             PassPurchaseGateView is #if DEBUG, so absent from Release entirely.

2  daily FREE quota retired  E1 (20260817120000) returns metered:false and "the FREE window is not
                             consumed by playback". Applied to production; runtime fingerprint
                             cb7c7ac6281be1fb3e2cd7e6afee2134.

3  remaining-time UI retired The on-screen remaining-time chip lived behind the same retired
                             entitlement surface. Nothing displays it.

4  finalSongGrace repaired   R17 — E1 changed only the MINTER. A second, authority-free READER
                             (graceForRequest) survived on the already_active branch and could
                             still emit finalSongGraceApplied:true from a historical ledger row,
                             which native renders as "오늘 남은 무료 시간은 모두 사용돼요".
                             Removed and DEPLOYED: commit 223cffa1, Worker 7070f947 @100%.
```

The exact superseded block, quoted here so this file is self-contained. **Do not re-enter it:**

```
■ 이용 시간
· 매일 무료 이용 시간이 제공됩니다.
· 1시간 · 4시간 · 24시간 이용권을 보유한 경우, 선택해서 이용 시간을 늘릴 수 있습니다.
· 이용권은 선택만으로 시작되지 않습니다. 첫 곡이 실제로 재생될 때 시작됩니다.
· 시작된 뒤에는 재생을 멈추거나 앱을 닫아도 만료될 때까지 시간이 흐릅니다. 남은 시간은 화면에서
  언제나 확인할 수 있습니다.
```

Every line of it is now false, and it contradicted the App Review Notes shipping on the same
submission: *"There is nothing to purchase in this version, and no sign-up, subscription or
entitlement is required to search, request or play a song."* The R5 keyword `이용권` is superseded
for the same reason.

One further R5 correction: it filed 내 노래 (saved songs) under **호스트**. Saved songs is
guest-scoped — `guest.section.my_songs`, `mySongsSection`, `GuestRoomView.swift` only — so it now
appears under 손님.

---

## 2. FINAL Korean Description — enter verbatim

```
BTY Norebang은 모임과 홈파티를 위한 노래방 진행 앱입니다. 호스트가 노래방을 열면 손님은 QR 코드로 바로 참여해 부르고 싶은 노래를 신청하고, 모두가 같은 대기열을 함께 봅니다.

■ 호스트
· Apple 또는 Google 계정으로 로그인하고 내 노래방을 만듭니다.
· 노래방을 시작하면 손님 초대용 QR 코드와 새 대기열이 만들어집니다.
· 대기열 순서 변경, 신청곡 삭제, 다음 곡으로 넘기기를 한 화면에서 처리합니다.
· 노래방 진행 중에는 지금 부르는 노래와 다음 순서를 확인할 수 있습니다.
· 노래를 시작하면 재생은 YouTube 앱으로 넘어갑니다.

■ 손님
· QR 코드로 참여하거나, 앱에서 게스트 모드로 바로 들어옵니다.
· 부르고 싶은 노래를 검색해 신청합니다.
· 내 순서가 어디쯤인지 실시간으로 확인합니다.
· '준비됐어요'로 호스트에게 알리고, 아직 부르기 전이라면 직접 신청을 취소할 수 있습니다.
· 내 신청곡이 대기열에서 사라졌다면 그 이유를 앱이 알려줍니다.
· 마음에 든 노래는 '내 노래'에 저장해 두고 다음에 다시 신청할 수 있습니다.

■ 그 밖에
· 한국어와 영어를 지원하며, 기기 언어를 따릅니다.
· 로그인 방법 확인과 계정 삭제를 앱 안에서 직접 할 수 있습니다.

BTY Norebang은 YouTube에 공개된 영상을 검색해 신청하는 앱이며, 재생은 YouTube 앱으로 넘겨 진행합니다. 영상을 직접 재생하거나 저장하지 않으며, YouTube 및 Google과 제휴하거나 후원받는 앱이 아닙니다.
```

762 / 4000 characters.

### Every claim, mapped to a Release-109 call site

Grounded in shipping strings and code, not in intent:

```
host login Apple/Google      auth.sign_in.title 호스트로 로그인하세요
create / start a norebang    first_room.create · event.start_new
QR invite + new queue        GuestQRSheet · event.end.confirm.body
reorder / remove / skip      reorder(orderedIds:) · removeSong(_:) · skipCurrentSong()
now playing + next order     guest.now_playing.title
playback → YouTube app       playback.reopen_youtube · playback.open_failed
guest mode entry             guest.exit 게스트 모드 나가기
search + request             guest.cta.request 신청하기
live queue position          guest hero / queue rows
ready / self-cancel          guest.ready.action · guest.cancel.action
reason a request vanished    guest.resolution.* (4 distinct reasons)
saved songs 내 노래           guest.section.my_songs · mySongsSection
ko / en                      BUILD 26F string catalog
account delete / methods     account.delete · account.login_methods
```

### The YouTube claim is deliberately narrow

The app **searches** public YouTube content and **hands playback off** to the YouTube app; it does
not embed, re-host, store or modify video. The closing paragraph states this and adds the
non-affiliation line. That matches the App Review Notes and the `DevelopedWithYouTube` attribution
mark shipping on all three J3-required surfaces.

### The 15-minute ceiling is intentionally not mentioned

`MAX_LEASE_SECONDS = 900` still refuses over-length requests (`song_too_long`). The description is
silent on song length and makes **no** unlimited-duration claim — scanned for 모든/어떤/아무 노래,
무제한, 길이 제한, 제한 없, 전곡: **0 hits**. So there is no conflict to disclose. Adding the
ceiling was considered and declined for this version.

---

## 3. FINAL Korean Keywords — enter verbatim

```
노래방,가라오케,karaoke,노래,신청곡,노래신청,노래검색,대기열,모임,홈파티,파티,친구,회식,행사,생일파티,QR,노래방앱
```

69 / 100 characters · 17 terms · no duplicates · no space after commas.

**`YouTube` is deliberately absent from the keyword field.** A third-party trademark used for
discoverability is a metadata-rejection risk; R5 excluded it alongside 금영 / TJ for the same reason
and that decision stands. Factual YouTube attribution belongs in the description, where it is, and
nowhere else. `플레이리스트` was also dropped from the R5 set — the product has a queue, not
playlists, and the term would be keyword stuffing.

`이용권` is removed. No banned term appears in either field.

---

## 4. Verification, measured

```
scan surface              description AND keywords, together
banned terms scanned      26
  이용권 구독 프리미엄 PRO 구매 결제 무료 할당 남은 시간 남은시간 카운트다운
  1시간 4시간 24시간 시간권 충전 요금 유료 정액
  premium subscription purchase pass entitlement quota
PAID_COMMERCE_TERMS_FOUND 0
duration-claim scan       0 conflicting claims
YouTube in keywords       false
YouTube in description    4 (attribution + non-affiliation, correct)

sha256 description        c8e29f59213972bb2ca4bf1d4d4e7fb8…
sha256 keywords           0cb4aecf191e6851dd8b0273b099de57…
```

`무료` is excluded beyond the required list. Any "free" framing re-invites the daily-allowance
reading the superseded copy had, and would need rewriting the moment monetization returns. The
App Store price badge already communicates it.

---

## 5. What this pass did NOT do

```
ASC entry                 NONE — nothing typed into App Store Connect
production DB             0 writes
migrations                unchanged
native                    unchanged — build 109, repo clean
commerce / IAP            untouched; the three products remain excluded from the 1.0 submission
R5 document               PRESERVED, not rewritten
```

---

## OUTPUT

```
B1_KO_METADATA                PASS / CLOSED
KO_DESCRIPTION                FINAL (§2) — 762 chars
KO_KEYWORDS                   FINAL (§3) — 69 chars
V1_0_PAID_COMMERCE_REFERENCES 0
FREE_CONTRACT_ALIGNMENT       PASS
FINAL_SONG_GRACE_RUNTIME      PROVABLY_FALSE (R17, Worker 7070f947)
FREE_DAILY_QUOTA_RUNTIME      ABSENT
SONG_15_MINUTE_REQUEST_LIMIT  ACTIVE / EXPECTED — no description conflict
NATIVE_REBUILD_REQUIRED       NO
ASC_SUBMISSION_METADATA       OPEN — Founder GUI gate, the only remaining 1.0 blocker
```
