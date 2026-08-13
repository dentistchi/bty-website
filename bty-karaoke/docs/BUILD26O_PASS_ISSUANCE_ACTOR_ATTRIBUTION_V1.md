# BUILD 26O — Pass Issuance Actor Attribution

**Status: PASS / CLOSED — 2026-08-13**

An issuance could be proven to have **happened** and never proven to have been **originated** by
anything. BUILD 26O closes that, and closes it without ever claiming to know more than the server
actually knows.

The build took three revisions. Two were defects found in review — a replay boundary that reported
another account's grant as a success, and a migration with no safe rollout order — and both are
kept here in full, because they are the useful part. So is the one thing that went wrong in
production: **BUILD 26O accidentally issued a second, unauthorized grant during verification.** It
is recorded in §16, not in a footnote.

---

## 1. Objective

Close exactly one deferred forensic gap: **pass issuance actor attribution**. Every other deferred
item stays deferred (§26).

---

## 2. Locked baseline (BUILD 26N)

```
BUILD 26N        PASS / CLOSED
monorepo         842c70732e6bd7e79a2a8c674017d162a1cdd967
native           a131d600071927cdedce894cafd58ce0762fa5a2 · build 95 · marketing 1.0
commerce         0 Apple purchases · 0 paid grants · catalog 3 · is_active false ×3
grants / audit   53 / 152
```

**Native was not touched by BUILD 26O at any point.**

---

## 3. O0 findings — the complete issuance census

Exactly **one** path can create a grant. `insert into public.timed_access_pass_grants` appears
**once** across all 44 migrations.

| Path | Auth | Creates grant? |
|---|---|---|
| `POST /api/manager/timed-passes/issue` → `issue_timed_access_pass` | shared `bty_mgr` cookie | **YES — the only one** |
| `select_timed_access_pass` · `switch_timed_access_pass` · `karaoke_begin_song_v2` · `revoke_timed_access_pass` | host / room / manager | no |
| `decide_karaoke_pro_pilot_request` | manager | no — changes the plan |

The scope was therefore not larger than expected, and no legacy or bypass issuance path existed.

---

## 4. Root cause

Three compounding facts, none of them an oversight by a single author:

1. `p_manager_actor text default 'bty_mgr'` — the actor was a **constant with a default**, so every
   caller produced the same uninformative string and no caller *could* fail to.
2. The ISSUED audit insert **omitted the `metadata` column entirely**, though the column existed and
   the ACTIVATED path already populated it.
3. `managerAuthorized` returns a **boolean**. `signManagerSession` mints `{ m: 1, e: expiry }` — no
   account, no email, no operator row, no session record. **There was never anything more
   discriminating available to record.**

Measured on production before the migration: **53 ISSUED audit rows, 0 with metadata.**

BUILD 26M §11 paid for this: 15 grants appeared 11 seconds apart and the audit could not
distinguish one script from fifteen sessions.

---

## 5. The canonical JSONB RPC

`issue_timed_access_pass(uuid, text, text, text, **jsonb**)` — `p_issuance` has **no default**, so
a caller that omits it fails to resolve the function rather than quietly issuing unattributed.

```json
{ "version": 1, "source": "manager_issue",
  "actor_kind": "shared_manager_credential", "actor_id": "bty_mgr",
  "session_fp": "<sha256(session token)[:16]>" }
```

**What the server may honestly claim, and its limits.** `actor_kind` names the **credential class**,
never a person. `session_fp` correlates **manager token values** — equal fingerprint ⇒ equal token,
different ⇒ different token. It does **not** identify a human or a physical login session: the
credential is shared, so one token may be held by many and one person may mint many. **The unique
human operator remains UNKNOWN and the credential remains `bty_mgr`.**

Validation happens **before** the advisory lock and before every write, so a refusal
(`issuance_provenance_required`) mutates nothing. The grant insert and the ISSUED audit insert live
in one function body — **one transaction** — and both take their actor from **one** extracted
variable, so `grant.issued_by_manager` and `audit.actor_ref` cannot disagree.

