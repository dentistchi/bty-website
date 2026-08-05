# BUILD 26B — BROWSER HOST ACCESS VERIFICATION & RESPONSIVE HARDENING V1

**Status: PASS / CLOSED — 2026-08-05**

Verified, hardened, deployed, and Founder-attested. **G1–G8 all PASS.**

```text
Implementation      eaef1bd7f52ef9b8699b762e998bdd2e8e70c8d3
D-6a correction     67de80dac5c7ae48cd59360f09ff74ea0c1f4718   ← production runtime
G6 test coverage    bdeb811546894a8801a961817c9e6ecd3fb80148                              (test-only, not deployed)
Closure docs        this commit                                 (docs-only, not deployed)

Deployment          82af291a-ee52-415a-af78-1ab1b6012021 @ 100%
/api/karaoke-build  67de80dac5c7
Migrations          37 local / 37 remote / NO DRIFT  (none added — this build has no migration)
```

**The headline finding was not a responsiveness bug.** The Host browser surface referenced a
`.host-*` component family whose rules were never shipped — **0 occurrences in the deployed
stylesheet**. The primary Google sign-in action, the entry point to the entire browser Host
journey, rendered as a bare default hyperlink: `display:inline`, **125×18**, link-blue,
`padding:0`, on desktop and mobile alike. Meanwhile the responsive *layout* was already sound:
**zero horizontal overflow at all six widths in every state**, before any change.

---

## 1. Inherited baseline (BUILD 25 — PASS / CLOSED)

```text
Web HEAD/origin     8d860d7625a2491dee663f20c0f635047ae8a0a6
Native HEAD/origin  56bb830e5a38cf575b498f5f02550d5bc6915a5a   build 82
Production          6bfdbfe87543
Migration parity    37 local / 37 remote / no drift
Host tests 1700 · Guest tests 779 · Debug + Release SUCCEEDED · BUILD 25 G1–G8 ALL PASS
```

BUILD 25's product behaviour was frozen throughout and is re-verified by G8: Guest-visible request
resolution, `completed` vs `skipped` Host intent, owner-only resolution authority, safe
`unknown_resolution` handling, production API contracts, migration state.

## 2. BUILD 26A audit conclusion

The audit was scoped as if Google OAuth, identity linking, and native Google sign-in still needed
building. **They already existed.** Four of five candidate capabilities were implemented and two
were live in production. Corrections the audit established, all of which shaped this build:

- The product **does not use Supabase Auth**. Host identity is a custom, server-authoritative model
  (`karaoke_accounts`, `karaoke_account_identities`, `karaoke_host_sessions`).
- Identity is **provider-neutral** and **email is never used to match or merge accounts**, so
  Apple↔Google linking was already safe by design.
- Host authority keys on canonical `accountId` via workspace membership — **provider-independent**.
- Web Google OAuth was **already live** (PKCE S256, CSRF state, exact redirect URI, fail-closed
  config). The blocker recorded in earlier notes had already been resolved.
- The canonical browser Host entry is the **site root**; `/host` is a compatibility redirect.

Therefore the audit recommended **verification and hardening before any new capability**, and
selected this slice: highest user value, no migration, no identity risk, independent closure.

## 3. What this build changed

### 3.1 The missing Host style contract (D-1 / D-2)

`src/app/globals.css` (+126, appended; nothing existing edited).

The audit's framing — "seven unstyled classes" — was **too coarse, and measurement corrected it**.
The global `button` rule already grants every `<button>` the gold gradient and `min-height: 46px`,
so `<button class="host-btn">` looked right *by accident* while `<a class="host-btn">` inherited
nothing. Two distinct faults hid under one symptom:

| Element | Before | After |
|---|---|---|
| `a.host-btn-primary` (Google CTA) | **125×18**, `inline`, link-blue, no chrome | **164×48**, gold primary |
| `a.host-btn-ghost` | 28×18, same | 65×46, secondary |
| `button.host-btn-primary` | 124×46 gold — already correct | **124×46, unchanged** |
| `button.host-btn-ghost` | 93×46 **gold, identical to primary** | 93×46 secondary |

`.host-btn` therefore restates the **same geometry the global button rule already uses**
(46px / 13px 18px / radius 14px). A `<button>` is geometrically unchanged — proven, widths still
124 and 93 — while an `<a>` finally becomes the control it claims to be. **A missing-style fix, not
a restyle.**

