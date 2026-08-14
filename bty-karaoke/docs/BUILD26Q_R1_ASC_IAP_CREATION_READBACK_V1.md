# BUILD 26Q-R1 — ASC IAP Creation & Read-Back

**Status: PASS / CLOSED — 2026-08-13**

BUILD 26Q stopped at `BLOCKED / FOUNDER DECISION REQUIRED` rather than turn an ambiguity into a
permanent Apple artifact. The Founder has since resolved every blocker and created the three
In-App Purchase products by hand in App Store Connect. This slice records that, verifies the parts
that are machine-verifiable, and closes.

> **Evidence boundary, stated once and honoured throughout.** This environment has **no App Store
> Connect API access** — proven in BUILD 26Q §5 and unchanged. **No ASC read-back was performed by
> repository tooling.** Every ASC fact below is **Founder-attested live ASC UI evidence**. What
> *was* machine-verified is the server side: the Product IDs, durations, product kind, inactive
> state and production census.

---

## 1. Verdict

`PASS / CLOSED`

The BUILD 26Q blockers are resolved, the three ASC products exist by Founder-attested evidence,
and every Product ID matches server authority **byte-for-byte**. No entitlement was activated and
no code changed.

## 2. Prior blocker resolution

The history stays visible — 26Q's stop was correct, not an obstacle to route around:

```
BUILD 26Q     -> BLOCKED / FOUNDER DECISION REQUIRED
                 B-1 no ASC access from this environment  (environmental, still true)
                 B-2 FD-14 launch pricing never ratified   (decision)
                 -> NO ASC product created

Founder       -> resolves D-1 … D-6, creates the products manually in the ASC UI

BUILD 26Q-R1  -> creation / read-back closure  (this document)
```

| Decision | Resolution |
|---|---|
| **D-1** launch prices | **$1.99 / $4.99 / $9.99 USD** — ratified |
| **D-2** base country/region | **United States (USD)** |
| **D-3** availability | **All 175 App Store countries or regions** |
| **D-4** names / descriptions | ratified per §6 (EN + KO) |
| **D-5** Paid Apps Agreement | **Active** — see §5 |
| **D-6** creation authority | **Founder, manually, via the ASC UI.** No ASC API key was added, and none was requested. |

**B-1 was not solved — it was routed around by the Founder acting as the ASC operator.** This
environment still has no ASC access.

## 3. Repository baseline — MEASURED

```
before R1   HEAD = origin/main = 5e78a9d98f2a2ace78e33c2e69798bdc58fab715   (0 0)   ✅ 26Q closure
native      a131d600071927cdedce894cafd58ce0762fa5a2 · CFBundleVersion 95 · MARKETING_VERSION 1.0
deployed    live build 2a3e88d70c2f · Worker 02baaf8a-e234-4e2c-b5e0-9d5f270fb174 · unchanged
```

Preserved untouched, never staged or cleaned: `M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md`,
`?? bty-karaoke/brand/`, `?? bty-karaoke/docs/TRACK_B0…md`, ~380 unrelated Arena/Foundry paths, and
the native xcscheme rig.

## 4. Founder-ratified decisions

Launch prices **$1.99 / $4.99 / $9.99 USD**, base country **United States (USD)**, availability
**all 175 countries or regions**, purchase type **Consumable** (already frozen in 26Q from measured
BTY timed-pass semantics — not re-derived here).

Apple may adjust comparable storefront prices outside the base country automatically. **Those
derived prices are not part of this contract and are never server authority.**

## 5. Paid Apps Agreement — Founder-attested live ASC UI

```
Paid Apps Agreement   Active
effective             Aug 5, 2026 – Jun 23, 2027
coverage              All Countries or Regions
bank account          Active
U.S. Form W-9         Active
```

**Founder-attested from the ASC Business/Agreements screen.** Repository tooling did not
authenticate to ASC and did not read this.

## 6. The three ASC products — Founder-attested live ASC UI