A structural floor backs it: `timed_pass_issue_attribution_chk`, added **NOT VALID** so it binds
every future ISSUED row while leaving the 53 historical rows unexamined and unedited.

---

## 6. The legacy compatibility wrapper (R2)

`issue_timed_access_pass(uuid, text, text, text, **text**)` — the deployed signature, **replaced in
place**, delegating to the canonical implementation with truthful legacy provenance:

```json
{ "version": 1, "source": "manager_issue_legacy_compat",
  "actor_kind": "shared_manager_credential", "actor_id": "bty_mgr" }
```

```
shared credential      KNOWN
token fingerprint      UNAVAILABLE  ->  session_fp is OMITTED, never invented
unique human operator  UNKNOWN
```

`session_fp` is **absent**, not null-or-placeholder: a fabricated one would be indistinguishable
from a real correlation in a later forensic join. A non-`bty_mgr` actor is **refused**
(`legacy_actor_not_supported`) rather than relabelled. The wrapper performs **no insert of its
own**, so it inherits — rather than re-implements — provenance, the replay boundary, the advisory
lock, the PRO block and the single-transaction write.

---

## 7. R1 — the idempotency replay boundary (defect found in review)

`timed_pass_issue_idem_idx` is UNIQUE on `(issue_idempotency_key)` **alone** — global, never
account-scoped — and the key is chosen by the **caller**. The replay read matched on the key alone,
so:

- **A.** account B presenting a key already spent by account A received `ok:true` **with A's
  `passGrantId`, `passType` and `status`** — a success B never received, and a disclosure of another
  account's grant;
- **B.** the same key with a different `pass_type` replayed the ONE_HOUR grant to a caller who asked
  for FOUR_HOURS.

The unique index always prevented a duplicate **grant**. Nothing prevented the false **report**.

**Pre-existing, not introduced by 26O** — `20260728120000:262` carried the identical read.

**Authority, not preference:** `create_additional_karaoke_room` had already ratified the shape —
*"SAME key + SAME payload replays; a DIFFERENT payload → `idempotency_conflict`"*. A different
account, or a different product, is a different payload.

Replay now requires `account_id` **and** `pass_type` to match; anything else returns
`idempotency_conflict` carrying **no id, status, type or account** (409). The lookup stays **global
on purpose** — narrowing it would hide the collision. A narrow `exception when unique_violation`
converts a concurrent collision into the same typed answer; it guards the grant insert alone and
**returns a failure**, with the audit insert outside it.

> **A mutant survived, and that was the point.** Rewriting that handler to `{ok:true, reused:true}`
> passed the entire suite — the sequential tests are caught by the read and never reach it. Closed
> with a real two-connection race.

---

## 8. R2 — the zero-gap rollout defect (found in review)

R1 **dropped** the 5-text signature. Correct for R1, and unshippable:

| Order | Consequence |
|---|---|
| Migration first | Deployed Worker calls `p_manager_actor` → **function absent** → issuance broken |
| Worker first | New Worker calls `p_issuance` → **function absent** → issuance broken |

A migration whose only safe order is "both at once" has none. R2 replaces the signature in place
instead — the parameter list is byte-identical to the deployed one, so the old call keeps resolving
and now resolves to the wrapper.

**Overload resolution, measured rather than assumed.** I asserted an untyped positional call would
be *ambiguous*. It is not: `text` is the preferred type in the string category, so a positional
untyped 5th argument selects the **legacy wrapper**, and `::jsonb` selects the canonical one. Both
are attributed, so the fallback is safe. PostgREST always sends **named** arguments, which select by
parameter name. That measurement then exposed three of my own earlier tests that had been silently
exercising the wrapper.

---

## 9. Migration identity

```
supabase/migrations/20260815120000_karaoke_pass_issuance_actor_attribution_v1.sql
sha256  505a668d35419810939272da604627081231714a2482c8d5904a49d74a655fdb
```

Forward-only, additive, idempotent (applied three times in the harness). **No historical row is
updated by this file.**

---

## 10. Production migration proof

