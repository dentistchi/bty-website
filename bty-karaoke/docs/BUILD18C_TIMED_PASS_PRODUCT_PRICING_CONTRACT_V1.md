# BUILD 18C — Timed Pass Product & Pricing Contract V1

**Status:** `CONTRACT PASS / CLOSED` (Commander-approved)
**Scope:** commercial + lifecycle contract ONLY. No StoreKit code, no migration, no production mutation, no deploy.
**Isolated project:** bty-karaoke Supabase (ref `zycwaqignioawtqynopj`).
**Foundation:** BUILD 17 Timed Access Pass (`supabase/migrations/20260728120000_karaoke_timed_access_passes.sql`).
**Ship baseline at authoring:** commit `9c4e0e27`, Worker `5c29093c-768d-4a63-95d3-1f03eed94955`.

> **Terminology binding (authoritative):**
> ```text
> Product contract term:        ARMED
> Current physical DB status:    SELECTED
> Meaning:                       equivalent in V1
> ```
> The physical DB status name is **NOT** changed now. BUILD 22 re-evaluates whether a rename migration is worth its risk. Wherever this document says ARMED, the deployed schema means `SELECTED`.

---

## 1. Products and Pricing

Time-based party passes (not an unlimited subscription). US launch prices are App Store Connect base-market **launch decisions V1** — reviewable after the first 100 verified paid activations (metrics: product-page conversion, purchase completion, activation rate, repeat purchase, refund rate, 1h→4h upgrade behavior, 24h purchase frequency). **No price A/B testing in V1.**

### Paid catalog (StoreKit type: **Consumable**)

| Product | US launch price | Duration | Positioning |
|---|--:|--:|---|
| 1-Hour Pass | $1.99 | 60 min (3,600 s) | 짧은 모임 |
| 4-Hour Party Pass | $4.99 | 240 min (14,400 s) | 주력 상품 |
| 24-Hour Event Pass | $9.99 | 1,440 min (86,400 s) | 하루 행사 |

- **Consumable** is correct: each Pass is a single-Event, single-activation entitlement stored server-side, not restorable/renewing.
- Purchase UI displays the **localized StoreKit storefront price**. `$1.99 / $4.99 / $9.99` are never hardcoded into production purchase UI.
- The BTY server ledger — **not** StoreKit `currentEntitlements` — is the source of truth for stored (unused) consumables.

### Promotional catalog (BTY server grants — NOT StoreKit products, NOT StoreKit transactions)

| Product | Price | Duration | Unactivated expiry | Grant source |
|---|--:|--:|--:|---|
| Welcome Party Pass | $0 | 60 min | 30 days after grant | `WELCOME` |
| Referral Reward Pass | $0 | 60 min | 90 days after grant | `REFERRAL` |

Promotional Passes must stay distinguishable from paid purchases across data model, audit, UI, analytics, and refund logic, and must contain **no** Apple transaction identity.

**Offer Codes:** NOT used for Welcome/Referral V1 (they need BTY account eligibility + milestone verification, so they remain server grants). Apple Offer Codes are reserved for a future marketing BUILD.

## 2. Immutable StoreKit Product IDs

```text
com.btydaily.norebang.pass.1hour
com.btydaily.norebang.pass.4hour
com.btydaily.norebang.pass.24hour
```

Proposed App Store display names:

```text
1-Hour Karaoke Pass
4-Hour Party Pass
24-Hour Event Pass
```

## 3. Paid vs Promotional Separation

| Axis | Paid | Promotional |
|---|---|---|
| Origin | verified Apple transaction | BTY server grant (`WELCOME` / `REFERRAL` / `MANUAL_PROMOTIONAL`) |
| StoreKit product | yes | none |
| Apple transaction ID | present, unique | **never** |
| Unactivated expiry | none (never expires before activation) | 30d (Welcome) / 90d (Referral) |
| Refund path | Apple refund → REVOKED / refunded | not applicable |
| Measurability | independent | independent |

Paid and promotional economics must remain **independently measurable**. A stored paid Pass is **never** silently consumed or auto-selected.

## 4. Lifecycle