| | PASS_1H | PASS_4H | PASS_24H |
|---|---|---|---|
| Product ID | `com.btydaily.norebang.pass.1hour` | `com.btydaily.norebang.pass.4hour` | `com.btydaily.norebang.pass.24hour` |
| Type | Consumable | Consumable | Consumable |
| Reference name | BTY Norebang 1-Hour Pass | BTY Norebang 4-Hour Pass | BTY Norebang 24-Hour Pass |
| Base country | United States (USD) | United States (USD) | United States (USD) |
| US price | **$1.99** | **$4.99** | **$9.99** |
| Availability | all 175 | all 175 | all 175 |
| EN display name | BTY Norebang 1-Hour Pass | BTY Norebang 4-Hour Pass | BTY Norebang 24-Hour Pass |
| EN description | Adds one 1-hour karaoke pass | Adds one 4-hour karaoke pass | Adds one 24-hour karaoke pass |
| KO display name | BTY 노래방 1시간 패스 | BTY 노래방 4시간 패스 | BTY 노래방 24시간 패스 |
| KO description | 1시간 노래방 패스 1개를 추가합니다 | 4시간 노래방 패스 1개를 추가합니다 | 24시간 노래방 패스 1개를 추가합니다 |
| ASC Apple ID | **`6801210530`** (attested for PASS_1H) | not recorded | not recorded |
| ASC status | Prepare for Submission | (attested created + saved) | (attested created + saved) |

**Price read-back:** for PASS_4H and PASS_24H the Founder saved the product and read the value back
from the ASC **Current Price** table, which showed `United States (USD) — $4.99` and
`United States (USD) — $9.99` respectively.

Recorded precisely rather than tidied: the **Apple ID `6801210530`** and the explicit
`Prepare for Submission` status were attested for **PASS_1H only**. The other two are attested as
created and saved with the fields above; their Apple IDs and status strings were not captured, and
are therefore **not claimed here**.

Incidental foreign-storefront prices visible in the ASC price table are deliberately **not**
transcribed — Apple's comparable pricing is presentation, never our contract.

## 7. Evidence taxonomy

| Class | What it covers |
|---|---|
| **Repository-measured** | migration `20260811120000` seed; runtime lookup path; native source reads; staged-file scope |
| **Production DB-measured** | live `karaoke_product_catalog`; commerce census; migration parity |
| **Founder-attested live ASC UI** | Paid Apps Agreement; all three product creations; prices; localizations; availability; Apple ID `6801210530`; `Prepare for Submission`; first-consumable warning |
| **Founder-ratified decision** | D-1 … D-6 |

**No ASC API read-back occurred.** No statement in this document should be read as automated ASC
access.

## 8. Server product parity — MEASURED, byte-for-byte

The Founder-attested ASC Product IDs were compared against production by length and MD5, not by eye:

```
MATCH  com.btydaily.norebang.pass.1hour    len 32  md5 92cefeb8f51e…
MATCH  com.btydaily.norebang.pass.4hour    len 32  md5 f271cc892ddc…
MATCH  com.btydaily.norebang.pass.24hour   len 33  md5 5fe8fe27f72f…
ALL THREE BYTE-IDENTICAL: True
```

Server contract re-measured in production and unchanged:

| | duration | kind | is_paid | **is_active** | contract_version |
|---|--:|---|---|---|---|
| PASS_1H | 3600 | PAID_CONSUMABLE | true | **false** | BUILD_18C_V1 |
| PASS_4H | 14400 | PAID_CONSUMABLE | true | **false** | BUILD_18C_V1 |
| PASS_24H | 86400 | PAID_CONSUMABLE | true | **false** | BUILD_18C_V1 |

**No mapping layer exists or was introduced.** The only two references to the column in server
source remain `apple-purchase-ledger.server.ts:71` (writes the verified `productId`) and `:168`
(`.eq('storekit_product_id', storekitProductId)`), so a verified Apple JWS `productId` still
resolves *directly* against the catalog. This is exactly why byte-equality matters: a single
character of drift would make every genuine purchase fail `unknown_product` (422).

## 9. Production commerce census — READ ONLY

| | 26Q baseline | now |
|---|--:|--:|
| Apple purchases | 0 | **0** |
| Paid grants | 0 | **0** |
| Catalog rows | 3 | **3** |
| Catalog `is_active=true` | 0 | **0** |
| All grants | 55 | **55** |
| Audit rows | 155 | **155** |

Every critical commerce invariant holds, and the global grant/audit counts are unchanged too — no
unrelated external activity to explain. Measured by read-only SQL; **no authenticated smoke, so no
session `last_used_at` was touched.**

## 10. Mutation statement

**BUILD 26Q-R1 performed zero mutations.** No ASC change by this environment, no database write, no
schema change, no deployment, no native change, no session touch. Every production interaction was
a read. Migration parity remains `20260815120000`.

The only mutation anywhere in this slice was the **Founder's manual ASC product creation**, which
is external to both repositories and to production.

## 11. Operational boundary — unchanged

BUILD 26P remains authoritative:

```
VERIFY + DURABLY RECORD
VERIFIED / NOT_GRANTED · pass_grant_id NULL · granted_seconds NULL
```