`.host-btn-ghost` gives secondary actions the established `.sheet-btn.ghost` treatment. Before it,
로그아웃 and 플랜 were visually indistinguishable from the main call to action.

`.host-shell` sets **only** `overflow-wrap`. Width, centring and safe-area padding already come
from the base `main` rule; re-declaring them would have been a redesign wearing a bug fix's
clothes. `.host-form`, `.host-notice`, `.host-unavailable` received minimal, product-consistent
rules.

### 3.2 Touch targets (D-4 / D-5)

Padding and min-size only — no control moves, changes colour, or changes behaviour.

| Selector | Before | After |
|---|---|---|
| `.sb-event` (event status opener) | `min-height: 0` → 202×37 | **254×44** |
| `.admin-trigger` | 81×34 | **81×44** |
| `.q-handle` (drag) | 40×46 | **44×46** |
| `.q-overflow` (row menu) | 40×40 | **44×44** |

**`.dj-console .linkish` is scoped deliberately.** `.linkish` has 26 call sites across the Guest,
Admin and Manager surfaces — **including the BUILD 25 request dock** — so widening it globally
would have regressed a closed surface to save one selector.

### 3.3 The Open Display anchor (D-6a)

`src/app/r/[slug]/dj/DjBoard.tsx` — one class token, `className="ghost"` → `"btn ghost"`. **No CSS
rule was added or changed**; `.btn.ghost` already existed, and the codebase's own comment already
documented `a.btn.ghost` as the intended pattern.

`.ghost` is only ever defined as `.btn.ghost`, and that rule supplies **colour alone** — the chrome
comes from the `.btn, button` rule, which an `<a>` does not match. Measured on production before
the fix:

```text
transparent background · 0px border · 0px radius · 0px padding
color rgb(158,158,255) — the browser's default link blue
siblings in the same bar: gold gradient, radius 14px
```

After: `103×108 · bg rgba(255,255,255,0.05) · border 1px · radius 14px · padding 13px 18px ·
color var(--text)` — a proper secondary button beside the two gold primaries.

**A correction recorded rather than quietly dropped.** This was first reported as a *"blue
underlined link"*. It is **not** underlined — computed `text-decoration` is `none`, before and
after. The underline was a misreading of a screenshot, not the DOM. That matters concretely: the
"not underlined" assertion **passes on the defect** and would never have caught it. The spec
therefore asserts background, border, radius, padding and colour explicitly and does not rely on
decoration.

Not acted on, recorded as an observation: the anchor computes `text-align: start` while its sibling
`<button>`s compute `center`. The existing `block` helper would centre it; that was outside the
approved change.

## 4. Responsive contract

At **1440 / 1024 / 768 / 430 / 390 / 360**:

```text
document scrollWidth <= clientWidth              (no document-level horizontal overflow)
critical Host controls >= 44 x 44 CSS pixels
Admin menu, row-action sheet, event-status sheet remain within the viewport
a panel taller than the viewport must scroll internally
empty, active and ended layouts remain stable
the primary Google action is a styled primary control, never an inline link
```

Measured on the deployed candidate `67de80dac5c7`, all six widths: overflow **0**, undersized
controls **0**, runtime errors **0**, all three panels fit.

## 5. Browser harness

Owned by `bty-karaoke`, hermetic, reproducible from a clean checkout.

```text
package.json                      @playwright/test ^1.62.1 (devDep) + "test:e2e"
playwright.config.ts              starts its own Next server + its own Supabase stub, DUMMY env
e2e/widths.ts                     the six widths + MIN_TAP = 44
e2e/fixtures/queue.ts             fixtures typed against the REAL server types
e2e/fixtures/stub-supabase.mjs    loopback stub, test-only
e2e/host-entry.responsive.spec.ts
e2e/dj-console.responsive.spec.ts
e2e/dj-display-anchor.spec.ts
e2e/oauth-transaction-safety.spec.ts
e2e/security-shell.spec.ts
.gitignore                        test-results/, playwright-report/, blob-report/, playwright/.cache/
```

