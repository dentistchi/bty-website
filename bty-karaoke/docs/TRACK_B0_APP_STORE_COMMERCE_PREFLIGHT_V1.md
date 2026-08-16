# TRACK B0 — App Store Commerce Preflight & Payment Authority Design V1

**Status:** `PREFLIGHT PASS — IMPLEMENTATION PLAN READY`
**Scope:** read-only forensics + commerce/payment authority design ONLY. No StoreKit, no migration, no App Store Connect product creation, no deploy, no production mutation.
**Isolated project:** bty-karaoke Supabase (ref `zycwaqignioawtqynopj`).
**Foundation:** BUILD 17 Timed Access Pass (`20260728120000`) + BUILD 18C Product & Pricing Contract (`CONTRACT PASS / CLOSED`).
**Baseline at authoring:** server `40fe04c9` · native `ec05d999` (build 82) · both equal to `origin/main`.

> **This document does NOT assert App Review readiness.** It asserts that the commerce
> implementation plan is ready to begin. Account deletion, support URL, reviewer access,
> purchase UI, StoreKit, refund handling, and App Review assets all remain OPEN.

---

## 1. Blocker resolution (Founder-supplied, 2026-08-05)

Track B0 originally returned `BLOCKED — REQUIRED AUTHORITY OR IDENTITY NOT ESTABLISHED` on two
console-only facts that cannot be read from any repository. The Founder has supplied them.

| ID | Blocker | Resolution |
|---|---|---|
| **B1** | App Store Connect app record exists? | **RESOLVED — YES.** Name `BTY Norebang`; platform iOS only; primary language Korean; Bundle ID `com.bty.BTYNorebangAdmin`; SKU `BTY-NOREBANG-IOS-001`; price Free. **No In-App Purchases exist yet.** |
| **B2** | TestFlight / submission history? | **RESOLVED — NONE.** No TestFlight builds, no TestFlight submission history, no App Store submission history for this record. |

**Consequence of B2 being empty:** the first binary ever uploaded will be reviewed as a *new app*,
not an update. The three consumables must therefore be attached to the **same version submission**
as the binary that sells them — the single most commonly missed App Store Connect step, and now a
first-submission requirement rather than an update-time one.

**Authority verdict updated:** `BLOCKED` → **`PREFLIGHT PASS — IMPLEMENTATION PLAN READY`**.

---

## 2. Founder decision ratification record

### FD-1 — StoreKit Product IDs: **KEEP BUILD 18C IDs** ✅ RATIFIED

```text
com.btydaily.norebang.pass.1hour     → 3600 s   → ONE_HOUR
com.btydaily.norebang.pass.4hour     → 14400 s  → FOUR_HOURS
com.btydaily.norebang.pass.24hour    → 86400 s  → TWENTY_FOUR_HOURS
```

The prefix mismatch against Bundle ID `com.bty.BTYNorebangAdmin` is **knowingly accepted**. Apple
does not require the Product ID to share the Bundle ID prefix. The chosen IDs match the brand
domain the product actually serves from (`btydaily.com`) and avoid embedding the developer-internal
word "Admin" into three permanently immutable customer-facing identifiers.

> **Product ID and purchase type are immutable after creation.** A typo or a wrong
> Consumable/Non-Consumable choice is unrecoverable — the product must be abandoned and remains
> visible in financial reports forever. **These products are NOT created in Track B0 or BUILD 26E.**

### FD-2 — App Store name: **`BTY Norebang`** ✅ RATIFIED

Distinct from the binary's `CFBundleDisplayName` = `BTY Norebang Admin`. The store listing drops
"Admin"; the on-device name is unchanged by this decision.

### FD-3 — Apple transaction uniqueness boundary ✅ RATIFIED (deviation from BUILD 18C §10 G2)

```sql
UNIQUE (environment, apple_transaction_id)
```

BUILD 18C §10 G2 specified `UNIQUE(apple_transaction_id)` alone. The refinement is approved.

