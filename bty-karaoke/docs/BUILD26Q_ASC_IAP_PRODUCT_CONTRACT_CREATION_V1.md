# BUILD 26Q — ASC IAP Product Contract & Creation (Track B Slice 4)

**Status: BLOCKED / FOUNDER DECISION REQUIRED — 2026-08-13**

The server-side product contract is fully inventoried and **two of the three immutable ASC fields
are proven**: the three Product IDs and the purchase type. Creation did **not** happen, for two
independent reasons — one environmental, one a decision that has never been made.

> **NO App Store Connect product was created. Nothing in this document may be read as evidence that
> one exists.** Product ID and purchase type are immutable after creation, so an ambiguity must not
> be converted into a permanent Apple artifact.

---

## 1. Verdict

`BLOCKED / FOUNDER DECISION REQUIRED`

| Blocker | Kind | Detail |
|---|---|---|
| **B-1 — no ASC access from this environment** | environmental, hard | No App Store Connect API credentials, no `.p8` key, no Fastlane, no `altool`/`asc` tooling. Programmatic creation is impossible here. |
| **B-2 — FD-14 launch pricing never ratified** | decision | Prices appear in a closed contract doc, but the **most recent** authority still lists them as an open Founder decision. |

**Proven and frozen:** the three Product IDs (FD-1) and the purchase type (Consumable).
**Not proven:** price.

## 2. Baselines — measured

```
monorepo   HEAD = origin/main = 74618849a3b6fd52232a5082272be9a0dcf039d1   (0 0)   ✅ 26P closure
native     a131d600071927cdedce894cafd58ce0762fa5a2 · CFBundleVersion 95 · bundle com.bty.BTYNorebangAdmin
           team CS92W2HFCH                                                          ✅ untouched
deployed   live build 2a3e88d70c2f · Worker 02baaf8a-e234-4e2c-b5e0-9d5f270fb174 · 100%
census     0 Apple purchases · 0 paid grants · catalog 3 · is_active=true 0
```

Preserved untouched: `M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md`, `?? bty-karaoke/brand/`,
`?? bty-karaoke/docs/TRACK_B0…md`, and ~380 unrelated Arena/Foundry paths, plus the native xcscheme
rig. Nothing was cleaned, staged or absorbed.

## 3. Three-product server census — MEASURED

Sources agree exactly: migration `20260811120000` (repo) and live `karaoke_product_catalog`
(production), read independently.

| | PASS_1H | PASS_4H | PASS_24H |
|---|---|---|---|
| `storekit_product_id` | `com.btydaily.norebang.pass.1hour` | `com.btydaily.norebang.pass.4hour` | `com.btydaily.norebang.pass.24hour` |
| Reference concept | 1-Hour Pass | 4-Hour Party Pass | 24-Hour Event Pass |
| `pass_type` | ONE_HOUR | FOUR_HOURS | TWENTY_FOUR_HOURS |
| `duration_seconds` | 3600 | 14400 | 86400 |
| `product_kind` | PAID_CONSUMABLE | PAID_CONSUMABLE | PAID_CONSUMABLE |
| Server entitlement meaning | wall-clock window from activation | same | same |
| `is_paid` / `is_active` | true / **false** | true / **false** | true / **false** |
| `contract_version` | BUILD_18C_V1 | BUILD_18C_V1 | BUILD_18C_V1 |
| Price in repo/production | **UNKNOWN** — no price column exists | **UNKNOWN** | **UNKNOWN** |
| Existing ASC evidence | **NONE** | **NONE** | **NONE** |
| Native reference evidence | **NONE** | **NONE** | **NONE** |

**Price is UNKNOWN in all authoritative material.** `karaoke_product_catalog` has no price,
currency or amount column — 26L §8 states this deliberately — and the verify/record path
(`apple-iap.server.ts`, `apple-purchase-ledger.server.ts`, `domain/apple-transaction.ts`) contains
no price token at all. Names were not used to infer any amount.

**Native carries no product identifier.** Grep for the three IDs and the three product codes across
all Swift, pbxproj and plist files returns zero hits — consistent with BUILD 26P, which shipped no
StoreKit.

### The DB values ARE the intended ASC Product IDs — no mapping layer