```
parity    everything <= 20260814120000 paired; ONLY 20260815120000 pending (dry-run confirmed)
apply     Applying migration 20260815120000... Finished
history   version 20260815120000 present
```

| Signature | delegates | inserts | ACL |
|---|---|---|---|
| `…, jsonb` (canonical) | false | **true** | `postgres`, `service_role` only |
| `…, text` (wrapper) | **true** | false | `postgres`, `service_role` only |

`timed_pass_issue_attribution_chk` present, **`convalidated = false`**.

**Migration row mutations: 0** — 53 grants / 152 audit / 0 attributed, identical before and after.

---

## 11. Old-Worker compatibility proof (before deploying)

Live Worker was `712fe5895abb` (pre-26O). Target UUID `26000000-…` proven absent (0 accounts,
0 grants).

```
legacy arg set     -> HTTP 200  {"ok": false, "error": "account_not_found"}
canonical arg set  -> HTTP 200  {"ok": false, "error": "account_not_found"}
side effects       -> 53 / 152 / 0   unchanged
```

Domain-level response through production PostgREST. No PGRST202 (not found), no PGRST203
(ambiguous), no schema-cache error. **Zero-gap compatibility proven in production before the
deploy.**

> **Disclosed limitation.** The app route returns 401 before reaching the RPC, and
> `KARAOKE_MANAGER_PASSCODE` was not held, so this probe was made at the **PostgREST layer using the
> exact argument set the deployed Worker sends** — where every stated failure mode lives. It does
> not exercise the Worker's own auth/validation code, which is unchanged 26N code.

---

## 12–13. Deployment and live identity

```
Worker Version ID   8c8f7c9e-1ae3-4592-9f53-a88b688f8332
promote             wrangler versions deploy 8c8f7c9e-…@100%   -> SUCCESS
deployment          2026-08-13T04:41:24.802Z · 100% · supersedes BUILD 26M's 05067bbc
live build          5bd4fcaec257  on workers.dev AND norebang.btydaily.com
```

The version ID was taken **verbatim from the output of `versions upload`** — no grep, no listing, no
"latest" — per the permanent procedural repair in BUILD 26M §8. The preview URL was verified as
`5bd4fcaec257` before promotion.

**Worker VERSION ID and served-source build id are different identities and are not
interchangeable.**

---

## 14. Authorized live issuance

Gate account `1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c` (non-PRO; pre-state 23 grants / 13 AVAILABLE /
0 SELECTED / 1 ACTIVE).

```
grant     67af9961-2123-427f-8533-f18cca657075
          ONE_HOUR · 3600 s · carryover 0 · issued_by_manager bty_mgr
          reason "BUILD 26O production attribution gate" · key ee42745d-…
          status AVAILABLE · selected/activated/expires ALL NULL — deliberately not consumed
          MANUAL_PROMOTIONAL · is_paid false · apple_purchase_id null
          created_at 2026-08-13 04:43:20.089251Z

ISSUED    exactly ONE row, created_at 04:43:20.089251Z   <- identical: one transaction
          actor_type MANAGER · actor_ref bty_mgr
          metadata {version:1, source:"manager_issue",
                    actor_kind:"shared_manager_credential",
                    actor_id:"bty_mgr", session_fp:"f8af33dbaa1e26c9"}
```

`grant.issued_by_manager = audit.actor_ref = bty_mgr`.

**The decisive proof.** `sha256(token)[:16] = f8af33dbaa1e26c9` was computed **before** the request
and never placed in the body. The database holds exactly that value, so the **Worker derived it
itself from the presented session cookie**. It is not the raw token (74 chars vs 16 hex), not a
substring of it, and not recoverable from it.

### Disclosed Founder-authorized harness artifact

`KARAOKE_MANAGER_PASSCODE` was not held, and `KARAOKE_CAP_SECRET` is unset, so the session HMAC
falls back to the service-role key. A manager session token was **minted** for the gate, following
the BUILD 26M G10-B precedent.