Version 1.62.1 rather than the sibling project's 1.49: Next 15.5.20 declares
`@playwright/test@^1.51.1` as a peer and 1.49 fails resolution.

**No auth bypass, no debug route, no secret, no committed browser/trace/screenshot.** The console
resolves its room in a **server** component, which browser interception cannot reach — hence the
stub. It mints no session, signs no capability, touches no shared production code, listens on
loopback, is started only by the config, and sits outside the Next build graph. `env.server.ts`
skips its `.dev.vars` hydration when the Supabase vars are already present, so the run stays
hermetic even on a machine holding real credentials.

### Every contract was mutation-tested

A test that cannot fail is decoration. **Twelve mutants introduced, twelve killed**, source
restored byte-identical (SHA-256 / `git diff` verified) after each.

| Target | Mutants | Result |
|---|---|---|
| `.host-*` family removed (restores D-1/D-2) | 1 | **8 failures** across all six widths |
| DJ touch-target block removed (restores D-4/D-5) | 1 | **6 failures** |
| D-6a `btn ghost` → `ghost` | 1 | **6 failures** |
| `transactionExpired` → always `false` | 1 | **1 failure** |
| `OAUTH_TX_TTL_MS` 10 min → 24 h | 1 | **1 failure** |
| (26B placement/section guards from the earlier slices) | 7 | all killed |

## 6. Security-shell result

**PASS — INTENTIONAL PUBLIC SHELL · NO PRIVILEGED DATA EXPOSED**

`/r/{slug}/admin` and `/r/{slug}/dj` answer **200** without a session. That is by design: they are
shells that authenticate client-side, and *"no credential is ever placed in the URL or the
server-rendered HTML."* Their HTTP status and routing were deliberately **not changed**.

What they expose is only (a) the slug the caller themselves supplied, in the Next router payload,
and (b) `display_name` — **already public** via the unauthenticated Guest API
`/api/rooms/{slug}/requests` for the same slug. Verified clean for: `service_role`, `Bearer `,
`bty_room`, `bty_host`, `karaoke_host_sessions`, `account_id`, `workspace_id`, `dj_secret`,
`guest_name`, `youtube_title`, `resolution_code`, any JWT.

Every privileged endpoint refuses an unauthenticated caller — **401** on `dj/queue`, `dj/usage`,
`dj/pass-turn`, `dj/end-event`, `PATCH requests/{id}`, `host/me`, `host/identities` — pinned
reproducibly in `e2e/security-shell.spec.ts` and re-confirmed live on the deployed candidate.

## 7. Gate ledger — G1–G8 ALL PASS

| Gate | Verdict | Evidence |
|---|---|---|
| **G1** Desktop Chrome Google Sign-In | **PASS** | Founder-attested live browser verification |
| **G2** Desktop Safari Google Sign-In | **PASS** | Founder-attested live browser verification |
| **G3** Six-width responsive verification | **PASS** | Automated deployed-browser verification on candidate `67de80dac5c7`; implementer-reviewed screenshots and measurements. **Founder visual execution is not claimed.** |
| **G4** Physical Android Chrome full Host journey | **PASS** | Founder-attested physical-device verification. Safe mutation: one test request removed — applied **exactly once** |
| **G5** Unauthenticated shell confidentiality | **PASS** | Automated deployed-browser verification; privileged unauthenticated APIs returned 401 |
| **G6** OAuth cancellation & expired-transaction safety | **PASS** | Founder-attested cancellation and fresh retry **+** automated deterministic expiry verification **+** mutation-tested expiry boundary |
| **G7** Sign-out and session restoration | **PASS** | Founder-attested live browser verification |
| **G8** BUILD 25 resolution regression | **PASS** | Founder-attested live Host/Guest verification |

### G3 — why it is automated rather than Founder-visual

A complete manual G3 would have required recreating seven controlled states (active song,
long-title queue, empty queue, ended event, Admin menu, row-action menu, event-status sheet) across
six widths. Those states were already produced **deterministically** by the harness and verified
against the deployed candidate. The Founder was not asked to use DevTools or hand-build fixtures.
Human mobile usability was verified instead by **G4 on a physical Android device**.

### G6 Part B — how expiry was verified without a ten-minute wait