And the distinction that matters most now that real products exist:

```
ASC product exists
  ≠ server product operationally active
  ≠ entitlement granted
  ≠ Transaction.finish() authorized
```

`karaoke_product_catalog.is_active` remains **false** on all three. Per BUILD 26L §5, `true` would
mean the server is operationally authorized to turn a **new paid transaction** into entitlement
processing — and it is not, because no fulfilment path exists yet. A verified JWS alone is still
not fulfilment.

## 12. Review / submission boundary

**No product was submitted for App Review in this slice.** No `Add for Review`, no new App Store
version, no build upload, no submission. PASS_1H's attested status is `Prepare for Submission`,
which is the state a created-but-unsubmitted IAP sits in — not a submission.

The ASC UI displayed the **first-consumable warning**: the first consumable IAP must be submitted
**together with a new app version**. Recorded as a **future App Review / release dependency**, not
entered here.

## 13. Sandbox / TestFlight readiness

| Prerequisite | State | Class |
|---|---|---|
| ASC app record | exists (`BTY Norebang`) | 26J Founder-attested |
| Paid Apps Agreement | **Active** | Founder-attested (§5) |
| Three ASC IAP products | **exist**, Consumable, priced, EN+KO localized | Founder-attested (§6) |
| TestFlight build | build **88** uploaded/processed/installed | 26J Founder-attested |
| Current native build | **95**, MARKETING_VERSION 1.0 — **local only**, not uploaded | Repository-measured |
| `import StoreKit` in app source | **0 hits** | Repository-measured |
| `Product.products(for:)` | **0 hits — not implemented** | Repository-measured |
| Product IDs embedded natively | **0 hits** | Repository-measured |
| `.storekit` configuration file | **none** | Repository-measured |
| App entitlements | only `applesignin` + `associated-domains`; **no IAP key** | Repository-measured |
| IAP capability on the App ID | **not readable here** — lives in the developer portal / ASC | UNKNOWN |
| Sandbox Apple Account | **UNKNOWN / deferred** — no evidence in any doc or config | not manufactured |

Apps installed via TestFlight transact in the **Sandbox** environment. BUILD 26P already treats
`Sandbox` and `Production` as distinct authorities and keys the ledger on
`(environment, apple_transaction_id)`, so a Sandbox purchase is representable the moment one exists.

## 14. Deferred

- **Sandbox Apple Account provisioning** (unknown; required before any Sandbox purchase)
- IAP capability confirmation on the App ID (developer portal)
- **BUILD 26R** — native StoreKit product discovery + purchase transaction acquisition
- the deferred BUILD 26P **genuine Apple transaction** proof (arrives via 26R's Sandbox flow)
- paid transaction → paid Pass issuance, and its atomic server fulfilment contract + migration
- `Transaction.finish()` fulfilment authority
- server catalog activation (`is_active = true`)
- first-IAP App Review submission bundled with a new app version
- App Store Server Notifications V2, refunds, reconciliation
- BUILD 26O REVOKED audit actor provenance · BUILD 18C G4/G6/G7 · legacy RPC wrapper removal

## 15. Closure statement

BUILD 26Q-R1 is `PASS / CLOSED`. The commercial contract is frozen and real: three Consumable
products exist in App Store Connect at $1.99 / $4.99 / $9.99 USD, based in the United States,
available in all 175 countries or regions, localized in English and Korean, with Product IDs that
are byte-identical to server authority. Nothing about entitlement changed — the catalog remains
inactive, the Apple purchase ledger remains empty, and no fulfilment path exists yet.

**Next: BUILD 26R — Native StoreKit Product Discovery + Purchase Transaction Acquisition.**

## 16. What this pair of builds should be remembered for

- **26Q's block was the valuable output.** Product ID and purchase type are immutable, so stopping
  at an unratified price was cheaper than a permanent artifact carrying a guessed one. The build
  that produced no ASC product is the reason this one could produce three correct ones.
- **Byte-equality is not pedantry here.** The verified Apple `productId` resolves directly against
  `storekit_product_id` with no mapping layer, so one wrong character would fail every genuine
  purchase with `unknown_product` — which is why the IDs were compared by MD5, not by reading them.
- **Attestation is evidence, but only when labelled.** This environment cannot see ASC. Recording
  the Founder's UI evidence as exactly that — and refusing to claim an Apple ID or status for the
  two products where it was not captured — keeps the record worth trusting.
- **Real products still grant nothing.** The most likely future mistake is reading "the IAPs exist"
  as "we can sell," so §11 states the four-way distinction explicitly.