```
AVAILABLE ──arm (host selects for ONE Event)──▶ ARMED (=SELECTED) ──1st server-confirmed song start──▶ ACTIVE
    ▲                                              │                                                     │
    └──── event closed / host cancels ────────────┘                                  wall-clock ≥ expires_at
          (before first successful playback)                                                            ▼
                                                                                                     EXPIRED
 REVOKED  ◀── refund / revocation from AVAILABLE|ARMED (never activated)
 ACTIVE|EXPIRED + verified refund ──▶ retain history, mark refunded/revoked   [optional report class: REFUNDED_AFTER_USE]
```

- **AVAILABLE** — validly purchased or granted; selectable.
- **ARMED** (physical `SELECTED`) — host explicitly selected the Pass for one Event; **timer not started**. Reverts to AVAILABLE if the Event closes or the host cancels before the first successful playback. At most one Event holds a given Pass in ARMED/ACTIVE.
- **ACTIVE** — set **only** by the server-confirmed first successful playback lifecycle start.
- **EXPIRED** — reached `expires_at` (server wall-clock).
- **REVOKED** — verified refund / revocation / fraud / admin invalidation from a never-activated state.

Only one ARMED and one ACTIVE Pass per account. An ACTIVE Pass cannot return to AVAILABLE. Remaining time is non-transferable, non-combinable, non-splittable.

## 5. Activation (first successful song start)

Activation boundary:

```text
confirmed successful playback lifecycle start
```

The server-confirmed first successful song start sets:

```text
activated_at  = server clock at the committed waiting→playing transition
expires_at    = activated_at + product duration   (fixed forever; no extension)
```

**These do NOT activate a Pass:** opening a Room, creating an Event, entering the Queue, searching, adding a song, pressing Play when the server rejects the start, failed YouTube handoff, client-only optimistic UI, app relaunch, background refresh.

Arming screen must state: **"Your time starts when the first song successfully begins."**

Elapsed time is **continuous server wall-clock** once ACTIVE. The clock does not pause for: paused music, empty queue, app backgrounding, force quit, device shutdown, network loss, no guests, or host leaving/returning. Client time can never extend a Pass.

## 6. FREE fallback

Existing FREE policy is unchanged and remains authoritative for its own domain:

```text
15 minutes per day (900 s) · meter actual playback only · reset at 4:00 AM local policy time
```

While a Pass is ACTIVE: pass time governs access; FREE daily seconds do not decrement; no FREE warnings; no FREE 0:00 block until the Pass expires.

When the Pass expires:

```text
active Pass expires
→ use remaining FREE daily allowance if eligible
→ otherwise BLOCK the next playback start (Event + Queue remain intact)
→ host may explicitly select another Pass
→ the next confirmed successful playback activates that Pass
```

No stored paid Pass is auto-activated. **No FREE-policy implementation change belongs in BUILD 18C.**

## 7. Refund handling (before and after activation)

**Before activation** (AVAILABLE or ARMED):
```text
refund verified → REVOKED   (if ARMED, release the Event reservation; the Pass cannot activate afterward)
```

**After activation** (ACTIVE or EXPIRED):
```text
refund verified → retain all historical usage → mark refunded/revoked
```
Never delete playback / Event / purchase / activation history. If the refunded Pass is still ACTIVE, enforcement recognizes revocation at the **next authoritative server check** and prevents further paid playback. **Do not fabricate negative remaining time.**

**Pending / cancelled / failed / unverified transaction:** creates **no** Pass.
**Duplicate refund notification:** idempotent — one refunded transaction → one canonical revocation.

## 8. Economic events (purchase ≠ activation)

```text
PURCHASE_STARTED · PURCHASE_VERIFIED · PASS_GRANTED · PASS_ARMED · PASS_ACTIVATED · PASS_EXPIRED · REFUND_RECEIVED · PASS_REVOKED
```

Purchase completion is never activation; activation is never proof of purchase. A purchase may remain AVAILABLE for a long period before activation.

**Purchase uniqueness:** `Apple transaction ID → at most one paid Pass grant`. Duplicate delivery, retry, relaunch, notification replay, or repeated verification returns the existing canonical result — never a second Pass.

