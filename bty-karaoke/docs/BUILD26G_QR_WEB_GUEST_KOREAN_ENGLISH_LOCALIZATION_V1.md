# BUILD 26G — QR WEB GUEST KOREAN / ENGLISH LOCALIZATION V1

**Status: PASS / CLOSED — 2026-08-09**

Implemented, deployed to production by promotion, and Commander-attested. **G1–G6 all PASS.**

```text
Commit      a77b1efc15d5d2948f29f10aec0ccce3883e51e1   (main, pushed, 0/0 vs origin)
Worker      72b018f1-b2ad-48c0-92f5-dfe497c2da68 @ 100%  (superseded 8e1f90f8 / BUILD 26E)
Deployment  2026-08-09T00:06:05.994Z
Build       /api/karaoke-build → a77b1efc15d5
Migration   NONE — no server/runtime/DB change in this build
Tests       web 2342/2342 · tsc clean · production build SUCCESS · mutants 10/10
Layout      16/16 clean — Chromium + WebKit × en/ko × 320/375/390/430
```

## The canonical rule this build establishes

```text
Host language belongs to Host.
Native Guest language belongs to the Native Guest.
QR Browser Guest language belongs to the Browser Guest.

Room language controls none of them.
```

A QR identifies the **room**, never the presentation language.

---

## 1. The defect

A Korean Host's QR produced a Korean-only Guest screen for every guest who scanned it, whatever
language their phone was set to. An English-speaking guest at a Korean-hosted party could not read
the search prompt, the request button, their own queue position, or the errors explaining why a
request failed.

## 2. Resolution authority

`src/domain/guest-locale.ts` — pure, no storage, no DOM, no network:

1. an explicit choice **this Browser Guest** made
2. the browser's own preferred languages (**order**-sensitive, not presence)
3. English

`resolveGuestLocale` accepts exactly two inputs — `stored` and `browserLanguages`. **There is no
room, host, owner, or event parameter**, so a Host's language cannot travel into the resolver.
That is the structural half of the guarantee; the behavioural half is asserted end-to-end against
the real server component.

Order matters, and is tested in both directions:

| `navigator.languages` | Result |
|---|---|
| `["en-US","ko-KR"]` | `en` |
| `["ko-KR","en-US"]` | `ko` |
| `["fr-FR","de-DE"]` | `en` — **never** Korean |

## 3. Localization source

`src/domain/guest-messages.ts` — **168 symbolic keys**, each with `en` + `ko`, English as
source/fallback. One source; no second dictionary, and no component decides copy by branching on
language. Plurals resolve through `Intl.PluralRules` from the catalog (English `one`/`other`,
Korean `other`-only — correct, Korean has no plural agreement), so English can never render
"1 songs".

Server codes are **contract, not copy**. Resolution codes, submit error classes, and plan codes are
unchanged; only their presentation is localized.

## 4. Switcher and persistence

A compact `한국어 | English` control in the Guest brand row, present before and after room entry.
**Endonyms, never flags** — a flag names a country, not a language. Switching is immediate: no
reload, no room exit, no rejoin.

The choice persists in `localStorage` (authority) plus a **first-paint cookie mirror**, so the
server renders the chosen language with no flash before hydration. Nothing is written to the room,
the Host account, the database, or a server session; the switch issues **no network request at
all**, which is asserted.

## 5. Also localized

- **Guest legal footer** — a new `GuestLegalLinks`. The shared `components/legal/LegalLinks` was
  deliberately **not** touched, because it also serves Host/admin/privacy/terms; localizing it
  would have silently flipped those to English.
- **First-use consent gate** — now reads **once**, in the Guest's language. It previously rendered
  a Korean sentence *plus* an English paragraph, which was a stand-in for localization. Every named
  document (Privacy, Terms, YouTube ToS) is still linked and still focusable.

## 6. Layout

A **pre-existing** narrow-phone defect was found and fixed: WebKit at 320px let the longest Guest
headline spill out of its flex column rather than wrap — in Korean, before this build. English is
wider in that same slot, so `word-break: keep-all` (correct Korean typography — never split a word
mid-token) plus `overflow-wrap: anywhere` (the narrow-phone escape hatch) now applies to the Guest
headline and body text.

Measured in Chromium and WebKit, both languages, at 320/375/390/430: **no overflow, no clipping,
switcher visible with a ≥44px target — 16/16 clean.** No width problem is solved by shrinking text.

## 7. Tests

`210 files / 2261` → **`214 files / 2342`**.

Every pre-26G Guest test now pins `locale: 'ko'`, so each keeps asserting the **shipped Korean** —
that is how Korean is proven unchanged. Four source-scan tests that grepped components for Korean
literals became key-presence + catalog assertions, which is strictly stronger: they now fail if
*either* language goes missing.

New contracts: en/ko completeness (0 missing each), placeholder parity (0 mismatches), plural
grammar, server identifiers untranslated, no unauthorized Korean literal in the Guest surface, QR
entry behaviour end to end, and the narrow-phone CSS rules.

**10 mutants killed**: Korean-as-default · browser-order-ignored · Korean value removed · English
value removed · untranslated key · placeholder dropped · persistence disabled · stored choice
ignored · **Host language propagated to the Guest** · Korean literal reintroduced.