Proven, not assumed:

- the column is named **`storekit_product_id`** and is **UNIQUE**
  (`karaoke_product_catalog_storekit_idx`);
- the runtime resolves a purchase by matching the **verified Apple payload's `productId`** directly
  against that column — `apple-purchase-ledger.server.ts:168`,
  `.eq('storekit_product_id', storekitProductId)`;
- `karaoke_product_catalog_kind_chk` requires `storekit_product_id IS NOT NULL` for every
  `PAID_CONSUMABLE` row;
- Track B0 **FD-1** ratifies these exact strings as the StoreKit Product IDs.

There is no translation table anywhere. A mismatch between ASC and this column would make every
genuine purchase fail `unknown_product` (422) — so the strings must be created byte-for-byte.

## 4. Purchase type — Consumable, measured against Apple's four categories

Apple's StoreKit types are consumable, non-consumable, non-renewing subscription, and
auto-renewable subscription. The BTY contract was measured rather than assumed:

| Evidence | Measurement |
|---|---|
| Used up? | `timed_access_pass_grants` reaches **EXPIRED** — 22 rows live today |
| Repeatable? | one account holds up to **25** grants concurrently (measured) |
| Stackable inventory? | 23 `AVAILABLE` across accounts; multiple held passes are normal |
| Renewal machinery? | **none** — no `renew`, `subscription`, `billing_period` or `recurring` logic anywhere in the pass schema or service |
| Restorable? | no — the **server ledger** is the source of truth, not StoreKit `currentEntitlements` (18C §33) |
| Schema label | `product_kind` CHECK admits `PAID_CONSUMABLE` |

| Apple type | Verdict |
|---|---|
| **Consumable** | ✅ **CORRECT** — finite entitlement, used up on a wall-clock window, repeatedly purchasable, held as inventory, never restored |
| Non-consumable | ❌ implies a permanent, restorable one-time unlock; a pass expires |
| Non-renewing subscription | ❌ the closest alternative, and still wrong: it models a *service period* the user renews and expects restored across devices. A pass is not a period of access to content — it is a spendable unit, several of which can be held at once and switched between (26M carryover/switching) |
| Auto-renewable subscription | ❌ no recurrence exists anywhere in the contract |

18C §31 states the same conclusion independently: *"Consumable is correct: each Pass is a
single-Event, single-activation entitlement stored server-side, not restorable/renewing."*

**Purchase type is FROZEN: Consumable.**

## 5. App Store Connect pre-state — measured access, NOT measured ASC content

| Probe | Result |
|---|---|
| `~/.appstoreconnect/private_keys`, `~/private_keys`, `./private_keys` | **absent** |
| any `.p8` key in either repository | **none** |
| Fastlane / `Appfile` / `Fastfile` / `Deliverfile` | **none** |
| `fastlane`, `altool`, `asc` CLI | **not installed** (`xcrun` present) |
| ASC credential in login keychain | **none** — only `bty-norebang-supabase-pat` |
| ASC references in source | only **negative** assertions in `apple-verifier-parity.test.ts` proving we hold no `issuerId`/`keyId`/`privateKey` |

**Therefore no ASC record, bundle association, IAP inventory, product state, or agreement state was
read.** Nothing about ASC content is asserted anywhere in this document.

**Paid Apps Agreement status: UNKNOWN — not readable from this environment.** Apple requires the
Account Holder to have accepted the current Paid Apps Agreement before IAPs can be sold or, in
practice, created; an outdated agreement can block creation. This must be confirmed by the Founder
in ASC before creation is attempted.

Carried from BUILD 26J (Founder-attested, `PASS / CLOSED`): the ASC app record exists as
`BTY Norebang`, and **build 88 was uploaded, processed by TestFlight and installed on a physical
iPhone**. Track B0 §1 (B1) recorded **no In-App Purchases existed** at that time. Nothing since has
claimed otherwise, and this build could not re-read it.

## 6. Proposed immutable contract — PROPOSED, NOT CREATED

Every row below is a **proposal**. None has been created.