**Required linkage per paid grant:** canonical account ID, StoreKit product ID, Apple transaction ID, original transaction info (when supplied), app transaction ID (when supplied), storefront/environment, verified purchase time, quantity, grant record, raw signed-transaction reference / verification evidence, audit event.

**Account ownership:** purchasing, storing, arming, activating requires a canonical signed-in Host account. A Pass belongs to the canonical account — not a device, installation, Room, Apple login session, or Guest session. It links to a Room+Event only when ARMED/ACTIVE, and is reachable after reinstall / login on another authorized device.

## 9. Existing schema fit

Deployed (migration `20260728120000`): `timed_access_pass_grants`, append-only `timed_access_pass_audit` (immutable trigger; unique one-`ACTIVATED`-per-pass), pass-aware `karaoke_begin_song` RPC, `karaoke_event_usage_segments.{pass_grant_id, metering_paused_by_pass}`.

**Live state at authoring:** 5 grants, **all `issued_by_manager='bty_mgr'`** (100% promotional/manual, **0 paid**); statuses 3 EXPIRED / 1 AVAILABLE / 1 ACTIVE; audit 24 rows (ISSUED/SELECTED/DESELECTED/ACTIVATED/EXPIRED); 4 accounts; FREE `enforcement_enabled=true`, `free_limit_seconds=900`, reset hour 4.

**Already satisfied (no change needed):**

| Contract requirement | Deployed reality |
|---|---|
| Activation only at confirmed first playback | `karaoke_begin_song` flips SELECTED→ACTIVE only on committed `waiting→playing`; one ACTIVATED audit (unique idx) |
| `expires_at = activated_at + duration`, no extension | `timed_pass_expiry_math_chk` |
| Pass belongs to canonical account | FK `account_id → karaoke_accounts`; Room→account via `karaoke_room_owner_account` |
| Append-only, no destructive overwrite | immutable audit trigger; EXPIRED rows retain timestamps |
| Durations 3600 / 14400 / 86400 fixed to type | `timed_pass_duration_matches_type` |
| FREE meter pause vs pass authority | non-metered pass segments; resolver PRO→TIMED_ACCESS→FREE; enforcement live |
| Issue/select/revoke idempotency + replay | `issue_idempotency_key` unique; RPC replay guards |
| One ARMED + one ACTIVE per account | two partial unique indexes |

## 10. G1–G7 — additive migration requirements (BUILD 22)

All additive; live state has **0 paid rows**, so no conflation risk. Only G5 needs a CHECK-constraint relaxation on an existing table (write it to leave every existing row valid).

| # | Gap | Fix (additive) |
|---|---|---|
| G1 | No paid/promo distinction (no `source_type`/`is_paid`) | Add `source_type ∈ {PAID, WELCOME, REFERRAL, MANUAL_PROMOTIONAL}` + `is_paid`; backfill existing 5 rows → `MANUAL_PROMOTIONAL` |
| G2 | No purchase record / Apple identity / uniqueness | New `purchase` table (account, storekit_product_id, apple_transaction_id, original/app txn, environment, verification_status, verified/refunded_at, signed-txn evidence) + **UNIQUE(apple_transaction_id)**; add `apple_transaction_id` / `promotional_grant_id` on grant |
| G3 | No product catalog / StoreKit product_id map | New catalog (product_code ↔ storekit_product_id ↔ duration ↔ kind ↔ is_paid ↔ is_active ↔ display_order ↔ contract_version) |
| G4 | ARMED is account-scoped only; grant has no `room_id`/`event_id`; §4 event reservation + auto-revert-on-event-close not modeled | Add nullable `room_id`/`event_id` set on ARM, cleared on revert; add event-close→revert logic |
| G5 | **Refund-after-use unrepresentable** — `timed_pass_status_time_chk` forbids REVOKED from ACTIVE/EXPIRED; REVOKE RPC refuses ACTIVE/EXPIRED; no `REFUNDED_AFTER_USE` | Relax the status/time CHECK (non-destructively) + add `REFUNDED_AFTER_USE` classification + "revocation recognized at next authoritative server check, no fabricated negative time" |
| G6 | Promo unactivated expiry not modeled (`AVAILABLE` never auto-expires) | Add `expires_unactivated_at` (Welcome 30d / Referral 90d); block arm/activate past it |
| G7 | No promo grant taxonomy / eligibility versioning | Add grant_type + eligibility_rule_version + source/referral linkage (promo idempotency separate from `issue_idempotency_key`) |