## 8. Approved Korean that remains

Four literals, each exempt and asserted as such by the contract test:

| Location | Why it stays |
|---|---|
| `performance-style.ts` — `HANGUL` regex | detects whether the *query* is Korean; never rendered |
| `performance-style.ts` — `MR_BIAS` regex | classifies YouTube results; never rendered |
| `performance-style.ts` — `` `${q} MR 반주` `` | **search-query augmentation** — decides what YouTube is *asked for*, not what the Guest reads |
| `guest-locale.ts` — `한국어` | the Korean **endonym**; a language names itself |

Plus the YouTube content-matching patterns in `song-title.ts`, `video-kind.ts`, `youtube-rank.ts`,
`youtube-search.ts` — content matching, never displayed.

## 9. Deployment

Deployed by **promotion, not rebuild**: `wrangler versions deploy 72b018f1@100%`. `cf:deploy`
(which rebuilds) was never run, so the artifact that passed staging verification is bit-identical
to the one serving production.

The authorized commit was 2 commits behind `main` at deploy time; both intervening commits were
Arena docs-only and `bty-karaoke` was verified **byte-identical** (0 differing files) before
promotion.

### Rollout observation, recorded rather than smoothed over

For several minutes after promotion, both production origins returned a **mix** of 26G and 26E
(~75/25) while the Cloudflare control plane already reported 100%. That was propagation draining
old isolates. The build was **not** declared deployed until it converged: **40/40** cache-busted
samples on `/api/karaoke-build` and **32/32** on the Guest page. A single early sample would have
reported this build as clean before it was.

Two harness bugs in the verification itself are recorded for the same reason — both initially
produced **false failures/passes that were not product defects**:

1. The first mutation pass reported all ten mutants as *survived*. An unquoted `[slug]` path glob
   swallowed the vitest summary. Corrected harness: 10/10 killed.
2. The first production persistence smoke reported the cookie override as *failing*. `${3:+-H
   "Cookie: $3"}` word-split and sent curl a malformed header. Corrected harness: all six cases
   pass.

## 10. Production smoke (2026-08-09)

| Case | Result |
|---|---|
| English browser → English Guest | PASS |
| Korean browser → Korean Guest | PASS |
| French / Japanese browser → English | PASS (never Korean) |
| Switcher present, both endonyms, no flags | PASS |
| Korean browser + stored `en` → English | PASS |
| English browser + stored `ko` → Korean | PASS |
| Stored garbage (`fr`) → falls back to browser | PASS |
| Real search → request → queue → cancel | PASS |

The lifecycle used the live event `0bf37c6d-554a-4e4c-9bed-2ec1cbbbea99`. The active queue was
restored (`waitingCount 0 → 1 → 0`). **One permanent `removed` history row named "26G smoke"
remains**, by BUILD 25 tombstone semantics: a cancelled request is retained as history, not
deleted. Counters moved `singers 3→4`, `requests 9→10`.

## 11. Host behaviour unchanged

| Check | Result |
|---|---|
| `/` Host entry under `Accept-Language: en-US` | Korean — `호스트로 로그인하세요` / `Google로 계속하기` |
| Guest switcher on any Host surface | absent |
| English Guest copy on any Host surface | none |
| `/host`, `/host/connect`, `/host/plan` | 307 signed-out redirect (unchanged) |
| Shared `LegalLinks` on `/privacy` | Korean in both languages |
| Host / DJ / manager / deletion endpoints, unauthenticated | all 401 |

## 12. Device gates — G1–G6 PASS

Executed by the Commander against the staging preview URL
`https://72b018f1-bty-karaoke.ywamer2022.workers.dev`. That URL and both production origins report
the **same build (`a77b1efc15d5`) from the same Worker version (`72b018f1`)** — the artifact is
identical, so the gate results transfer to production without qualification.

| Gate | Result |
|---|---|
| G1 — English Guest independence (Korean Host) | PASS |
| G2 — Korean Guest independence (English Host) | PASS |
| G3 — manual switch EN → 한국어 → EN, no room exit | PASS |
| G4 — persistence across reload / reopen / QR re-entry | PASS |
| G5 — unsupported locale → English, never Korean | PASS |
| G6 — full QR Guest lifecycle in both languages | PASS |

## 13. Preserved exactly

Unchanged by this build: server/runtime contracts, database/migrations, QR room identity, Guest
admission authority, queue/request authority, playback authority, Pass/FREE accounting, Host
behaviour, the Native app, and BUILD 26F. The deployed commit touches **0** files under
`supabase/`, `/api/`, `*.sql`, `wrangler.toml`, `open-next.config.ts`, `next.config.mjs`, or
`bty-app/`.

## 14. Known, out of scope

`<meta name="description">` still reads `btyNorebang — 함께 부르는 오늘의 노래` for every visitor,
including an English browser. It comes from `PRODUCT_DESCRIPTION` in the **shared root**
`layout.tsx`: `<head>` metadata, never on screen, and that layout also serves Host, admin, privacy
and terms — localizing it would change Host surfaces, which BUILD 26G excludes. Recorded so it is
not mistaken for a leak when reading page source.
