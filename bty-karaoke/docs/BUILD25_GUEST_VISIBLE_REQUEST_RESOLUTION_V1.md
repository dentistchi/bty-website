# BUILD 25 — GUEST-VISIBLE REQUEST RESOLUTION V1

**Status: IMPLEMENTED · MIGRATION APPLY BLOCKED · NOT DEPLOYED — 2026-08-02**

All three code halves are written, tested, committed, and pushed. Native build **80** is built in
both configurations and **installed on the Founder device**. Production still runs **BUILD 24**.

**This build is NOT deployed, and the deployment is deliberately withheld — not merely pending.**

- The production migration `20260808120000_karaoke_request_resolution_v1` is **UNAPPLIED**,
  confirmed by direct read-only probe (§7.1), not assumed.
- The Supabase CLI cannot apply it, cannot dry-run it, and cannot even *read* the migration
  ledger for this project. Root cause is identified in §7.2 — it is an **access-privilege fact,
  not a transient error**.
- **Deploying the web half before the migration would break two currently-working production
  flows** — Guest self-cancel and Host remove/skip (§7.3). This is proven from the diff, not
  estimated. That is why deployment was stopped rather than attempted.

This is the deviation BUILD 24 §7.3 recorded and §10 carried forward with the instruction
*"clear before the next migration."* It was not cleared, and it has now blocked exactly where it
was predicted to.

**No Founder device gate has been executed.** G1–G8 cannot produce honest evidence until the
server half is live; the app is installed and ready, and the gate sequence is defined in §8.

---

## 1. The defect

> A Guest-owned request could be removed, skipped, or closed by the Host or by the Event
> lifecycle and simply **vanish** from the Guest's screen, with no explanation.

The active queue stayed canonically correct the whole time. The **user's own journey** did not.
A Guest who watched their song disappear had no way to learn whether they had cancelled it, the
Host had removed it, the Host had ended its playback, or the 노래방 had closed.

### Why the server had to change first

`karaoke_requests.status` **cannot carry why**:

| Terminal status | Writers that produce it |
|---|---|
| `removed` | Guest cancel · Host remove · Event end |
| `skipped` | Host skip of a waiting row · Host stop of a playing row · Event end of a playing row |

Status alone cannot distinguish *"you cancelled this"* from *"the Host removed it."* Inference was
rejected outright: once an Event has ended, a Host removal that happened **earlier** is
indistinguishable from an Event-end closure, so inference would assert a **false reason** — the
one outcome the product contract forbids. The reason is therefore recorded by the mutation that
knows it, as a stable machine code, and never derived on a client.

### The second half of the disappearance

Both Guest clients then **deliberately discarded** the terminal row — `domain/guest-requests.ts`
("belongs to NEITHER — it drops out") and the native `myRequestStatus` default branch. The server
had been publishing a durable terminal state all along. Dropping it is what produced the silence.

The web client additionally scheduled `onRemoved(requestId)` six seconds after a request went
terminal, which **deleted it from persisted storage** — so a refresh could not recover it either.

### The native cancel trap

`finishCancel` deleted the owner capability the instant a cancel succeeded — both the in-memory
token and the durable record. That capability is the **only** proof the device owns the request,
and the owner-only endpoint needs that proof to answer. So the one disposition a Guest is most
certain about — their own cancellation — was also the one this client could never be told about.

---

## 2. Resolved behaviour

A resolved request is **kept and explained**, exactly as completed history is kept.

| Code | Copy shown to the Guest |
|---|---|
| `guest_cancelled` | 신청을 취소했어요. |
| `host_removed` | Host가 이 곡을 대기열에서 제거했어요. |
| `host_skipped` | Host가 이 곡의 재생을 종료했어요. |
| `event_ended` | 노래방이 종료되어 이 신청곡의 진행이 끝났어요. |
| `unknown_resolution` | 이 곡은 더 이상 대기열에 없어요. |

`unknown_resolution` is a **projection fallback only** — the database CHECK rejects it as a stored
value. Persisting it would erase the difference between *"no reason was ever recorded"* and *"the
reason is genuinely unknown."* It is what a legacy null, or an unrecognised future code, degrades
to: shown, never dropped, and never guessed into one of the four real reasons.

The copy table is held **identical on both clients** so the two cannot describe the same
disposition differently. No sentence claims completion; none but `guest_cancelled` says the Guest
cancelled; the fallback guesses no actor.

