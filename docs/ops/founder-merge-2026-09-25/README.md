# Founder account consolidation (A → B) — CLOSED

**Status: PRODUCTION CERTIFIED / CLOSED (2026-09-26).** The rollback ledger `bty_ops.founder_merge_ledger` is still in place; the rollback-window cleanup (`LEDGER_CLEANUP.sql`) is a separate, later operation and has **not** been run.

## Who is who

| | User id | Email | Notes |
|---|---|---|---|
| **B — canonical Founder** | `18b1ee80-2200-4bc6-91d7-039ba43f6a50` | `hc@bty-dso.com` | Holds platform admin, manual Foundry Host, org membership, PARTNER, CLINICAL_DIRECTOR |
| **A — retired shell** | `81f08aa1-44a2-40b1-9190-7866151461a7` | `retired+81f08aa1@bty-dso.invalid` | Banned until 2126-09-02. Kept, never deleted (Teams training delivery snapshots reference it `ON DELETE RESTRICT`) |

Tenant `10110d5c-bd30-467e-9912-e44e67777647`. Microsoft oids now on B: `f5767307-f693-4f8c-8e6c-5fb8a256b895` (hc@) and `644ff2ac-9135-4bcc-9669-c382986e4b60` (ddshanbit). The Google identity (`336defc0…`, ddshanbit@gmail.com) is also on B and stays there.

## Why this happened

The Founder used two separate Entra accounts in the same tenant, so the BTY Microsoft resolver (`bty_resolve_user_from_microsoft_identity`, keyed on tid + oid) correctly mapped them to two BTY users. A Teams "Save to BTY" landed on whichever account Teams was signed into, and Today only showed it when BTY was signed into the same account. There was no resolver bug; the fix was to move A's identities onto B, then A's product data.

## Production record

| Step | Result | Evidence |
|---|---|---|
| JWT TTL | **3600 s** | Measured from the production dashboard; locked into T2 |
| Pre-T1 measurement | PASS | Admin API + PostgREST, 2026-09-26T01:33:41Z |
| **T1** identity consolidation | **PASS** | `committed_marker` = `2026-09-25 18:38:50.43538-07`; after it, A had 0 identities / 0 sessions / 0 refresh tokens, B had 3 identities; resolver returned B for both oids (measured 01:42:35Z) |
| **Admin ban + email neutralization** | **PASS** | 2026-09-26T01:42:00Z. A `banned_until` = `2126-09-02T01:42:00Z`, email = `retired+81f08aa1@bty-dso.invalid`. B unchanged (`updated_at` still 2026-09-25T17:09:45Z) |
| T2 earliest start | `2026-09-25 19:43:50.43538-07` | T1 marker + 3600 s + 5 min |
| **T2** product consolidation | **PASS** (Founder-reported) | **56 rows rehomed** in the production run (the rehearsal stub had 55; T2 is count-agnostic by design). A authority removed, B authority preserved, XP / contracts / Arena / evidence unchanged, only the expected historical residue left on A |
| Acceptance — hc@ Microsoft → B | **PASS** (Founder-reported) | |
| Acceptance — ddshanbit Microsoft → B | **PASS** (Founder-reported) | |
| Canonical email stays `hc@bty-dso.com` | **PASS** | |
| **Teams Save → Today** (real device) | **PASS** (Founder-reported) | |

## Observed GoTrue behavior (now built into T2)

Changing A's email with the Admin API (`updateUserById({ email, email_confirm: true })`) made GoTrue **create a `provider = 'email'` identity** for the new address (`407cb412-70db-4dfd-bbea-54662f368501`), so A went from 0 identities to 1. The rehearsal had faked this step with a plain SQL update and could not show it.

That identity cannot sign anyone in: A is banned, the address is on the reserved `.invalid` TLD, there is no password, and the resolver only reads Microsoft identities. T2's gate therefore no longer requires a raw count of 0. It requires **no non-email identity** on A, and allows an `email` identity **only** for the `retired+81f08aa1@` address (see `T2_product_data_consolidation.sql`).

`email_confirm: true` skips the confirmation flow, but it does not guarantee that no email is sent: if email-change security notifications are enabled, the old address may be notified.

## Acceptance criteria (final)

Required:
- Microsoft hc@bty-dso.com → B
- Microsoft ddshanbit → B
- B's `auth.users.email` stays `hc@bty-dso.com`
- Real-device Teams Save → appears under Today → Saved

Not required: Google ddshanbit web login (not a product acceptance path). The Google identity is **not** deleted or unlinked because of this.

`ACCEPTANCE_canonical_email.sql` returns `required_acceptance_ok` for the SQL half; the Teams check is on-device.

## Files

| File | Purpose |
|---|---|
| `preflight_readonly.sql` | One read-only SELECT that measures the live auth/catalog shape |
| `T1_identity_consolidation.sql` / `T1_verify.sql` / `T1_rollback.sql` | Identity move, its check (valid between T1 and the Admin step), its reversal |
| `admin_api_ban_A.mjs` | Ban A and neutralize its email via the Admin API (dry-run by default) |
| `T2_product_data_consolidation.sql` / `T2_verify.sql` / `T2_rollback.sql` | Product data move, its ledger-driven check, its reversal |
| `ACCEPTANCE_canonical_email.sql` | Canonical-email + sign-in-path acceptance |
| `LEDGER_CLEANUP.sql` | **Not yet run.** After the rollback window: writes one counts-only audit row and drops the row-level ledger |

The T2 verification of Today is driven by T2's own `today_expectation` ledger marker (the ids that were active Saved captures on A when T2 ran). No capture id is hard-coded; capture `34a12089…` had legitimately been removed from Saved before T2, so it is correctly absent.

## Still open

- **Ledger retention:** run `LEDGER_CLEANUP.sql` after the rollback window (fill `__ROLLBACK_WINDOW_DAYS__`). After that, T1/T2 rollback is no longer possible.
- **Microsoft authority snapshot flip-flop** (code issue, not blocking): `bty_microsoft_authority_snapshots` is one row per user, so B's snapshot follows whichever of its two Microsoft accounts refreshed last. B's Founder authority does not depend on it.