**Minimum logical data model** (contract, not authorization to create tables now):

- **Product catalog:** product_code, storekit_product_id, duration_seconds, product_kind, is_paid, is_active, display_order, contract_version.
- **Pass entitlement:** pass_id, canonical_account_id, product_code, source_type, state, duration_seconds, granted_at, expires_unactivated_at, armed_at, activated_at, expires_at, revoked_at, room_id, event_id, apple_transaction_id, promotional_grant_id.
- **Purchase record:** purchase_id, canonical_account_id, storekit_product_id, apple_transaction_id, environment, purchase_date, verification_status, verified_at, refunded_at, revocation_reason.
- **Append-only audit:** audit_id, pass_id, account_id, event_type, from_state, to_state, reason, idempotency_key, created_at, metadata.

## 11. BUILD 22 prerequisites (StoreKit implementation)

App Store Connect consumables created under the three product IDs; G1–G7 additive migration applied (audited, non-destructive); server-side Apple transaction verification (signed JWS) with `apple_transaction_id` uniqueness; refund/revocation via App Store Server Notifications V2, idempotent (one refunded txn → one revocation); localized-price purchase UI (no hardcoded prices).

## 12. BUILD 23 prerequisites (promotional implementation)

**Welcome (reserved):** `verified new app user + new eligible canonical account + no prior Welcome grant → one 1-hour Welcome Pass`. V1 defines only: ≤1 Welcome per eligible identity, 30-day unactivated expiry, no cash value, no transfer, no conversion to paid, no referral reward from Welcome activation. Final anti-abuse = BUILD 23.

**Referral (reserved):** reward trigger = `FIRST_VERIFIED_PAID_PASS_ACTIVATED` of the referred user → grant one 1-hour Referral Pass to the eligible referrer. **No** reward for install, account creation, Welcome grant/activation, song request, unactivated paid purchase, pending/unverified purchase, or refunded-before-activation purchase. Attribution, reversal, identity policy = BUILD 23.

## 13. Required invariants

1. One verified Apple transaction → at most one paid Pass.
2. One promotional eligibility event → at most one promotional Pass.
3. Purchase does not activate a Pass.
4. Event creation does not activate a Pass.
5. Only confirmed successful first playback activates an ARMED Pass.
6. One Pass cannot be active in two Events.
7. An ACTIVE Pass cannot return to AVAILABLE.
8. Expiration uses authoritative server time.
9. Client time cannot extend a Pass.
10. App reinstall cannot duplicate a Welcome Pass.
11. Transaction replay cannot duplicate a paid Pass.
12. Refund replay cannot duplicate a revocation.
13. Promotional Passes contain no Apple transaction identity.
14. Paid and promotional economics remain independently measurable.
15. No stored paid Pass is silently consumed.
16. Existing FREE playback enforcement remains intact.

## 14. Future Commander test matrix (for BUILD 22 / 23 implementation gates)

- purchase-verified → AVAILABLE (not active).
- relaunch / notification replay → no duplicate paid grant.
- ARM → event close → back to AVAILABLE.
- first successful playback → ACTIVE + `expires_at` set correctly.
- expiry mid-Event → FREE fallback → block when FREE zero; Event + Queue intact.
- refund before activation → REVOKED; ARMED reservation released.
- refund after activation → history retained; next authoritative check blocks; no negative time.
- Welcome reinstall → no duplicate Welcome.
- promotional Pass carries no Apple transaction ID.
- FREE enforcement regression intact.

---

*BUILD 18C contract only. No StoreKit, no App Store Connect products, no migration, no production mutation, no deploy, no grants, no pricing UI were produced by this BUILD.*