### The card is control-free

No Cancel, no Ready, no queue position, no Host action, no 다시 신청. The request is over; the
card's only job is to say what happened. Muted, never error-red — this explains something that did
not go the Guest's way, and it is not an alarm.

---

## 3. Changes

### Migration — `20260808120000_karaoke_request_resolution_v1.sql`

Additive, forward-only, single `begin; … commit;`. **Applied status: NOT APPLIED (§7.1).**

| Object | Nature |
|---|---|
| `karaoke_requests.resolution_code` · `.resolved_at` | two **nullable** columns, `add column if not exists` |
| `karaoke_requests_resolution_valid` | one CHECK carrying all five invariants |
| `karaoke_requests_resolved_idx` | partial index, `where resolution_code is not null` |
| `karaoke_end_song_v2` | republished — records `host_skipped` inside its existing transaction |
| `end_karaoke_event` | republished — records `event_ended` inside its existing transaction |

No backfill, no guessed `UPDATE`, no destructive operation, nothing in the accounting graph read
or written. All 362 production rows take `(null, null)` and satisfy the first disjunct, so the
constraint validates immediately and rejects nothing that legitimately exists.

**A real bug the local Postgres suite caught before apply.** A CHECK constraint rejects a row only
when its expression is **FALSE** — an expression evaluating to **NULL passes**. Written the obvious
way, `(resolution_code, resolved_at) = (null, <ts>)` yields `FALSE or (NULL in (…) and …)` = NULL,
so a timestamped resolution with **no reason** would have been silently accepted. Each disjunct now
leads with an explicit `IS [NOT] NULL` test, forcing FALSE. Do not "simplify" these away.

### API — one new owner-only surface

`POST /api/rooms/{slug}/requests/resolved`

`GET /api/rooms/[slug]/requests/[id]` is **public** — no capability check — so a reason there
would be readable by anyone holding a request id. It stays reason-free, asserted by test.

### Web · Native

| Half | Commit | Content |
|---|---|---|
| Server + migration + owner-only API + web domain | `7bc6ccd5` | resolution writers, `request-resolution.ts` / `.server.ts`, the new route, `guest-requests.ts` |
| Guest Web 신청 결과 section | `4be711ee` | `MyRequestsDock.tsx`, `globals.css`; the 6-second erasure removed |
| Native domain layer (build 79) | `a6b2681` | `GuestResolutionCode`, decode types, merge + Event predicate, copy table |
| **Native visible surface (build 80)** | **`804c837`** | `GuestResolvedRetrieval`, durable store, `APIClient.fetchResolvedRequests`, VM wiring, the 신청 결과 section, capability retention at cancel |

---

## 4. Capability transport and privacy

The capability is the **same bounded, single-request token** issued at submit. It proves the device
owns exactly one request. It is never a session credential and is never logged.

| Property | How it is enforced |
|---|---|
| Capability in the **body**, never the URL | `POST` with `{items:[{requestId, token}]}`. A token in a URL lands in access logs, `Referer` headers, and crash reports, and cannot be recalled once there. |
| Ownership verified **before any database read** | `verifyOwnedClaims` runs first; an unproven id never reaches a query. |
| A token signs **one** id | A capability valid for request A cannot vouch for request B. |
| Event scope resolved **canonically server-side** | Never taken from the caller, so no caller can name another Event's rows. |
| Response built **key by key from an allowlist** | Not a spread, not a delete-list — a field reaches a Guest only because a line was written for it. |
| "Not yours" is **indistinguishable** from "does not exist" | Failed claims are dropped silently; an all-expired client and a prober both get `{resolved: []}`. No 403. |
| Database errors never reach the client | One fixed sentence; a Postgres message can carry column names, constraint names, and row content. |
| Not cacheable | `no-store` on the response; `reloadIgnoringLocalCacheData` on the native request. Per-guest state in a shared cache is a cross-guest leak. |

**The native decode type is itself the privacy proof:** only the nine allowlisted keys are
representable, so a server that leaked `accountId` / `cancelToken` / `sessionId` could not surface
them on the device even by accident. Asserted by reflecting over the decoded struct after feeding
it a deliberately over-wide payload.

**The transport property is proven, not reviewed.** `APIClient.resolvedRequestsRequest` is pure, so
the Host suite asserts the real `URLRequest`: POST, URL exactly the room path (no token, no request
id, no query, no fragment), no capability in any header, each id paired with its own token in the
body, `no-store`, bounded to the server's 50.

