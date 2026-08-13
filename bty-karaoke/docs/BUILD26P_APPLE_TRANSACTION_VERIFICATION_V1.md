# BUILD 26P — Apple Transaction Verification Endpoint (Track B Slice 3)

**Status: PASS / CLOSED — 2026-08-13**

The server can now prove that an Apple StoreKit transaction is genuine, and durably record it —
without granting anything. Verification and entitlement are deliberately two different builds, and
this is the first one.

> **A genuine Apple-signed StoreKit transaction JWS has NOT been verified.** That gate is
> **DEFERRED, not passed** — see §15. Its prerequisites (an App Store Connect IAP product and a
> native StoreKit purchase path) do not exist yet, so no amount of server work could have produced
> one. What *is* proven, including against **real Apple certificates**, is in §4 and §10.

---

## 1. Final verdict

`PASS / CLOSED`

The authorized Slice 3 scope — a server-side Apple transaction verification endpoint with durable
purchase recording and **no** entitlement issuance — is implemented, cryptographically hardened,
fixture-tested, real-Apple-chain tested, workerd tested, Postgres-concurrency tested,
regression-tested, pushed, deployed, live-identity verified, and production-smoked without any
persistent mutation.

## 2. Build history

```
BUILD 26O   PASS / CLOSED            d9fd668289f062405bb84c171af65fb0b730aab6

BUILD 26P   R1    35efc077b27441305c77e749344fc492c4cd28a5   implementation
            R1.1  0f1dc36ffef086514f2763e576f707d641bafcd4   security parity
            R1.2  2a3e88d70c2f511e874880594776dd9fa1dca237   trust roots + real chain

HEAD = origin/main = 2a3e88d70c2f511e874880594776dd9fa1dca237
production build   = 2a3e88d70c2f
Worker version     = 02baaf8a-e234-4e2c-b5e0-9d5f270fb174   (100% traffic)
deployed           = 2026-08-13T15:48:37.328Z
migration          = NONE. Production remains at 20260815120000 (BUILD 26O).
native             = a131d600071927cdedce894cafd58ce0762fa5a2, build 95 — untouched
```

The three implementation commits were pushed **without squash, amend, force or rebase**. Two of
them are corrections found in Founder review; keeping them separate is the point (§16).

## 3. The contract

```
POST /api/host/purchases/apple/verify
```

**VERIFY + DURABLY RECORD. It does NOT issue paid entitlement.**

An accepted transaction is recorded as:

```
verification_status = VERIFIED
grant_status        = NOT_GRANTED
pass_grant_id       = NULL
granted_seconds     = NULL
```

This is exactly the shape BUILD 26L's `grant_linkage_chk` was built to allow, and what BUILD 18C
invariant #3 — *"Purchase does not activate a Pass"* — requires.

**No response means fulfilment.** In particular, **no response authorizes future native code to
call `Transaction.finish()`**. Finishing a transaction destroys the customer's only re-presentable
evidence of a purchase they paid for, so that boundary belongs to the entitlement slice and is
pinned by a test here so no future reader can infer otherwise.

## 4. Server-authoritative trust boundary

The request body accepts exactly one field:

```json
{ "signedTransaction": "<compact Apple JWS>" }
```

`.strict()` rejects everything else. The client is **not** the authority for `accountId`,
`transactionId`, `originalTransactionId`, `productId`, `bundleId`, `environment`,
`appAccountToken`, `purchaseDate`, `quantity`, revocation state, or transaction type — none of
those is accepted at all, so there is no precedence rule to get wrong. Every Apple fact comes from
the cryptographically verified payload; account identity comes only from the authenticated Host
session.

## 5. Apple verification security model

Aligned with Apple's `SignedDataVerifier` in **`enableOnlineChecks = false`** mode. Enforced, in
order, with nothing readable before it has been earned:

```
compact JWS structure
x5c length EXACTLY 3
alg PINNED to ES256              (never `none`, never a substituted alg)
server-controlled trust roots ONLY — a root inside x5c[2] is never even parsed
effective date = the transaction's signedDate
intermediate signed by a trusted Apple root  + issuer/subject linkage
leaf signed by that intermediate             + issuer/subject linkage
validity windows for leaf, intermediate AND root, at signedDate
intermediate BasicConstraints CA = true
leaf Apple purpose OID          1.2.840.113635.100.6.11.1
intermediate Apple purpose OID  1.2.840.113635.100.6.2.1
JWS signature under the verified leaf public key
bundleId + environment, read only AFTER all of the above
```