| Server `product_code` | Proposed ASC Product ID | ASC type | Reference name | Display name | Description | Base region | Base price | Availability | Server grant meaning | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| PASS_1H | `com.btydaily.norebang.pass.1hour` | Consumable | BTY Norebang 1-Hour Pass | 1시간 이용권 / 1-Hour Pass | 1 hour of hosting from first play | **DECISION** | **DECISION (FD-14)** | **DECISION** | 3600 s wall-clock | FD-1 · migration · production |
| PASS_4H | `com.btydaily.norebang.pass.4hour` | Consumable | BTY Norebang 4-Hour Party Pass | 4시간 이용권 / 4-Hour Party Pass | 4 hours of hosting from first play | **DECISION** | **DECISION (FD-14)** | **DECISION** | 14400 s wall-clock | FD-1 · migration · production |
| PASS_24H | `com.btydaily.norebang.pass.24hour` | Consumable | BTY Norebang 24-Hour Event Pass | 24시간 이용권 / 24-Hour Event Pass | 24 hours of hosting from first play | **DECISION** | **DECISION (FD-14)** | **DECISION** | 86400 s wall-clock | FD-1 · migration · production |

Reference names, display names and descriptions above are **drafts for Founder approval**, not
measured values — they exist nowhere in the repository. They are mutable in ASC, unlike Product ID
and type.

**Standing rules, unchanged:**

- Product ID must be created **byte-for-byte** as shown — the runtime matches on it directly.
- **Price is presentation only.** It must never become server authority for entitlement duration.
  Duration resolves solely as `verified productId → catalog → duration_seconds`.
- Client-supplied price, localized name, duration or granted seconds must never become fulfilment
  authority.
- `karaoke_product_catalog.is_active` stays **false** throughout 26Q. ASC existence is not server
  authorization to grant entitlement (26L §5).

## 7. The pricing ambiguity, stated exactly

Both facts are true and they conflict:

| Source | Says |
|---|---|
| `BUILD18C…V1.md` §2 — `CONTRACT PASS / CLOSED`, Commander-approved | US launch prices **$1.99 / $4.99 / $9.99**, described as "App Store Connect base-market **launch decisions V1**", reviewable after 100 verified paid activations, no A/B testing in V1 |
| `TRACK_B0…V1.md` §8 — the **later** document (2026-08-05), where the Founder resolved FD-1 and FD-2 | lists **FD-14 (launch prices)** among "Founder decisions still open" |

No document after Track B0 resolves FD-14. So the numbers exist in a closed contract, and the most
recent Founder-facing authority nonetheless treats launch pricing as an unmade decision.

**I did not resolve this.** Price is an ASC configuration value that becomes a real charge to real
customers; adopting $1.99/$4.99/$9.99 because they appear in an older document would be inventing
authority the newest document says does not exist.

## 8. FOUNDER DECISION REQUIRED

| # | Decision | Options | Why it blocks |
|---|---|---|---|
| **D-1** | **FD-14 launch prices** | (a) confirm 18C's $1.99 / $4.99 / $9.99 as final; or (b) supply different amounts | ASC creation requires a price; wrong pricing is customer-visible and commercially material |
| **D-2** | **Base country/region** | e.g. United States (18C prices are US) | Apple derives other storefronts from the base unless overridden |
| **D-3** | **Availability** | all territories, or a named subset | required at creation |
| **D-4** | **Reference / display names + descriptions** | approve §6 drafts or replace | customer-facing; not in any repo |
| **D-5** | **Paid Apps Agreement** | confirm the current agreement is accepted and effective | an outdated agreement can block IAP creation outright |
| **D-6** | **Who creates the products** | Founder in ASC UI, or provision an ASC API key for automation | this environment has no ASC access (§5) |

**D-1 and D-5 are hard prerequisites. D-6 determines whether the next attempt can be automated.**

## 9. If creation proceeds manually — exact fields

For each of the three, in App Store Connect → the `BTY Norebang` app → In-App Purchases → **＋**:

```
Type          Consumable                              (IMMUTABLE — verify before saving)
Product ID    com.btydaily.norebang.pass.1hour        (IMMUTABLE — byte-for-byte)
              com.btydaily.norebang.pass.4hour
              com.btydaily.norebang.pass.24hour
Reference     per D-4
Display name  per D-4   (at least one localization required)
Description   per D-4
Price         per D-1, base region per D-2
Availability  per D-3
Review info   screenshot + notes — required only at SUBMISSION, not creation
```