---

## 5. Precedence and isolation

### Precedence — the first truthful terminal disposition wins

Enforced by the guard that **already existed**, not by new logic. Every terminal writer is guarded
on its source status (`waiting` or `playing`), so a row another writer already resolved matches
**zero rows**. Proven under real concurrency in the Postgres suite: two transactions race, one
commits, the loser's predicate is re-evaluated against the committed row and matches nothing.
`end_karaoke_event` additionally carries an explicit `resolution_code is null` guard as defence in
depth at the one site that closes many rows at once.

### Exclusivity — a stale poll cannot resurrect a resolved request

Active ids are filtered against the resolved set. A status poll already in flight when the Host
acted still reports the request as `waiting`; **the resolution wins.** On native this is applied
twice — the moment the queue lands, and again on every publish — because it is a poll-order
property.

### Identity — everything keys on `requestId`, never `videoId`

A re-request of the same song is a genuinely different request that stays independently active
while the old one stays resolved. Asserted with two requests deliberately sharing one `videoId`.

### Event and Guest isolation

Two **independent** gates, because they fail differently:

1. the **session gate** discards the remembered list when the Event genuinely changes;
2. the **row gate** refuses any row tagged with a different Event even if the list survived.

A `nil`/absent Event on either side is **not** treated as a change — a transient read that omits
the id must never erase an explanation the Guest already read. Storage is scoped by
`room :: event :: guestSession` on both clients, so one Guest's outcomes are not readable by the
next guest on the same device, and a new Event's scope starts empty.

### Retention of the cancel capability is bounded, not open-ended

Kept in memory and on disk after a successful cancel — same 12-hour expiry, same
Room + Event + session scope, still **dropped on a 403**, still cleared by 게스트 모드 나가기. A
cancel is idempotent and every writer is guarded on a still-cancelable source status, so a retained
token cannot cause a second effect.

### Failure preserves history

A transport failure, a non-2xx, or a room load that never succeeded all return **without
publishing**. Silence is the defect this build removes; erasing an explanation because one poll
failed would be a new way to produce it.

---

## 6. Tests — all green at the deployment candidate

| Suite | Result | Baseline |
|---|---|---|
| Web / server (`vitest`) | **2137 passed** · 204 files | unchanged from `4be711ee` |
| `tsc --noEmit` | **clean** | — |
| Native Host (`Tests/run.sh`) | **1652 passed / 0 failed** | 1631 → 1652 (+21) |
| Native Guest (`Tests/run-guest.sh`) | **771 passed / 0 failed** | 702 → 771 (+69) |
| Xcode **Debug** (`generic/platform=iOS`) | **BUILD SUCCEEDED** | — |
| Xcode **Release** (`generic/platform=iOS`) | **BUILD SUCCEEDED** | — |
| Debug `CFBundleVersion` | **80** | read from the built `Info.plist` |
| Release `CFBundleVersion` | **80** | read from the built `Info.plist` |

No test was removed in any suite.

### Testing a surface no harness can compile

`GuestRoomViewModel` / `GuestRoomView` are SwiftUI + `@MainActor`; the swiftc runners build only
the pure Foundation core, so **no suite compiles them.** The behaviours a future edit would
silently break are therefore pinned against the **shipped source text**: capability retained at
cancel, fetch inside `load(initial:)` *after* the stale guard, failure-guard before every publish,
and a card with no controls. **A scan that cannot read its file FAILS** — a green check for a file
that was never read would be worse than no check at all.

Five mutants were introduced and all five were killed: re-added the capability delete, removed the
fetch, dropped the stale guard, added a Cancel button, published on failure. The file was restored
byte-identical afterwards (verified by SHA-256).

---

## 7. Deployment — BLOCKED

```text
Production (unchanged)   BUILD 24
/api/karaoke-build       abece404917a          (= BUILD 24 G1 fix, abece404)
Migration                20260808120000        NOT APPLIED
Worker                   unchanged — no BUILD 25 deployment was attempted
Native                   build 80 (804c837) — INSTALLED on the Founder device
```

### 7.1 The migration is unapplied — measured, not assumed

Read-only probe against `zycwaqignioawtqynopj` with the `service_role` key. No row was written.

