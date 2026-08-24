
---

## BUILD 26U-R4B-R1 — the first controlled Sandbox purchase (2026-08-24)

One tap, on physical device build 1.0 (114) Debug, against production at
`premium_room_mode = dual_allowlist` with PASS_1H the only active product.

**The new grant: `98f52997`** — PAID, `is_paid=true`, AVAILABLE, 3600s, carryover 0,
`selected_at` / `activated_at` / `expires_at` all NULL, created `2026-08-24T02:17:50.772635Z`,
after the `2026-08-23T21:34:01.255Z` baseline. It is not `006bc34f`.

Identified by SET DIFFERENCE against 26 grant ids persisted to disk before the tap — not by
duration, not by name, and not by recency. Exactly one id appeared.

| | before | after | delta |
|---|---|---|---|
| Apple purchases | 1 | 2 | +1 |
| Sandbox purchases | 1 | 2 | +1 |
| grants | 56 | 57 | +1 |
| paid grants | 1 | 2 | +1 |
| audit | 157 | 158 | +1 |
| **ACTIVATED-shaped audit** | 30 | 30 | **+0** |

The audit +1 is `ISSUED -> AVAILABLE` on the new grant. **The purchase did not start Room
time**, which is the whole point of the +0: buying is not activating.

Transaction evidence: environment Sandbox, `com.btydaily.norebang.pass.1hour`, quantity 1,
`STOREKIT_CLIENT`, verification VERIFIED on attempt 1 with no failure reason, grant GRANTED
for 3600s, never refunded or revoked. The JWS is 3 base64url segments, header `ES256` with a
3-certificate `x5c` chain, and its stored SHA-256 equals a digest RECOMPUTED from the stored
payload — the 26R-R2 rule: verify the digest against what was kept, not against what arrived.

`appAccountToken` binding: the purchase row's `purchase_owner_ref` equals
`karaoke_accounts.purchase_owner_ref` for the controlled account. The verify route re-reads
that same column server-side and compares, so the device's echo is never the authority.

Linkage is 1:1 in both directions — one purchase row for this transaction id, one grant
pointing at that purchase, one purchase pointing back at that grant.

Nothing else moved. Of the 26 baseline grants, **zero** have an `updated_at` after the
pre-purchase read. `006bc34f` — the 26S-R1 paid grant — is still AVAILABLE and unstarted,
last touched 2026-08-14. The 14 AVAILABLE promotional grants are all still unstarted. The
6 REVOKED and 5 EXPIRED members of the baseline were already in that state before the tap.
The controlled room still holds 0 events, 0 draft, 0 active.

Containment unchanged: `dual_allowlist`, one allowlisted pair, PASS_1H true / 4H false /
24H false.

STOPPED before selection. `Transaction.finish` is a client-side fact and is not visible in
any of the above; it is proven separately through the existing `-BTYPassFinishGate` harness
already present in build 114.