**Trusted roots — Apple's documented set**, obtained from Apple over TLS, pinned by value with a
SHA-256 the tests re-derive from the PEM:

| Root | Key | SHA-256 |
|---|---|---|
| Apple Inc. Root | RSA 2048 | `b0b1730e…f024` |
| Apple Root CA - G2 | RSA 4096 | `c2b9b042…a050` |
| Apple Root CA - G3 | ECDSA P-384 | `63343abf…9179` |

G3 is byte-identical (583 bytes) to the root in Apple's own `app-store-server-library-node` test
suite — verified, not assumed.

**Offline contract:** no OCSP, no App Store Server API call, no Apple private key, no issuer ID, no
key ID. **No parity is claimed with Apple's online/OCSP mode.**

**Environments stay distinct.** The payload's environment must equal the verifier's own reading,
and `(environment, apple_transaction_id)` remains the ledger identity — Sandbox and Production are
never normalised together.

## 6. Real Apple PKI proof

BUILD 26P did not test only synthetic certificates. A **real** Apple chain, taken from Apple's
official published test material, was verified through the actual production chain path:

```
leaf          Prod ECC Mac App Store and iTunes Store Receipt Signing   (ECDSA P-256, OID .6.11.1)
intermediate  Apple Worldwide Developer Relations CA, OU=G6             (ECDSA P-384, OID .6.2.1, CA=true)
root          Apple Root CA - G3                                        (our own pinned anchor)
```

It **passes**, under real `wrangler`/`workerd`, in ~2–4 ms. This proves real Apple leaf,
intermediate and root parsing; real issuer linkage; real certificate signatures; both real Apple
purpose OIDs; the CA constraint; root anchoring; and workerd compatibility.

It also **independently confirmed** the requirements R1.1 added: WWDR G6 really does carry
`.6.2.1`, and the leaf really does carry `.6.11.1`.

> **A real Apple certificate chain is not a real Apple transaction.** They are different proofs and
> this document does not collapse them.

## 7. Known deliberate implementation differences

Recorded rather than smoothed — "zero differences" would be false:

1. **Implementation.** Apple's `SignedDataVerifier` requires Node's `crypto.X509Certificate`, which
   this Worker's compatibility layer defines as a throwing stub (measured in
   `unenv/.../internal/crypto/node.mjs`). BTY reproduces the checks with `jose`,
   `@peculiar/x509` and `reflect-metadata` on WebCrypto/workerd — Apple's library is the security
   behaviour reference, not the runtime.
2. **DN comparison is STRICTER than Apple's and than RFC 5280.** Apple compares formatted DN
   strings; RFC 5280 permits more still. BTY compares **DER Name encodings** byte-exactly. Two
   RFC-equivalent DNs *can* differ in DER, so this can produce a **false rejection** — it cannot
   expand trust. The real Apple chain passes it, and `@peculiar/x509` exposes no RFC-aware
   comparator, so hand-writing a DN canonicaliser would have added attack surface to erase a
   difference that costs nothing today.

## 8. `appAccountToken` contract

Required for `STOREKIT_CLIENT` transactions. Must be a **syntactically valid UUID** — no trimming,
no arbitrary normalisation; whitespace, tabs, newlines, braces, `urn:` prefixes and unhyphenated
forms are all rejected. Case is canonicalised only because hex `A` and `a` are the same UUID value.

It must equal the authenticated account's `karaoke_accounts.purchase_owner_ref` (BUILD 26E's
independent random UUID, so Apple never sees an account primary key).

```
missing / malformed                      -> typed failure, NO ledger write
valid UUID owned by another account      -> account_binding_mismatch, NO ledger write,
                                            NO disclosure of the owning account
```

**There is no legacy bypass**, because the Apple purchase census was zero before this shipped — a
bypass would have served no real population and only created a way to land a payment on the wrong
account.

## 9. `product_inactive` contract

All three seeded products remain `is_active = false`, and BUILD 26L §5's ratified meaning is
unchanged. For a genuine, verified transaction referencing a **known but inactive** product:

