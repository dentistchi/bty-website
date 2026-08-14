// BUILD 26S-R1 — Atomic Apple Paid Fulfilment V1 migration pins.
//
// Asserts the SQL actually implements the ratified fulfilment contract rather than describing it
// in a comment: settlement that does NOT consult `is_active` (Contract B), a signature that cannot
// carry an entitlement fact, the account advisory lock reused rather than reinvented, the forced
// FK write order, a deterministic environment-scoped idempotency key, a compare-and-swap ledger
// transition, SYSTEM attribution that does not touch the manager credential model, and — the pin
// this build most needs — that the migration ALTERS NOTHING.
//
// Comments are STRIPPED before every assertion. This file's central claim is that the function
// never reads `is_active`, and the header talks about `is_active` at length; without stripping,
// the prose would satisfy the very assertion meant to exclude it. Pure static read — no DB.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260816120000_karaoke_apple_paid_fulfilment_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');

/** Strip `--` line comments so assertions can only match executable SQL. */
const sql = raw
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

/** The function body, between its `create or replace` and its terminating `$$;`. */
const body = (() => {
  const start = sql.indexOf('create or replace function public.fulfil_apple_purchase');
  expect(start, 'fulfil_apple_purchase declaration').toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('\n$$;', start);
  expect(end, 'function terminator').toBeGreaterThan(start);
  return sql.slice(start, end);
})();

describe('BUILD 26S — comment stripping is real', () => {
  it('strips prose so a comment can never satisfy an assertion', () => {
    expect(raw).toMatch(/ALREADY charged the customer/);
    expect(sql).not.toMatch(/ALREADY charged the customer/);
  });
});

describe('BUILD 26S — A: the migration is purely additive', () => {
  it('A1. creates exactly one function and nothing else', () => {
    expect(sql).toMatch(/create or replace function public\.fulfil_apple_purchase/);
    expect(sql.match(/create or replace function/g) ?? []).toHaveLength(1);
  });

  it('A2. ALTERS no table, adds no column, adds no constraint', () => {
    expect(sql).not.toMatch(/alter table/i);
    expect(sql).not.toMatch(/add column/i);
    expect(sql).not.toMatch(/add constraint/i);
  });

  it('A3. creates no table, index, trigger or type', () => {
    expect(sql).not.toMatch(/create (table|index|unique index|trigger|type)/i);
  });

  it('A4. backfills nothing and deletes nothing', () => {
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    // The only UPDATE is the ledger settlement itself, inside the function.
    expect(sql.match(/\bupdate public\./g) ?? []).toHaveLength(1);
    expect(body).toMatch(/update public\.karaoke_apple_purchases/);
  });

  it('A5. never activates or writes the catalog', () => {
    expect(sql).not.toMatch(/update public\.karaoke_product_catalog/i);
    expect(sql).not.toMatch(/insert into public\.karaoke_product_catalog/i);
    expect(sql).not.toMatch(/is_active\s*=\s*true/i);
  });
});

describe('BUILD 26S — B: Contract B, settlement does not consult is_active', () => {
  it('B1. the executable body never references is_active at all', () => {
    expect(body).not.toMatch(/is_active/);
  });

  it('B2. the catalog is read by NAMED columns, so is_active is not even loaded', () => {
    expect(body).toMatch(/select\s+c\.pass_type,\s*c\.duration_seconds,\s*c\.storekit_product_id/);
    expect(body).not.toMatch(/select\s+\*\s+into\s+v_cat/);
  });

  it('B3. duration comes from the catalog contract, never from a parameter', () => {
    expect(body).toMatch(/into v_pass_type, v_duration, v_cat_storekit/);
    expect(body).toMatch(/granted_seconds = v_duration/);
  });
});

