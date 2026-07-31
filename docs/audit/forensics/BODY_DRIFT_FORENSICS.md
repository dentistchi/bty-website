# Live function body drift — forensics + reconciliation plan (Slice 3.2I-R5B1A.1-R2.7)

**Verdict: HALTED · TRUSTED LIVE FUNCTION BODY TEXT ABSENT.**
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