> **Double-check the Product ID and the Type on the confirmation screen.** Both are permanent. A
> typo cannot be corrected — the product must be abandoned and remains visible in financial reports
> forever.

**Do not submit for App Review in this build.** Apple requires the first IAP of a given type to be
submitted **with a new app version**, which would turn this into a release build. That dependency is
recorded in §11 and deferred.

## 10. Read-back — NOT PERFORMED

No product was created, so there is nothing to read back. When creation happens, PASS requires a
field-by-field read-back of Apple product identifier, reference name, purchase type, localization,
price/base territory, availability, ASC status and associated app — with any propagation delay
recorded **separately** from a contract mismatch (Apple notes IAP metadata can take up to ~1 hour to
appear in Sandbox).

## 11. Sandbox / TestFlight readiness — measured where possible

| Prerequisite | State |
|---|---|
| ASC app record | exists — `BTY Norebang` (26J, Founder-attested) |
| TestFlight build | **build 88 uploaded, processed, installed** (26J, Founder-attested) |
| Current native build | 95, local only — **not** uploaded to TestFlight |
| IAP products in ASC | **NONE** — this build created none |
| Sandbox Apple Account | **UNKNOWN** — not readable without ASC access |
| Device Developer Mode | required for development-signed Sandbox testing on iOS 16+ |
| Distribution signing on this machine | **0 distribution certs**; only `Apple Development: Hanbit Chi`. The Founder is the distribution operator (26J) |
| Can products be queried by StoreKit? | **No** — no ASC product exists and no native StoreKit code exists |
| First-IAP App Review | requires a **new app version** submitted together with the IAP — future release dependency |
| Review screenshot / notes | not yet prepared |

Apps installed via TestFlight transact in the **Sandbox** environment, and Sandbox purchases use
real App Store infrastructure without charging the tester. BUILD 26P already accepts `Sandbox` and
`Production` as distinct authorities and records `(environment, apple_transaction_id)` accordingly.

## 12. Production census — before and after

```
before   Apple purchases 0 · paid grants 0 · catalog 3 · is_active=true 0 · grants 55 · audit 155
after    Apple purchases 0 · paid grants 0 · catalog 3 · is_active=true 0 · grants 55 · audit 155
```

**BUILD 26Q performed zero mutations of any kind** — no ASC change, no database write, no
deployment, no migration, no native change, no session touch. Every production interaction was a
read.

## 13. Deferred

- **ASC IAP product creation** (this build's blocked objective)
- FD-14 pricing, base region, availability, customer-facing metadata
- Paid Apps Agreement confirmation
- Sandbox tester account provisioning
- native StoreKit product discovery and purchase (**BUILD 26R**)
- paid transaction → paid Pass issuance, and its atomic RPC/migration
- `Transaction.finish()` fulfilment contract
- App Store Server Notifications V2, refunds, reconciliation
- first-IAP App Review submission bundled with a new app version
- BUILD 26O REVOKED audit actor provenance · BUILD 18C G4/G6/G7 · legacy RPC wrapper removal

## 14. BUILD 26P contract remains authoritative

```
VERIFY + DURABLY RECORD
VERIFIED / NOT_GRANTED · pass_grant_id NULL · granted_seconds NULL
```

A verified JWS alone is **not** fulfilment. Future native code must not call
`Transaction.finish()` merely because verification succeeded — finish authority must be tied to
durable server-side fulfilment, which does not exist yet.

## 15. What this build should be remembered for

- **An ambiguity must not become an immutable artifact.** Product ID and purchase type cannot be
  edited after creation, so "probably $1.99" is not a price — it is a permanent mistake waiting for
  a customer to pay for it.
- **Two documents can both be authoritative and still disagree.** 18C closed with prices; Track B0
  later listed those same prices as an open decision. Reporting the conflict is the work; picking a
  side quietly would have been the failure.
- **Access was checked before the plan, not after.** No ASC credentials exist in this environment,
  and finding that first meant the build produced a complete decision package instead of a
  half-executed creation.