describe('BUILD 26S — C: the signature cannot carry an entitlement fact', () => {
  it('C1. takes exactly two uuid parameters', () => {
    expect(sql).toMatch(/fulfil_apple_purchase\(\s*p_purchase_id uuid,\s*p_account_id\s+uuid\s*\)/);
  });

  it.each([
    'p_duration', 'p_pass_type', 'p_product', 'p_source_type', 'p_is_paid',
    'p_grant_status', 'p_issuance', 'p_idempotency', 'p_environment', 'p_transaction',
  ])('C2. has no %s parameter', (param) => {
    expect(sql).not.toMatch(new RegExp(`${param}\\w*\\s+(uuid|text|int|jsonb|boolean)`));
  });

  it('C3. the account scopes the lookup and can only cause a refusal', () => {
    expect(body).toMatch(/where id = p_purchase_id and account_id = p_account_id/);
    expect(body).toMatch(/'purchase_not_found'/);
    // account_id on the grant is taken from the PURCHASE row, never from the parameter.
    expect(body).toMatch(/values\s*\n?\s*\(v_p\.account_id,/);
  });
});

describe('BUILD 26S — D: lock and transaction order', () => {
  it('D1. reuses the existing timed-pass advisory lock namespace exactly', () => {
    expect(body).toMatch(/pg_advisory_xact_lock\(hashtext\('timed_pass:' \|\| v_p\.account_id::text\)\)/);
  });

  it('D2. locks the account BEFORE the purchase row (no inversion)', () => {
    const lock = body.indexOf('pg_advisory_xact_lock');
    const forUpdate = body.indexOf('for update');
    expect(lock).toBeGreaterThan(0);
    expect(forUpdate).toBeGreaterThan(lock);
  });

  it('D3. re-reads the purchase FOR UPDATE after taking the lock', () => {
    expect(body).toMatch(/for update/);
  });

  it('D4. inserts the grant BEFORE updating the purchase (the only legal FK order)', () => {
    const insertGrant = body.indexOf('insert into public.timed_access_pass_grants');
    const updatePurchase = body.indexOf('update public.karaoke_apple_purchases');
    expect(insertGrant).toBeGreaterThan(0);
    expect(updatePurchase).toBeGreaterThan(insertGrant);
  });

  it('D5. does not make any FK deferrable', () => {
    expect(sql).not.toMatch(/deferrable/i);
  });
});

describe('BUILD 26S — E: replay is decided before anything is written', () => {
  it('E1. the GRANTED branch precedes the grant INSERT', () => {
    const replay = body.indexOf("if v_p.grant_status = 'GRANTED' then");
    const insert = body.indexOf('insert into public.timed_access_pass_grants');
    expect(replay).toBeGreaterThan(0);
    expect(insert).toBeGreaterThan(replay);
  });

  it('E2. the replay branch returns without inserting or updating', () => {
    const replay = body.indexOf("if v_p.grant_status = 'GRANTED' then");
    const insert = body.indexOf('insert into public.timed_access_pass_grants');
    const branch = body.slice(replay, insert);
    expect(branch).not.toMatch(/\binsert into\b/);
    expect(branch).not.toMatch(/\bupdate public\./);
    expect(branch).toMatch(/'replayed', true/);
  });

  it('E3. every linkage fact is re-proven, and a mismatch hard-fails', () => {
    for (const detail of [
      'granted_linkage', 'grant_missing', 'grant_account',
      'grant_purchase_link', 'grant_not_paid', 'granted_seconds', 'grant_product',
    ]) {
      expect(body).toMatch(new RegExp(`'${detail}'`));
    }
    expect(body).toMatch(/ledger_invariant_conflict/);
  });
});

describe('BUILD 26S — F: validation refuses what must never be fulfilled', () => {
  it('F1. only VERIFIED purchases are settled', () => {
    expect(body).toMatch(/if v_p\.verification_status <> 'VERIFIED' then/);
    expect(body).toMatch(/'purchase_not_verified'/);
  });

  it('F2. a revoked grant is never silently re-issued', () => {
    expect(body).toMatch(/if v_p\.grant_status = 'GRANT_REVOKED' then/);
    expect(body).toMatch(/'grant_revoked'/);
  });

  it('F3. ledger and catalog product identity must agree', () => {
    expect(body).toMatch(/if v_cat_storekit is distinct from v_p\.storekit_product_id then/);
    expect(body).toMatch(/'product_identity_mismatch'/);
  });

  it('F4. no path repairs a drifted ledger', () => {
    // The ONLY UPDATE is the settlement compare-and-swap; nothing rewrites a conflicting row.
    expect(body).toMatch(/where id = v_p\.id and grant_status = 'NOT_GRANTED'/);
  });
});

describe('BUILD 26S — G: the grant is born unstarted and paid', () => {
  it('G1. status AVAILABLE, carryover 0, no manager', () => {
    expect(body).toMatch(/'PAID', true, v_p\.id,/);
    expect(body).toMatch(/v_p\.account_id, v_pass_type, v_duration, 0, 'AVAILABLE'/);
    expect(body).toMatch(/null, 'apple_purchase_fulfilment', v_key/);
  });

  it('G2. sets no lifecycle timestamp', () => {
    const insert = body.slice(
      body.indexOf('insert into public.timed_access_pass_grants'),
      body.indexOf('exception when unique_violation'),
    );
    for (const col of ['selected_at', 'activated_at', 'expires_at', 'expired_at', 'revoked_at']) {
      expect(insert).not.toMatch(new RegExp(col));
    }
  });

  it('G3. the idempotency key is deterministic, env-scoped, and built in the RPC', () => {
    expect(body).toMatch(/v_key := 'apple:' \|\| v_p\.environment \|\| ':' \|\| v_p\.apple_transaction_id/);
    expect(body).not.toMatch(/gen_random_uuid\(\)/);
    expect(body).not.toMatch(/v_key := .*now\(\)/);
  });
});

describe('BUILD 26S — H: the ledger transition preserves immutable Apple facts', () => {
  it('H1. the SET list touches only settlement columns', () => {
    const upd = body.slice(
      body.indexOf('update public.karaoke_apple_purchases'),
      body.indexOf('get diagnostics'),
    );
    expect(upd).toMatch(/grant_status\s*=\s*'GRANTED'/);
    expect(upd).toMatch(/pass_grant_id\s*=\s*v_new_id/);
    expect(upd).toMatch(/granted_seconds\s*=\s*v_duration/);
    expect(upd).toMatch(/processed_at\s*=\s*now\(\)/);
    for (const immutable of [
      'apple_transaction_id', 'apple_original_transaction_id', 'environment',
      'purchase_owner_ref', 'storekit_product_id', 'purchase_date',
      'signed_transaction_payload', 'signed_transaction_sha256',
      'verification_status', 'verified_at',
    ]) {
      expect(upd).not.toMatch(new RegExp(`${immutable}\\s*=`));
    }
  });

  it('H2. a lost compare-and-swap aborts the whole transaction', () => {
    expect(body).toMatch(/get diagnostics v_rows = row_count/);
    expect(body).toMatch(/if v_rows <> 1 then/);
    expect(body).toMatch(/raise exception/);
  });
});

describe('BUILD 26S — I: audit provenance', () => {
  it('I1. writes exactly one audit row, in the same transaction', () => {
    expect(body.match(/insert into public\.timed_access_pass_audit/g) ?? []).toHaveLength(1);
  });

  it('I2. attributes the issuance to SYSTEM and the purchase ledger row', () => {
    expect(body).toMatch(/'SYSTEM', v_p\.id::text, 'ISSUED', null, 'AVAILABLE'/);
  });

  it('I3. uses a NEW actor_kind and does not reuse manager credential semantics', () => {
    expect(body).toMatch(/'actor_kind',\s*'apple_storekit_transaction'/);
    expect(body).not.toMatch(/shared_manager_credential/);
    expect(body).not.toMatch(/bty_mgr/);
  });

  it('I4. carries the four keys timed_pass_issue_attribution_chk requires', () => {
    for (const key of ['version', 'source', 'actor_kind', 'actor_id']) {
      expect(body).toMatch(new RegExp(`'${key}',`));
    }
  });

  it('I5. stores the JWS DIGEST, never the payload', () => {
    expect(body).toMatch(/'jws_sha256',\s*v_p\.signed_transaction_sha256/);
    expect(body).not.toMatch(/signed_transaction_payload/);
  });
});

describe('BUILD 26S — J: execution authority', () => {
  it('J1. is SECURITY INVOKER, not DEFINER', () => {
    expect(sql).not.toMatch(/security definer/i);
  });

  it('J2. pins search_path', () => {
    expect(sql).toMatch(/set search_path = public, pg_temp/);
  });

  it('J3. revokes from public/anon/authenticated and grants only service_role', () => {
    expect(sql).toMatch(
      /revoke all on function public\.fulfil_apple_purchase\(uuid, uuid\) from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.fulfil_apple_purchase\(uuid, uuid\) to service_role/,
    );
    expect(sql).not.toMatch(/grant execute on function public\.fulfil_apple_purchase.* to (anon|authenticated|public)/);
  });
});

describe('BUILD 26S — K: nothing here finishes an Apple transaction', () => {
  it('K1. the executable body knows nothing about StoreKit lifecycle', () => {
    // Scoped to the body on purpose: the `comment on function` text legitimately states that this
    // function never finishes a transaction, and that sentence is executable SQL rather than a
    // stripped `--` comment. What must contain no finish concept is the LOGIC.
    expect(body).not.toMatch(/finish/i);
    expect(body).not.toMatch(/storekit_transaction_finished|transaction_finished/i);
  });
});
