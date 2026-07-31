# Live function body drift — forensics + reconciliation plan (Slice 3.2I-R5B1A.1-R2.7)

**R2.7 verdict: HALTED · TRUSTED LIVE FUNCTION BODY TEXT ABSENT.**
**R2.8 verdict (this document's current state): RESOLVED — both live bodies exported, verified and measured; a reconciliation migration is proven offline. See §9–§11.**
Forensic evidence only. Authorizes no repair, no apply, no deploy. Nothing here was run against the live database.

## 1. What the r2.6 audit established

The PostgreSQL-17 packet audit (`packetId d5171bbd…`, handshake PASS, runtime attestation PASS) reduced the whole question to two function bodies:

| Migration | Verdict | Blocked by |
|---|---|---|
| `20260726000000` | **D** | `bty_foundry_set_shared_review` body digest |
| `20260727000000` | **A** | — repair-eligible |
| `20260728000000` | **A** | — repair-eligible |
| `20260729000000` | **D** | `bty_foundry_submit_followup` body digest |

Every *structured* property of both functions (signature, return type, language, volatility, strictness, leakproof, parallel, `security definer`, `search_path`) matches live exactly. Only the raw `prosrc` differs.

## 2. Why this slice halted

The audit query measures `sha256(prosrc)`; **it does not carry the body text**. So the live bodies could only be identified, not read. An exhaustive search then established that they cannot be recovered from the repository either:

- every object in every commit of **both** repositories was enumerated and content-matched on the definition itself (not the name): 1,732 + 1,768 commits, 10,390 + 10,822 blobs
- exactly **three** blobs carry any definition — the three migration files — each with exactly **one** version in history. No hotfix script, archived variant, doc snippet, `bty-ai-core` or `bty-website` copy exists
- **1,260** transport-artifact variants (CRLF/CR, trailing-whitespace stripping, leading/trailing newlines, tab expansion, NBSP, blank-line collapsing, de-indentation, comment stripping, and pairwise compositions) were hashed for every candidate — **none** reproduces either live digest

| Function | Repository authority | Live | Match |
|---|---|---|---|
| `set_shared_review` | `ea748569…` (20260726) | `52cc335a…` | ✗ |
| `submit_followup` | `99c66ac7…` (20260729), `ba0ba9e6…` (20260728) | `21cdd472…` | ✗ |

Both live bodies are classified **UNKNOWN VERSION**. Per Part 1 of the slice directive, the forensic comparison stops here rather than connecting to live.

## 3. Provenance of the known variants

| Body | Introduced | Ledger | Applied how |
|---|---|---|---|
| `set_shared_review` 20260726 | inner `66a5eefb` | outer `df377929` "applied + deployed" | **SQL Editor paste** |
| `submit_followup` 20260728 | inner `1594a1fa` | outer `c3d43884` "APPLIED + DEPLOYED" | **SQL Editor paste** |
| `submit_followup` 20260729 | inner `518e6aa7` | outer `d085f80b` (written), `bb7347cb` (applied, device gate PASS) | **SQL Editor paste**, DB-only, no redeploy |

All three reached live by hand-paste, never by `db push` — a transport that can carry text the repository never recorded. Note that `materialize_followup` and `get_my_followup` travelled in the *same* paste as `submit_followup` and match live **exactly**, so paste alone is not a sufficient explanation: something specific happened to these two bodies.

## 4. Caller contracts (measured from deployed code)

**`setSharedReview`** — `src/lib/bty/foundry/events/foundrySharedReviewService.ts`
Reads `data[0].result`; accepts `reviewed | unchanged | not_owner | no_progress | no_shared_response | invalid_status` and silently coerces anything else — including any raised error — to `no_progress`. Requires owner re-check inside the function, no mutation of `completed_at`/XP/the learner response, and one audit row per real change.

**`submitFollowup`** — `src/lib/bty/foundry/events/foundryFollowupService.ts`
Reads `data[0].{result,status,outcome}`; accepts `responded | unchanged | already_responded | invalid_outcome | not_found | not_owner` and coerces anything else — including any raised error — to `error`. Requires first-response-wins, retry idempotency, and one `RESPONDED` audit row per real transition.

Both callers read **only the first row** and discard the rest. That is what makes row count a security property, not a cosmetic one.

## 5. Behavior matrix (PostgreSQL 17, disposable, identical fixtures)

`scripts/migration-proof/body-forensics/run.sh` installs each candidate against the same faithful prerequisites and prints the raw-prosrc SHA-256 of what it actually measured.

| Variant | Digest | Result |
|---|---|---|
| `set_shared_review` / repo-20260726 | `ea748569…` | **24/24 — satisfies the contract** |
| `set_shared_review` / live | — | **ABSENT — not measurable** |
| `submit_followup` / repo-20260728 | `ba0ba9e6…` | 5/22 — fails 1–9, 11–15, 20–22 |
| `submit_followup` / repo-20260729 | `99c66ac7…` | 16/22 — fails 5, 7, 16, 20, 21, 22 |
| `submit_followup` / live | — | **ABSENT — not measurable** |

### 5.1 A defect found in the repository body

`repo-20260728` fails as expected: it raises `42702` on every valid submission — exactly the device-gate defect `20260729` was written to fix.

`repo-20260729` fixes that, but the harness found a **separate, previously unrecorded defect that is still present in the final repository authority**. Both bodies omit `return;` after the RESPONDED-branch `return query`:

```sql
if v_row.status = 'RESPONDED' then
  if v_row.outcome = p_outcome then
    return query select 'unchanged'::text, v_row.status, v_row.outcome;   -- no `return;`
  else
    return query select 'already_responded'::text, v_row.status, v_row.outcome;   -- no `return;`
  end if;
end if;
-- execution CONTINUES into the UPDATE + audit INSERT
```

In PL/pgSQL `return query` appends rows and keeps executing. The measured consequence:

- a conflicting second outcome **overwrites the first** (`NOT_YET` → `APPLIED`) while the caller, reading `data[0]`, is told `already_responded` — first-response-wins is violated
- an identical retry rewrites `responded_at` and appends a **duplicate** audit row while the caller is told `unchanged` — retries are not idempotent
- every such call returns **two** rows; the second, contradicting row is silently discarded by the caller

The migration's own header claims "First-response-wins, idempotent-unchanged, and never-overwrite behaviors are preserved verbatim". Measured on PostgreSQL 17, they are not. The single device gate that passed (`bb7347cb`) exercised one submission only, so it could not surface this.

**Consequence for reconciliation:** decision **A (repository body canonical) is excluded** for `submit_followup`. Pushing `99c66ac7…` live would install a body that can silently overwrite a learner's recorded outcome.

## 6. Canonical decisions

| Function | Decision | Why |
|---|---|---|
| `set_shared_review` | **D — UNRESOLVED** | Repository body is clean (24/24), but the live text is unreadable and unknown. Stale regression (A) vs superior hotfix (B) is not decidable from a digest. |
| `submit_followup` | **D — UNRESOLVED**, with **A excluded** | Live text unreadable. Independently, the repository final-authority body is disqualified on measured behavior. Resolution is **B** (only if live already contains the fix) or **C** (new reconciled body). |

Neither decision may be made on recency, and neither may be closed before the live text is read.

## 7. Unblocking artifact

`docs/audit/forensics/foundry_function_body_export_readonly.sql` — one read-only statement, `pg_catalog` only, no application rows, returning the four audited bodies plus their digests.

It is deliberately **not** a packet, so publishing it does not invalidate the r2.6 packet that remains the authoritative evidence. Its trust anchor is that packet: `scripts/migration-proof/body-forensics/ingest-live-body.mjs` accepts a body **only** when the digest recomputed from its text equals the digest the r2.6 audit independently attested, and refuses to write a fixture otherwise. A tampered, truncated or re-indented export cannot reach the harness.

```
# 1. trusted read-only runner
psql "<read-only conn>" -tAq -f bty-app/docs/audit/forensics/foundry_function_body_export_readonly.sql > live_body_export.json

# 2. offline, no DB
cd bty-app
node scripts/migration-proof/body-forensics/ingest-live-body.mjs live_body_export.json live_audit_result.r2.6.json
PGPROOF_BINDIR=/opt/homebrew/opt/postgresql@17/bin bash scripts/migration-proof/body-forensics/run.sh
```

The harness will then measure the live bodies on the identical matrix and **fail against its recorded baseline** until a human reviews the new rows and records them — a new body is never silently accepted.

## 8. Coherent four-version reconciliation plan

Not executed. Every live step needs separate explicit authorization.

**Ordering principle.** `20260727`/`20260728` are already A, but repairing them alone leaves a ledger claiming a coherent chain while `20260726`/`20260729` remain unexplained. Repair happens as **one atomic pass, after both bodies are resolved** — never piecemeal.

1. **Read the live bodies** — trusted read-only export → ingest → harness (§7). No writes.
2. **Decide each function** — A / B / C per §6, on measured behavior, not recency. Record in `body_decision.json`.
3. **`submit_followup` almost certainly needs a new reconciled body (C).** Even if live already fixes the fall-through, the repository must be corrected so history stops carrying a defective final authority. That is a new additive migration (`2026080x_..._followup_return_guard_v1.sql`), tested on disposable PostgreSQL 17 to 22/22 before any live authorization. It does not edit `20260729`.
4. **`set_shared_review`** — if live is a regression → reconcile live to the repository body; if live is a superior hotfix → keep live and capture it in a provenance migration. Historical migration files are never rewritten to match live.
5. **Apply the reconciliation** through an explicitly authorized live gate, one `create or replace` at a time.
6. **Verify body digests live** — re-run the r2.6 audit; require `93 effects / 93 exact / 0 conflict`.
7. **Repair migration history** only then, in ascending order `20260726 → 20260727 → 20260728 → 20260729`, each marked applied only once its final-authority function is explained.
8. **Verify the migration list** — `20260802000000` and `20260803000000` must be the *only* pending entries.
9. **Authorize their apply separately** — they are out of scope until steps 1–8 close.
10. **Post-apply schema verification**, then application deployment (Worker) only if a code path changed. A body-only reconciliation is DB-only and needs no redeploy — as `bb7347cb` already established.

**STOP conditions.** Any of these halts the pass: the body export fails digest verification; the harness disagrees with its baseline without a recorded human decision; the post-reconciliation audit still reports a conflict; the pending-migration list contains anything other than the two Practice migrations; a repair would mark a migration applied while its final-authority function is still unexplained.

**Rollback.** Steps 1–2 are read-only. Step 5 is reversible by re-applying the previous body, whose exact text is by then captured as forensic evidence on both sides. Step 7 is ledger-only and reversible. No data is migrated at any point.

---

# R2.8 — resolution (live bodies measured, reconciliation proven offline)

## 9. The live bodies, verified and measured

Both were exported read-only, ingested only after the text re-hashed to the r2.6-attested digest, and run through the identical matrix.

| Variant | Digest | Result |
|---|---|---|
| `set_shared_review` / repo-20260726 | `ea748569…` | 24/24 |
| `set_shared_review` / **live** | `52cc335a…` | **24/24** |
| `submit_followup` / repo-20260728 | `ba0ba9e6…` | 5/22 |
| `submit_followup` / repo-20260729 | `99c66ac7…` | 16/22 — fails 5,7,16,20,21,22 |
| `submit_followup` / **live** | `21cdd472…` | **16/22 — fails 5,7,16,20,21,22** |
| `set_shared_review` / **reconciled-20260804** | `ea748569…` | **24/24** |
| `submit_followup` / **reconciled-20260804** | `4826ad0d…` | **22/22** |
| concurrency / reconciled-20260804 | `4826ad0d…` | **35/35** |

**Live carries exactly the same defect as repository authority** — the identical six failing cases. The fall-through was never fixed anywhere.

### 9.1 `set_shared_review` — the difference is nothing

A literal-aware tokenizer (string literals preserved verbatim, `--` comments dropped, whitespace collapsed) gives **258 identical tokens** on both sides. No string literal contains whitespace, so the collapse is sound. The only non-whitespace difference is one deleted comment:

```
-- Idempotent: an identical (status, note) resubmission writes nothing new.
```

Classification: **formatting only** and **comment only**. Nothing authorization-, mutation-, audit-, return-shape- or concurrency-material.

## 10. Canonical decisions

| Function | Decision | Why |
|---|---|---|
| `set_shared_review` | **A — repository body canonical** | Provably semantically identical to live (258 identical tokens); both 24/24. The repository body wins on provenance: known migration source, known tests. Reinstating it makes the repository the single source of truth, and the apply proof shows the digest does not move — a genuine no-op. |
| `submit_followup` | **C — new reconciled body required** | Repository authority *and* live fail the identical six cases. Neither may be canonical; keeping live merely to avoid touching production would preserve a body that silently overwrites a learner's first recorded outcome. |

## 11. The reconciliation migration

`supabase/migrations/20260804000000_foundry_function_body_reconciliation_v1.sql` — bodies only, `create or replace`, safe to reapply. It does **not** edit 20260726/27/28/29.

Fix applied to `submit_followup`: an explicit `return;` terminating the RESPONDED branch, a NULL-safe `is not distinct from` outcome comparison, and an explicit terminal `return;`. Preserved verbatim: signature, return shape, `SECURITY DEFINER`, `search_path`, the 20260729 `#variable_conflict use_column` correction, and the EXECUTE ACL (the migration grants and revokes nothing).

**Offline proof (PostgreSQL 17.10, disposable; PostgreSQL 16.14 compatibility identical):**
apply PASS · reapply byte-identical PASS · only `submit_followup`'s body changed · `set_shared_review` byte-identical, proving the reinstatement is a no-op · `pg_proc` structured properties unchanged · every exact ACL tuple unchanged · 22/22 + 24/24 contract cases · 35/35 real multi-connection concurrency cases.

**New packet:** `a2725391048c…` (r2.7), binding the reconciliation checksum and both final body digests, with `20260804` as final authority for both functions while `migrationVersion` still records 20260726/20260728. The r2.5 and r2.6 live results are rejected at the handshake.

## 12. Future live gate — plan only, nothing executed

Because `20260802` and `20260803` are still pending, a normal `supabase db push` would try to apply them **together with** the reconciliation. The live step must therefore be a direct, explicit, single-file transaction — never a push.

```
# 1. Apply ONLY the reconciliation, in one transaction, after Commander authorization.
psql "<read-write conn>" -v ON_ERROR_STOP=1 --single-transaction \
  -f bty-app/supabase/migrations/20260804000000_foundry_function_body_reconciliation_v1.sql

# 2. Re-export the bodies (read-only) and confirm the post-apply digests.
psql "<read-only conn>" -tAq \
  -f bty-app/docs/audit/forensics/foundry_function_body_export_readonly.sql > post_apply_bodies.json
#    require: set_shared_review = ea748569…   submit_followup = 4826ad0d…

# 3. Trusted read-only audit under the NEW packet a2725391…
psql "<read-only conn>" -tAq \
  -f bty-app/docs/audit/foundry_migration_provenance_readonly.sql > live_audit_result.r2.7.json
cd bty-app && npm run compare:foundry-migration-audit -- live_audit_result.r2.7.json
#    require: packet PASS · runtime attestation PASS · 93 effects / 93 exact / 0 conflict
```

**Then, and only then, the ledger.** Repair ascending — `20260726 → 20260727 → 20260728 → 20260729` — each marked applied only once its final-authority effects are exact. `20260804` is marked applied **last**, and only after step 2 confirms both body digests. Before and after, record what the pending list actually shows rather than assuming CLI behavior; the expected end state is that `20260802000000` and `20260803000000` are the **only** pending migrations. Applying those two needs **separate** authorization and is out of scope.

**STOP immediately if:** the live pre-apply bodies no longer match `52cc335a…` / `21cdd472…` (something changed after the forensic export); the transaction reports anything other than two `CREATE FUNCTION` replacements; a post-apply digest differs; the behavior smoke proof fails; the audit packet rejects; any unexpected pending migration appears; a repair order would produce an untruthful ledger; or `20260802`/`20260803` would be applied unintentionally.

**Rollback:** re-apply the authentic pre-reconciliation bodies, whose exact text is preserved as packet-bound fixtures in `live_body_set_shared_review.sql` and `live_body_submit_followup.sql`. The migration touches no rows, so there is nothing to undo in data. No deployment is required either way — this is DB-only, as `bb7347cb` already established for the 20260729 hotfix.