```text
GET /rest/v1/karaoke_requests?select=id,resolution_code,resolved_at&limit=1
  → 400  {"code":"42703","message":"column karaoke_requests.resolution_code does not exist"}

GET /rest/v1/karaoke_requests?select=id,status&limit=1        (control)
  → 200
```

The control proves the probe path is sound, so the `42703` is a real absence and not an
authentication artefact.

### 7.2 Root cause — the CLI identity cannot reach this project

```text
supabase migration list --linked        403  "Your account does not have the necessary
supabase db push --linked --dry-run     403   privileges to access this endpoint."
```

BUILD 24 recorded this as an unexplained 403. **It is now explained.** `supabase projects list`
returns exactly one project for the authenticated identity:

```text
ORG ID                | REFERENCE ID         | NAME
bpnzomwltvvhtjuwzeiw  | gdqqivlzhgtqdqmvndkf | bty-release-manager
```

`zycwaqignioawtqynopj` — the BTY Norebang production project — **is not in the list and is not
marked LINKED.** The CLI is authenticated as an identity with no access to it. This is a standing
access-privilege fact, not a transient platform error, and no retry will change it.

The CLI's fallback path (`SUPABASE_DB_PASSWORD`, or `--db-url`) is also unavailable: no database
password and no access token exist on this machine or in the repository. The only credential
present is the `service_role` key, which reaches **PostgREST**, and PostgREST cannot execute DDL.

**Consequence, stated plainly:** local↔remote migration parity **cannot be established from this
machine**, in either direction. §7.1 proves this one migration is unapplied; it does **not** prove
the rest of the ledger is consistent. That remains unverified.

No repair, force, squash, manual history edit, or bypass was used. None is authorised.

### 7.3 Why deployment was stopped, and not merely deferred

Deploying `4be711ee` before the migration would **break two flows that work in production today**.
Both write the new columns unconditionally in the same statement as the status flip:

| Path | Call site | Result without the columns |
|---|---|---|
| **Guest self-cancel** | `cancelOwnRequest` — `.update({status:'removed', resolution_code:'guest_cancelled', resolved_at:…})` | `42703` → the cancel fails |
| **Host remove / skip of a waiting song** | `setRequestStatus` — `HOST_RESOLUTION[action]` spread into the same `.update` | `42703` → the Host action fails |

This is read from the committed diff, not estimated. **Deploy-before-migrate is therefore a
production-breaking sequence, and the order is not negotiable:** migration first, deployment
second.

### 7.4 What was NOT done, and is not claimed

| Step | Status |
|---|---|
| Migration dry run | **NOT EXECUTED** — 403 (§7.2) |
| Migration apply | **NOT EXECUTED** — blocked |
| Migration parity re-check | **NOT EXECUTED** — blocked |
| Production deployment | **NOT EXECUTED** — deliberately withheld (§7.3) |
| Deployment ID / version | **NONE** — no deployment exists to identify |
| Live API smoke of `POST …/requests/resolved` | **NOT EXECUTABLE** — the route is not deployed; production would return 404 for reasons unrelated to the contract |
| Live security smoke (non-owner refusal, expired capability) | **NOT EXECUTABLE** — same reason; asserting it against an undeployed route would prove nothing |
| Founder device gates G1–G8 | **NOT EXECUTED** — see §8 |

No deployment ID, deployed-commit identity, or live-smoke result is recorded anywhere in this
document, because none was observed.

---

## 8. Founder device gates — defined, not executed

Native build **80** (`804c837`) is installed on the Founder's iPhone 17 Pro Max
(`80C931D3-265B-5B37-B608-F3EB200C66AA`). The app is ready.

**No gate can produce honest evidence yet.** Every gate below depends on the server recording a
resolution reason, which requires the migration **and** the deployment. Running G1 today would show
an empty 신청 결과 section and prove only that the server half is absent.

| Gate | What it proves |
|---|---|
| **G1 — HOST REMOVED** | Host removes a queued request → `Host가 이 곡을 대기열에서 제거했어요.`; no controls; survives poll + relaunch |
| **G2 — GUEST CANCELLED** | Guest cancels their own → `신청을 취소했어요.`; **capability retention is what makes this retrievable** |
| **G3 — HOST SKIPPED** | Host ends playback → `Host가 이 곡의 재생을 종료했어요.`; does not return to the active list |
| **G4 — EVENT ENDED** | Host ends the Event → `노래방이 종료되어 이 신청곡의 진행이 끝났어요.`; no stale active row |
| **G5 — POLL AND DUPLICATION** | Each result appears exactly once across repeated polls; a late stale poll cannot resurrect it |
| **G6 — SAME VIDEO, DIFFERENT requestIds** | One resolves, the other stays independently active; video identity must not collapse them |
| **G7 — EVENT AND GUEST ISOLATION** | Another Guest cannot see it; a new Event does not inherit it; exiting Guest mode clears the scoped data |
| **G8 — FAILURE PRESERVATION** | A controlled fetch failure leaves established history visible; recovery neither duplicates nor erases |