**Why.** Apple guarantees transaction-ID uniqueness *within* an environment. Sandbox and Production
are separate ID spaces, and sandbox IDs are not drawn from a range Apple promises will never
intersect production. Under the bare-ID constraint, a sandbox transaction colliding with a real
production ID would cause the **production purchase to be silently rejected as a duplicate** — the
customer is charged and receives nothing, and the failure is indistinguishable from correct
idempotency.

This is a **strict superset** of the 18C guarantee: BUILD 18C invariant 11 ("transaction replay
cannot duplicate a paid Pass") still holds within any environment.

**It is not sufficient alone.** It must be paired with a rule that a `Sandbox` row can never produce
a pass grant visible to a production entitlement read. The index prevents duplicate *rows*; the
environment gate prevents cross-environment *grants*. Both are required. (Gate G11.)

### FD-4 — Account deletion & retained records ✅ RATIFIED

1. **Never hard-delete** the canonical `karaoke_accounts` row where doing so would cascade-delete
   pass, audit, purchase, playback, event, or legally retained records.
2. Deletion must **revoke access, remove identities, remove or anonymize personal information**, and
   retain only records with a documented operational, security, tax, refund, or audit basis.
3. **New purchase-ledger foreign keys must never use `ON DELETE CASCADE` from `karaoke_accounts`.**

This ratification makes BUILD 18C §7 ("Never delete playback / Event / purchase / activation
history") implementable. It is currently **not** implementable — see §4.

---

## 3. Carried-forward Track B0 findings (unchanged, still authoritative)

### Verified app identity

| Field | Value | Source |
|---|---|---|
| Bundle ID | `com.bty.BTYNorebangAdmin` | `project.pbxproj:428` |
| Team ID | `CS92W2HFCH` (already public via live AASA) | `src/domain/aasa.ts:6` |
| Marketing version / build | `1.0` / `82` | `project.pbxproj:427/404` |
| Deployment target | `IPHONEOS_DEPLOYMENT_TARGET = 26.5` | `project.pbxproj:423` |
| Sign in with Apple | **enabled**, server-verified against Apple JWKS | `.entitlements`, `apple-auth.server.ts` |
| Associated domain | `applinks:norebang.btydaily.com`, claims only `/app/join/*` | `aasa.ts:14` |
| Production API base | `https://bty-karaoke.ywamer2022.workers.dev` | `APIClient.swift:59` |
| StoreKit / IAP code | **NONE** — no `import StoreKit`, no `.storekit` file, no purchase surface | exhaustive grep |

### Pass semantics — the unit mismatch

| | Unit | Authority |
|---|---|---|
| **FREE 900 s** | **playback-consumption seconds** (`sum(lease_seconds)`) | `karaoke_free_minutes_entitlement_at_v2` |
| **Paid pass** | **elapsed wall-clock from activation** | `timed_pass_expiry_math_chk`, 18C §5 |

FREE resets at `reset_hour_local = 4` in the account timezone (default `America/Los_Angeles`), on a
`[04:00, +1 day)` window — `+1 day`, not `+24 hours`, so it stays one calendar day across both DST
transitions.

**A customer who generalizes from FREE will expect "1 hour" to mean an hour of singing.** It does
not: the paid clock runs through pauses, an empty queue, backgrounding, force quit, device shutdown,
and network loss. This is deliberate contract (18C §5) and is not being changed — but it must be
disclosed on the purchase screen and the arming screen, in the customer's own terms. The 18C-mandated
arming copy states when the clock *starts* and says nothing about what makes it *stop*. That is the
half that is missing. **(Founder decision FD-8, still open.)**

### Existing commerce implementation: zero, and test-enforced

`src/app/host/plan/page.test.tsx` asserts there is **no** purchase/upgrade/checkout CTA anywhere on
the plan page, and that even in PRO pilot no price or purchase CTA exists. Native
`UsageProjection.swift` hard-codes `ctaAvailable = false` with the comment *"a truthful 준비 중 notice
with only Back/OK — never a fake purchase."*

**These tests must be deliberately inverted when the purchase surface ships.** That is a feature of
the design, not an obstacle: it forces the change to be explicit rather than incidental.

---

## 4. The deletion blocker (root cause, carried forward — B4)

```text
supabase/migrations/20260728120000_karaoke_timed_access_passes.sql
  timed_access_pass_grants.account_id  → karaoke_accounts(id) ON DELETE CASCADE
  timed_access_pass_audit.account_id   → karaoke_accounts(id) ON DELETE CASCADE
```

**Deleting a `karaoke_accounts` row silently deletes every pass grant and the entire append-only
audit trail for that account.** The audit table's immutability trigger does not protect it — a
cascade delete is a delete, not an update, and the trigger guards `UPDATE`/`DELETE` statements
issued against the table, not referential action.

Nobody has hit this because **in-app account deletion does not exist**: `DELETE /api/host/me` revokes
a single session and explicitly *"never ends an active Event, never deletes the Room, never deletes
Event history."*

This is simultaneously:
- an **App Review blocker** (Guideline 5.1.1(v) — an app that creates accounts must offer in-app deletion), and
- a **commerce correctness blocker** (financial records must survive deletion; Apple refund
  notifications for a deleted account still arrive and must still find a home).

FD-4 ratifies the fix. BUILD 26E implements it.

> **Measurement caveat.** The FK/cascade list above was measured by grepping migration sources for
> inline `references public.karaoke_accounts(id) on delete …`. A **definitive** catalog of every
> foreign key referencing `karaoke_accounts` and its `ON DELETE` behaviour requires an
> `information_schema` / `pg_constraint` read against the live database. That read is **BUILD 26E
> Part 1** and has **not** been performed. Do not treat this list as complete.

---

## 5. BUILD 26D closure gate — NOT CLOSED

Track B1 authorized BUILD 26E **if and only if** BUILD 26D is formally `PASS / CLOSED`, from
repository evidence or an explicit Founder-provided closure record. Neither exists.

### Evidence search (exhaustive)

| Search | Result |
|---|---|
| `git grep -iE 'BUILD ?26[CD]'` across the entire monorepo (tracked files) | **0 hits** |
| `bty-karaoke/docs/` closure documents | latest is `BUILD26B_…_V1.md`. **No 26C, no 26D.** |
| Native repo markdown / gate documents | **none exist** (the native repo carries no docs) |
| Native `BUILD 26D` references | 4 hits, all inside `Tests/QueueContractTests.swift` |
| Founder-provided closure record in the Track B1 prompt | **not supplied** — the prompt states G4–G8 "is being completed in a separate Track A conversation" |

### Required closure evidence vs actual

| Required | Present? | Actual |
|---|---|---|
| G4 result | ❌ | absent |
| G5 result | ❌ | absent |
| G6 result | ❌ | absent |
| G7 result | ❌ | absent |
| G8 result | ❌ | absent |
| final native commit | ⚠️ | `ec05d999` is the latest 26D commit but is **not declared final** |
| final native build number | ⚠️ | `82` — unchanged; the commit states "no build-number increase" |
| push status | ✅ | pushed; `origin/main == HEAD` |
| preserved tree state | ✅ | `xcscheme` modification present and byte-verified |
| explicit `BUILD 26D PASS / CLOSED` verdict | ❌ | **absent** |

### The only BUILD 26D commit is test-only

`ec05d999` — *"test(ios): BUILD 26D — cover Native callback routing (Guest handoff vs Google
OAuth)"* — touches exactly one file (`Tests/QueueContractTests.swift`, +113 lines) and states in its
own message:

> **NO PRODUCTION CHANGE.** No runtime source, no project configuration, no xcscheme, no migration,
> no Web change — and therefore no build-number increase: CFBundleVersion stays 82 in both
> configurations. **No runtime defect was found in the routing implementation; it was correct and
> merely unproven.**

It closes a *test-coverage* gap in URL callback routing. It reports **no G4–G8 result** and issues
**no closure verdict**. Per Track B1's explicit instruction — *"Do not assume BUILD 26D is closed
merely because BUILD 26D commits exist"* — this is not closure.

**G1–G3 are not reopened by this document. The G3 PASS verdict is not reinterpreted.**

### Consequence

**BUILD 26E is NOT implemented.** No migration was designed or written, no endpoint was added, no
native UX was built, no retention matrix was executed as Part 2 work, and no authentication code was
touched — correctly, because Track A is still establishing its final auth baseline and BUILD 26E
modifies exactly that surface.

---

## 6. Repository state (verified at authoring, unmodified by Track B0/B1)

### Native — `/Users/hanbit/Dev/bty-norebang-admin-ios`

```text
branch        main
HEAD          ec05d9999582631e76098d1e974be0a3dc6bf407
origin/main   ec05d9999582631e76098d1e974be0a3dc6bf407   (equal — 0 unpushed)
build         CFBundleVersion 82 · MARKETING_VERSION 1.0
preserved     M BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
              sha256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

The scheme hash is **byte-identical to the value recorded in `ec05d999`'s own commit message**,
independently confirming the Founder's device-gate rig (`LaunchAction Debug→Release`, disabled
`-BTYAPIBaseURL` arguments) is intact and untouched.

### Server / web — `/Users/hanbit/Dev/btytrainingcenter`, scope `bty-karaoke/`

```text
branch        main
HEAD          40fe04c99c0b9d7c3a54beac90e55d0d3bc6fe74
origin/main   40fe04c99c0b9d7c3a54beac90e55d0d3bc6fe74   (equal — 0 unpushed)
preserved      M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
              ?? bty-karaoke/brand/
```

Both repositories are **byte-identical to the Track B0 baseline**. Track A has landed nothing
between Track B0 and Track B1.

---

## 7. Open blockers after B1

| ID | Blocker | Owner | Status |
|---|---|---|---|
| ~~B1~~ | ~~ASC app record~~ | ~~Founder~~ | ✅ **RESOLVED** |
| ~~B2~~ | ~~TestFlight history~~ | ~~Founder~~ | ✅ **RESOLVED** |
| **B3** | In-app account deletion does not exist — Guideline 5.1.1(v) | BUILD 26E | **OPEN — gated on 26D** |
| **B4** | `ON DELETE CASCADE` would destroy pass + audit records | BUILD 26E | **OPEN — gated on 26D** |
| **B5** | No support URL (`/support` route does not exist) | App Review slice | OPEN |
| **B6** | No reviewer demo path — Host surface is fully auth-gated | App Review slice | OPEN |
| **B7** | Notification-URL domain readiness (`workers.dev` vs `norebang.btydaily.com`) | Founder (FD-9) | OPEN |
| **B8** | ~~FD-1 ratification before ASC product creation~~ | ~~Founder~~ | ✅ **RESOLVED (FD-1)** |
| **B9** | **BUILD 26D not formally closed** | Track A | **OPEN — blocks BUILD 26E** |

## 8. Founder decisions still open

FD-5 (purchase while a pass is ACTIVE), FD-6 (hoarding cap on held `AVAILABLE` passes), FD-7
(purchase while FREE remains), **FD-8 (wall-clock disclosure — non-optional)**, FD-9 (notification
domain), FD-10 (deployment target 26.5), FD-11 (`SUPPORTED_PLATFORMS` narrowing — *partially
answered by B1's "iOS only" ASC record; the pbxproj still lists `macosx xros xrsimulator`*), FD-12
(YouTube content-rights framing), FD-13 (reviewer demo account vs review mode), FD-14 (launch prices).

## 9. Next authorized step

**Track A closes BUILD 26D** with an explicit `PASS / CLOSED` record identifying G4, G5, G6, G7, G8
results, the final native commit, the final build number, push status, and preserved tree state.

On that record, BUILD 26E Slice 1 (canonical account ownership + account deletion authority)
proceeds under the Track B1 authorization, beginning with Part 1 forensics — including the
`information_schema` FK catalog that §4 defers.

---

*Track B0 preflight + Track B1 resolution only. No StoreKit, no App Store Connect product, no
migration, no endpoint, no native change, no deploy, and no production mutation were produced.*