The callback checks `transactionExpired(tx)` **before** exchanging the code, and the transaction
cookie is plain JSON carrying `createdAt`. A backdated `createdAt` reproduces a ten-minute-old
attempt instantly. No Founder wait, no callback-URL edit, no hand-manipulated OAuth state, no real
Google account.

Verified: an expired transaction redirects to `notice=expired`; **no `bty_host` session is issued**;
the one-time transaction cookie is cleared so it cannot be replayed; the redirect chain is ≤ 2 hops
(no loop); none of the verifier, nonce, code or state reaches the URL or the rendered page, and
`client_secret` never appears; and a **fresh attempt afterwards still reaches Google** with a new
transaction cookie and `code_challenge`.

To prove the result is not vacuous, a transaction **just inside** the bound is asserted *not* to be
refused as expired — otherwise the suite would pass even if every attempt were rejected.

### G8 — BUILD 25 remains intact

Founder-attested on the live stack: normal completion → `completed`; explicit Host skip →
`skipped`; the two remain semantically distinct; Guest-visible results persist after refresh; Host
reauthentication does not alter resolution; no duplicate resolution; no stale active state; owner
authorization remains enforced.

## 8. Defect ledger

| ID | Verdict | Detail |
|---|---|---|
| **D-0** | **TEST FIXTURE ERROR — NOT A PRODUCT DEFECT** | A hand-guessed `DjEventStatus` fixture (`{id, startedAt}`) omitted `counts`/`nowPlaying`/`upNext`/`startsAt`/`endedAt`, so the status sheet dereferenced `undefined` and threw. The crash was briefly mistaken for a product defect; the corrected fixture produces **0 errors**. Fixtures are now typed against the real server types, making this class of false defect a **compile error** instead of a red test. |
| **D-1** | **FIXED** | Primary Google sign-in anchor restored as a real primary action (125×18 inline link → 164×48 gold primary) |
| **D-2** | **FIXED** | Shared Host button / shell / form / notice / unavailable styles restored; ghost actions no longer render as the primary gold |
| **D-3** | **DEFERRED** | Footer-link touch-area polish (`개인정보처리방침` 100×18, `이용약관` 50×18, `문의` 25×18). **Non-blocking.** No shared link rule reaches them without changing the current footer layout. |
| **D-4** | **FIXED** | DJ header controls meet the minimum touch-target contract |
| **D-5** | **FIXED** | Queue drag handle and overflow menu meet the minimum touch-target contract |
| **D-6a** | **FIXED** | Host Open Display anchor corrected from `ghost` to `btn ghost` |
| **D-6b** | **DEFERRED** | Three Guest-surface anchors reference an undefined `.button` class (`app/join/[token]/JoinFallbackClient.tsx` ×2, `r/[slug]/AppInvitationCard.tsx`). Outside BUILD 26B's browser-Host scope, and `AppInvitationCard` is adjacent to the **BUILD 25 frozen Guest surface**. No global `.button` selector was added. |

## 9. Automated verification — final

| | Result |
|---|---|
| `tsc --noEmit` | **clean** |
| Web / server (`vitest`) | **2137 passed / 204 files** — exactly the inherited baseline, none removed |
| Playwright browser suite | **49 passed / 0 failed** (grew 0 → 38 → 44 → 49) |
| `next build` | **succeeded** |
| `npm run cf:build` (OpenNext) | **"OpenNext build complete."** |

No test was removed or weakened at any point in this build.

## 10. Commits and deployment identity

**Repository and production identity are deliberately reported separately.**

| Commit | Nature | Deployed? |
|---|---|---|
| `eaef1bd7f52ef9b8699b762e998bdd2e8e70c8d3` | Implementation — `.host-*` contract, D-4/D-5 touch targets, harness (11 files, +785/−1) | Superseded |
| `67de80dac5c7ae48cd59360f09ff74ea0c1f4718` | D-6a correction (2 files, +92/−2) | **YES — production runtime** |
| `bdeb811546894a8801a961817c9e6ecd3fb80148` | G6 Part B coverage, test-only (1 file) | **No** |
| this commit | Closure documentation, docs-only | **No** |

```text
Deployment version    82af291a-ee52-415a-af78-1ab1b6012021 @ 100%   2026-08-03T18:09:25Z
/api/karaoke-build    67de80dac5c7
Mapping               next.config.mjs derives the build id from
                      `git rev-parse --short=12 HEAD`; 67de80dac5c7 is the first 12
                      characters of the deployed commit, character for character.
```