### UNKNOWN RESOLUTION FALLBACK — automated-contract verified, physically non-executable

`이 곡은 더 이상 대기열에 없어요.` is pinned by automated test on both clients, including
forward-compatibility (an unrecognised future code degrades to `unknown_resolution` rather than
failing to decode, and the row is still **shown**).

It is **not** executable as a physical gate. The database CHECK refuses to store
`unknown_resolution`, so manufacturing one live would require either writing an invalid enum or
backdating production rows. The repository contains no safe, reversible, authorised fixture
mechanism for it. **Recorded honestly as automated-contract verified and physically
non-executable** — not as a pass.

---

## 9. Working-tree and artefact integrity

```text
Web    /Users/hanbit/Dev/btytrainingcenter      HEAD = origin/main = 4be711ee
       build inputs (src, public, supabase, package*.json, next/open-next/wrangler config)
       are clean and exactly at 4be711ee

Native /Users/hanbit/Dev/bty-norebang-admin-ios HEAD = origin/main = 804c837
       only pre-existing change:  BTYNorebangAdmin.xcscheme  (modified, unstaged, untouched)
       SHA-256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
       — identical before preflight, after both Xcode builds, and after device install
       CURRENT_PROJECT_VERSION = 80 in Debug and Release
```

No reset, stash, discard, rebase, clean, or force-push was used in either repository. No
`git add -A` / `git add .`. No native source change was made in this session — none was needed,
because no regression was found.

Two pre-existing, unrelated items sit in the web working tree and were **not** touched:
`bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md` (modified) and `bty-karaoke/brand/` (untracked).
Neither is a build input.

---

## 10. Status

```text
BUILD 25 — IMPLEMENTED · MIGRATION APPLY BLOCKED · NOT DEPLOYED    2026-08-02

Code            COMPLETE   7bc6ccd5 · 4be711ee · a6b2681 · 804c837 (build 80)
Tests           GREEN      web 2137/204 · tsc clean · Host 1652 · Guest 771
Builds          GREEN      Debug + Release · CFBundleVersion 80 / 80
Device          READY      build 80 installed on the Founder device
Migration       BLOCKED    CLI identity has no access to zycwaqignioawtqynopj (§7.2)
Deployment      WITHHELD   deploy-before-migrate breaks live cancel + remove/skip (§7.3)
Gates G1–G8     NOT RUN    cannot produce honest evidence until the server half is live

BLOCKING ITEM — carried from BUILD 24 §7.3 / §10 ("clear before the next migration"):
  the Supabase CLI cannot reach the production project. It requires a Founder credential
  action; it cannot be resolved from this machine, and no bypass is authorised.
```

**PASS / CLOSED is not claimed and must not be claimed** — not for the build, and not for any
individual gate.

---

## 11. References

| Item | Value |
|---|---|
| Web HEAD (= `origin/main`) | `4be711ee1a3cbfd763c2b2524631b7b2bd090ebf` |
| Server / migration / owner-only API | `7bc6ccd5` |
| Guest Web 신청 결과 | `4be711ee` |
| Native domain layer (build 79) | `a6b2681` |
| Native visible surface (build 80) | `804c837520ff8bb0a64536729c089d2c9fcf29c5` |
| Migration file | `bty-karaoke/supabase/migrations/20260808120000_karaoke_request_resolution_v1.sql` |
| Migration SHA-256 | `896728f74cd26224b402b2143029da301778a976da9c68954e846cbd98961a84` |
| Production project ref | `zycwaqignioawtqynopj` |
| Live build endpoint | `https://norebang.btydaily.com/api/karaoke-build` → `abece404917a` (BUILD 24) |

Related: [BUILD 24](./BUILD24_LIVE_PLAYBACK_CLOCK_FREE_BALANCE_TRUTH_V1.md) §7.3 · §10 —
the deviation this build was blocked by.