- **The auth origin was synthetic. The issuance path was NOT.** The request travelled the real
  chain: route → `managerEnabled` → `managerAuthorized` → `managerIssuanceActor` → `issueTimedPass`
  → canonical RPC.
- The Worker computed `session_fp` **itself** from the presented cookie — which is precisely what
  makes the artifact evidence rather than a shortcut.
- The manager session is **stateless** (no DB row), so it cannot be revoked, only expired. It was
  minted with a **180-second** expiry instead of the product's 12 hours, and the local copy was
  deleted.

---

## 15. Replay proof

Same account, same pass type, same key → `{"ok":true,"passGrantId":"67af9961-…","reused":true}`.

```
grants for that key       1   (no second grant)
ISSUED audits for grant   1   (no second audit)
```

---

## 16. The unauthorized second issuance

**BUILD 26O accidentally issued a second grant during verification.**

```
5286f7d8-4bc3-40c5-8100-537fa3a17bcc
account   1a0be5e8-…   ONE_HOUR · 3600 s · carryover 0
issued    2026-08-13 04:44:50.048667Z   reason NULL
metadata  {version:1, source:"manager_issue", actor_kind:"shared_manager_credential",
           actor_id:"bty_mgr", session_fp:"f8af33dbaa1e26c9"}
```

It is **not** part of the BUILD 26O gate and must never be cited as gate evidence.

---

## 17. Exact cause

After the P5 replay, a probe was run to confirm the harness token had expired. **The 180-second
window had not elapsed** — roughly 90 seconds remained — and because the probe used a **fresh**
idempotency key rather than replaying the existing one, the call succeeded and created a real
grant.

Two distinct process failures:

1. **A mutating call was used to test a timing assumption.** Verifying an expiry does not require
   an operation that can succeed.
2. **A fresh key was used where a replayed key was correct.** Re-sending the *same* key would have
   returned `reused:true` and created nothing, whatever the token's state.

The assumption was not measured before acting on it. Both grants carry the same `session_fp`, so
the audit itself proves they came from one manager token — incidentally demonstrating the exact
capability this build added, which does not excuse the error.

---

## 18. Corrective revocation (Founder-authorized)

```
POST /api/manager/timed-passes/grants/5286f7d8-…/revoke
     reason "BUILD 26O unauthorized production probe — corrective revocation"
->   {"ok":true,"passGrantId":"5286f7d8-…","status":"REVOKED","replayed":false}
```

Through the **existing production manager revoke path**. The grant was **not deleted**.

```
status              REVOKED
revoked_at          2026-08-13 04:50:00.372331Z
revoked_by_manager  bty_mgr
revoke_reason       BUILD 26O unauthorized production probe — corrective revocation
```

The audit trail now reads, in order, exactly what happened:

| Audit row | Action | From → To | Metadata |
|---|---|---|---|
| `dbc9759e-…` | **ISSUED** | null → AVAILABLE | full 26O provenance, **unchanged** |
| `2f13c372-…` | **REVOKED** | AVAILABLE → REVOKED | `null` |

**The original ISSUED event was not rewritten.** Exactly one new REVOKED row was created.

*Measured detail, reported rather than assumed:* the REVOKED row's `metadata` is `null`. BUILD 26O
constrains **ISSUED** rows only, and the revoke RPC is unchanged by this build, so it writes no
provenance document. Revocation actor context is a separate gap, not something 26O claimed to close.

---

## 19. Proof it was never used

```
selected_at   NULL
activated_at  NULL
expires_at    NULL
expired_at    NULL
is_paid       false        source_type MANUAL_PROMOTIONAL      apple_purchase_id NULL
```

Before revocation, `updated_at = created_at` — the row had not been touched since issue. **It was
never selected, activated, consumed, or paid.**

---

## 20. Final census

| | Pre-26O | Final | Δ |
|---|--:|--:|--:|
| Timed pass grants | 53 | **55** | **+2** |
| Audit rows | 152 | **155** | **+3** |
| ISSUED with provenance | 0 | **2** | +2 |
| ISSUED still unattributed (historical) | 53 | **53** | **0** |
| REVOKED audit rows since rollout | — | **1** | +1 |