1. preserve the verified purchase in the ledger,
2. record `VERIFIED` / `NOT_GRANTED`,
3. issue no entitlement,
4. return typed `product_inactive` (409),
5. preserve the customer's claim for reconciliation.

Apple has already charged the customer, so discarding a genuine transaction because our product is
switched off would lose their money silently. **Recording a purchase is not activation, and not
entitlement.**

## 10. Replay and concurrency

The serialization authority is the database:

```sql
UNIQUE (environment, apple_transaction_id)
```

Implementation is **INSERT first, handle 23505** — never SELECT-then-INSERT. That is BUILD 26O-R1's
lesson applied directly: a read cannot serialize two concurrent callers, and the window between the
read and the write is exactly where a duplicate or a cross-account claim gets through.

Proven in real Postgres:

```
same transaction + same account        -> idempotent replay
same transaction + different account   -> transaction_already_claimed, no disclosure
concurrent duplicate (2 connections)   -> exactly ONE durable winner, 0 grants
same txn id in Sandbox and Production  -> separate identities; environment is part of the key
```

**Ownership never moves on replay, and verified Apple facts are never rewritten.**

## 11. Revoked transactions

A cryptographically valid transaction carrying revocation state is not an active purchase. It is
recorded with the schema's own vocabulary — `verification_status = REVOKED`, `grant_status =
NOT_GRANTED` — and grants nothing.

## 12. Test and runtime evidence (at R1.2)

| Gate | Result |
|---|---|
| vitest | **2771 / 0** (233 files) |
| b26p real-Postgres harness | **23 / 0** |
| b26o real-Postgres replay | **116 / 0** |
| BUILD 20M lease replay | **72 / 0** |
| BUILD 20M-R4 grace replay | **71 / 0** |
| `tsc --noEmit` | clean |
| `cf:build` | success |
| **workerd** | **19 / 19, allOk, ~1–4 ms** |

The workerd gate is the one that matters most: Vitest runs on Node, where `X509Certificate` exists,
so green there proves nothing about production. It covers real Apple chain acceptance, attacker
hierarchy rejection, wrong-trusted-root rejection, x5c length enforcement, both purpose OIDs,
issuer relationship checks, signedDate validity semantics, the strict-UUID path, and environment
read from the verified payload — all far inside the 300 ms CPU budget.

Two adversarial tests carry the weight: an attacker mints a **complete** hierarchy (root,
intermediate, leaf, self-consistent JWS) and is rejected; and our **test** chain is verified against
the **real Apple root** and required to fail, so the anchor is provably doing the work rather than
the suite passing vacuously.

## 13. Deployment gate

The artifact was built from a **clean detached checkout at `2a3e88d7` with 0 dirty files**, so it
provably excludes the working tree and all Founder WIP. The Worker Version ID was taken verbatim
from `versions upload` — no grep, no listing, no "latest" (BUILD 26M §8's permanent repair).

```
live build   2a3e88d70c2f   on workers.dev AND norebang.btydaily.com
version      02baaf8a-e234-4e2c-b5e0-9d5f270fb174 at 100%
```

**Rollout was briefly mixed and that is recorded, not hidden:** across two polls the two hosts
served different versions (`5bd4fcaec257` / `2a3e88d70c2f`) before converging on the third.

## 14. Production route proof, and the smoke that was skipped

**Before deployment the route genuinely did not exist.** Production returned a **404** whose
embedded payload carried the old build id `5bd4fcaec257` and routed the path to `/_not-found` — so
the 404 came from the old build, not an edge fallback. **After deployment** the same
unauthenticated request returns:

```
401  {"error":"Unauthorized"}      under live identity 2a3e88d70c2f
```

That request was chosen because source inspection proved it is **structurally pure**:
`bearerFromHeader` and `hostTokenFromRequest` are pure, and `authorizeHost` returns at
`if (!rawToken) return null;` **before any database access at all**. This route has no rate limiter,
so malformed input never reaches KV.

**The authenticated malformed-JWS smoke was deliberately SKIPPED.** Source inspection found that
`authorizeHost` performs a fire-and-forget `update({ last_used_at })` on `karaoke_host_sessions`
for a successfully authorized session — an ancillary persistent write. Holding no legitimate Host
session, running it would have meant *minting* one to perform a probe.

> **Operating rule, carried forward from BUILD 26O:** production state must not be tested by a
> mutation that might succeed, merely to observe the result. Prefer read-only evidence, a failure
> path structurally incapable of the protected mutation, or replay of an already-established
> idempotency identity when mutation is genuinely required.

## 15. Production commerce census

| | Before deploy | After deploy + smoke |
|---|--:|--:|
| Apple purchases | 0 | **0** |
| Paid grants | 0 | **0** |
| Catalog rows | 3 | **3** |
| Catalog `is_active` | 0 | **0** |
| Grants | 55 | **55** |
| Audit rows | 155 | **155** |
| Sessions touched by smoke | — | **0** |

**Zero commerce writes. Zero entitlement writes. Zero catalog changes. Zero audit changes. Zero
session changes.**

## 16. Migration and secret delta

**Migration: NONE.** Local/production parity remains `20260815120000 == 20260815120000`.

BUILD 26P added **no** StoreKit or App Store API secret requirement — no Apple issuer ID, no key
ID, no private key. Apple's root certificates are **public** trust material bundled with the
verifier. Secret count is unchanged at 16; the five `KARAOKE_APPLE_REVOCATION_*` /
`KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY` entries are Sign-in-with-Apple concerns from 26E/26K and are
untouched. The one new env read, `KARAOKE_APPLE_BUNDLE_ID`, has an in-code default and is optional.

## 17. Genuine Apple transaction — EXPLICITLY DEFERRED

**A genuine Apple-signed StoreKit transaction JWS has NOT yet been verified.**

The reason is a missing dependency, not a server defect: there is no App Store Connect IAP product
and no native StoreKit purchase implementation capable of producing one. **The server verification
slice is complete.**

The future integration gate, owned by the ASC/native StoreKit work:

1. an ASC IAP product exists;
2. a native StoreKit purchase path exists;
3. the purchase supplies `appAccountToken` = the authenticated `purchase_owner_ref`;
4. a Sandbox purchase produces a genuine Apple-signed transaction;
5. it is sent to the production verification endpoint;
6. **exactly one** purchase ledger row is durably recorded;
7. **no** paid entitlement is issued under the 26P contract;
8. any retry reuses the **same** Apple transaction identity (inert by the unique index);
9. the forensic row remains permanent.

**BUILD 26P must not be reopened because that dependency has not been built yet.**

## 18. Deferred — untouched by BUILD 26P

- genuine Apple Sandbox transaction gate (§17)
- App Store Connect IAP product creation
- native StoreKit purchase implementation
- paid transaction → paid Pass issuance, and its atomic RPC/migration
- `Transaction.finish()` fulfilment contract
- App Store Server Notifications V2, refunds, ongoing reconciliation
- BUILD 26O REVOKED audit actor provenance
- BUILD 18C G4 / G6 / G7
- legacy `issue_timed_access_pass` wrapper removal

## 19. What this build should be remembered for

- **Verification is not fulfilment, and the gap between them is where money goes missing.** Every
  path here records what happened and grants nothing; the one response that could have been read as
  "you may finish now" is pinned by a test that forbids it.
- **A signature that verifies proves only that someone signed it.** The attack this build is really
  about is a perfectly self-consistent attacker chain — own root, own intermediate, own leaf. Only
  an anchor we supply out of band makes any of it mean something.
- **Two review findings were real, and both were mine.** R1 accepted x5c of 2–4, checked only the
  leaf's OID, compared signatures without issuer linkage, dated certificates by `Date.now()`, and
  trimmed an uncontrolled string before validating it as a UUID. R1.1 then justified a single trust
  root with an argument that conflated the JWS algorithm with the certification-path algorithms.
  Both were caught by review, not by tests — the tests were testing the layer the defect wasn't in.
- **Prove the accepting case, not just the rejecting one.** For two revisions the Apple root had
  only ever been shown to *reject* our synthetic chain. That proves the anchor is consulted; it does
  not prove a genuine Apple chain is accepted. Those are different claims, and only the second is
  what production depends on.
- **Say precisely what was proven.** A real Apple certificate chain is not a real Apple
  transaction. Closing with that distinction stated plainly is worth more than a cleaner-sounding
  claim.