**Reported honestly:** immediately after each deploy, `/api/karaoke-build` briefly alternated
between the new and prior identities, and one measurement still showed pre-fix markup. That was not
treated as a pass. Both times, ten consecutive reads converged on the new identity, the deployment
showed 100%, and the element re-measured correctly. Edge propagation, not a defect.

The final two commits are test-only and documentation-only, so **no further deployment was required
and none is claimed.**

## 11. Migration parity

```text
37 local / 37 remote / NO DRIFT
```

**BUILD 26B adds no migration.** Parity was verified before implementation, before the corrective
commit, and at closure. Nothing under `supabase/migrations/` was staged in any commit.

## 12. Preserved working-tree state

Deliberately never staged, edited, formatted, relocated, or absorbed:

```text
Web     M  bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
        ?? bty-karaoke/brand/
Native  M  BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
           SHA-256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

The Native repository was **not touched at all** by this build: HEAD remains
`56bb830e5a38cf575b498f5f02550d5bc6915a5a`, build **82**, and the scheme hash was re-verified
identical at every checkpoint.

No reset, stash, discard, rebase, clean, or force-push was used in either repository. No
`git add -A` / `git add .` — every commit staged explicit paths, and the staged set was proven
before each commit.

## 13. Rollback

**Runtime boundary — one revert plus one Worker rollback. No migration rollback is required.**

```text
Revert the BUILD 26B runtime commits:
  67de80dac5c7ae48cd59360f09ff74ea0c1f4718     (D-6a correction)
  eaef1bd7f52ef9b8699b762e998bdd2e8e70c8d3     (implementation)

Restore the prior deployment:
  production build 6bfdbfe87543
```

The test-only and documentation-only commits carry no runtime effect and need no rollback. Because
this build added no migration, the ordering hazard recorded in BUILD 25 (§7.3 — Worker before
migration) **does not apply here**.

## 14. Status

```text
BUILD 26B — PASS / CLOSED                                          2026-08-05

G1  PASS   Founder-attested   Desktop Chrome Google sign-in
G2  PASS   Founder-attested   Desktop Safari Google sign-in
G3  PASS   Automated          six widths on the deployed candidate
G4  PASS   Founder-attested   physical Android Chrome full journey
G5  PASS   Automated          unauthenticated shell confidentiality
G6  PASS   Founder + Automated  OAuth cancellation & expiry safety
G7  PASS   Founder-attested   sign-out and session restoration
G8  PASS   Founder-attested   BUILD 25 resolution regression

Fixed      D-1 · D-2 · D-4 · D-5 · D-6a
Deferred   D-3 (footer link targets) · D-6b (Guest-surface .button anchors)
Not a defect  D-0 (test fixture error)

Tests      web 2137/204 · Playwright 49 · tsc clean · OpenNext OK · 12/12 mutants killed
Runtime    67de80dac5c7 · Worker 82af291a @ 100%
Migrations 37/37 · no drift · none added
Native     untouched — 56bb830, build 82, xcscheme hash exact
```

**BUILD 25 remains PASS / CLOSED and untouched**, re-verified by G8.

## 15. References

| Item | Value |
|---|---|
| Inherited Web baseline | `8d860d7625a2491dee663f20c0f635047ae8a0a6` |
| Implementation | `eaef1bd7f52ef9b8699b762e998bdd2e8e70c8d3` |
| D-6a correction (production runtime) | `67de80dac5c7ae48cd59360f09ff74ea0c1f4718` |
| G6 test-only | `bdeb811546894a8801a961817c9e6ecd3fb80148` |
| Deployment version | `82af291a-ee52-415a-af78-1ab1b6012021` |
| Live build identity | `67de80dac5c7` |
| Prior production build (rollback target) | `6bfdbfe87543` |
| Native HEAD (untouched) | `56bb830e5a38cf575b498f5f02550d5bc6915a5a`, build 82 |
| Production project ref | `zycwaqignioawtqynopj` |

Related: [BUILD 25](./BUILD25_GUEST_VISIBLE_REQUEST_RESOLUTION_V1.md) — the closed build this
slice inherited and preserved.