**The honest statement of what this build did to production:**

> BUILD 26O intentionally issued one production gate grant and accidentally issued one additional
> grant during verification. The unintended grant was immediately preserved as forensic history and
> explicitly revoked before closure; it was never selected, activated, consumed, or paid.

Functional state:

```
67af9961-…   authorized gate grant       AVAILABLE   (untouched by the revocation)
5286f7d8-…   unauthorized probe grant    REVOKED
```

---

## 21. Apple commerce invariant

```
Apple purchases   0
paid grants       0
catalog rows      3
is_active=true    0
```

Measured before the migration, after the migration, after deployment, after both issuances, and
after the corrective revocation. **Unchanged at every checkpoint.**

---

## 22. Historical non-change

```
BUILD 26M cohort           15 present · 0 with invented provenance
historical ISSUED rows     53 still unattributed — unknown stays unknown
rows that gained metadata  0
e59e46a1-…                 ACTIVE · updated_at 2026-08-13 02:00:05Z (its 26N activation) · 0 invented
67af9961-…                 AVAILABLE · updated_at = created_at — unchanged by the revocation
grants revoked             8 total = 7 pre-existing + 1 corrective — no unrelated grant revoked
```

---

## 23. Test totals

| Gate | Result |
|---|---|
| vitest | **2644 / 0** (228 files) |
| b26o real-Postgres harness | **116 / 0** |
| BUILD 20M lease replay | **72 / 0** |
| BUILD 20M-R4 Final Song Grace replay | **71 / 0** |
| Mutants | **19 / 19 killed** |
| `tsc --noEmit` | clean |
| `cf:build` | OpenNext build complete |

---

## 24. Preserved unrelated state

```
monorepo   M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
           ?? bty-karaoke/brand/
           ?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md
           + ~380 unrelated Arena/Foundry paths
native     M BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
           sha256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

All untouched, unstaged, uncleaned. Native HEAD remains `a131d60…` at build 95.

---

## 25. The legacy wrapper is retained deliberately

`issue_timed_access_pass(uuid, text, text, text, text)` **stays live**. It is the rollback
compatibility boundary: if the Worker must revert to 26N, that signature is what keeps issuance
alive. Dropping it in this build would re-couple the two deployables that R2 exists to decouple.

It is service_role-only, fully attributed, delegating, and **not a second implementation**.
Its removal is explicitly deferred to a separate, narrowly documented cleanup build after live
parity has held.

---

## 26. Deferred — untouched by BUILD 26O

- **Track B Slice 3** — server Apple transaction verification endpoint
- **App Store Connect product creation** — still zero IAP products
- **BUILD 18C G4 / G6 / G7**
- **Legacy RPC signature removal** (§25)
- **Revocation actor provenance** — the REVOKED audit row carries no provenance document (§18)
- **Per-operator manager identity** — `bty_mgr` remains a shared passcode, so no issuance can ever
  name a person until that changes. 26O narrows the question to the token; it cannot answer it.

---

## 27. What this build should be remembered for

- **Attribution must record what the server knows, and stop.** The temptation is to write a name.
  The manager session has no name in it, so the honest record is a credential class and a token
  fingerprint — and saying so precisely is the whole value.
- **A test that cannot fail proves nothing.** A mutant that turned the collision handler into a
  silent success passed the entire suite, because no test reached that path. The race test exists
  because the mutant survived.
- **Measure before asserting — twice this build punished the opposite.** "Positional calls will be
  ambiguous" was wrong and had silently mis-routed three tests. "The token has expired" was wrong
  and cost a production grant.
- **A migration is not correct until it has a safe rollout order.** R1 was functionally right and
  operationally unshippable.
- **Never use a mutating call to test an assumption.** Verifying an expiry did not require an
  operation that could succeed; a replayed idempotency key would have been inert.
- **Disclose the mistake at full size.** The unintended grant is §16 and §17 of this document, not a
  footnote, and the closure wording states it in the same breath as the intended one.
