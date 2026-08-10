// BUILD 26L — App Store Commerce Ledger Foundation V1 (Track B, Slice 2) migration pins.
//
// Asserts the SQL actually implements the locked commerce rules rather than describing
// them in a comment: environment-qualified Apple transaction uniqueness (FD-3), a purchase
// ledger that cannot be cascade-deleted with an account (FD-4.3), a server-side duration
// catalog that a client cannot override, a structural paid/promotional split, and a
// legacy backfill that classifies only what it can prove.
//
// Comments are STRIPPED before every assertion. A migration that merely *mentions*
// `on delete restrict` in prose while declaring `on delete cascade` in DDL would otherwise
// pass, which would make this whole file decorative. Pure static read — no DB.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260811120000_karaoke_commerce_ledger_foundation_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');

/** Strip `--` line comments so assertions can only match executable SQL. */
const sql = raw
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

/** The section of `sql` that declares one table, up to the next top-level statement. */
function tableBlock(name: string): string {
  const start = sql.indexOf(`create table if not exists public.${name}`);
  expect(start, `${name} table declaration`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('\ncreate ', start + 1);
  return sql.slice(start, end === -1 ? undefined : end);
}

describe('BUILD 26L — commerce ledger migration: comment stripping is real', () => {
  it('strips prose so a comment can never satisfy a DDL assertion', () => {
    // The header genuinely contains the words below in prose; the stripped SQL must not.
    expect(raw).toMatch(/NEVER CASCADE/);
    expect(sql).not.toMatch(/NEVER CASCADE/);
  });
});

describe('BUILD 26L — A/B: commerce objects exist', () => {
  it('A. creates the Apple purchase ledger', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_apple_purchases/);
  });

  it('B. creates the StoreKit product catalog', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_product_catalog/);
  });
});

describe('BUILD 26L — C: transaction uniqueness is environment-qualified (FD-3)', () => {
  it('C. the unique index is (environment, apple_transaction_id)', () => {
    expect(sql).toMatch(
      /create unique index if not exists karaoke_apple_purchases_env_txn_idx\s+on public\.karaoke_apple_purchases \(environment, apple_transaction_id\)/,
    );
  });

  it('C. no unique index is built on apple_transaction_id ALONE', () => {
    // A bare-ID unique index would let a sandbox collision silently reject a real
    // production purchase — charged customer, nothing delivered.
    expect(sql).not.toMatch(/create unique index[\s\S]{0,200}?\(apple_transaction_id\)/);
  });

  it('C. environment is constrained to the two Apple ID spaces', () => {
    expect(sql).toMatch(/environment\s+text not null check \(environment in \('Sandbox', 'Production'\)\)/);
  });
});

describe('BUILD 26L — D/M/N: the purchase ledger survives account deletion', () => {
  const block = () => tableBlock('karaoke_apple_purchases');

  it('D. account_id is ON DELETE RESTRICT, not CASCADE (Track B0 FD-4.3)', () => {
    expect(block()).toMatch(
      /account_id\s+uuid not null references public\.karaoke_accounts\(id\) on delete restrict/,
    );
  });

  it('N. no foreign key in the purchase ledger cascades or nulls on delete', () => {
    for (const [, action] of block().matchAll(/on delete (\w+)/g)) {
      expect(action).toBe('restrict');
    }
  });

  it('M. the ledger binds to the retained BUILD 26E purchase_owner_ref handle', () => {
    // 26E created purchase_owner_ref precisely so Apple never sees the account UUID, and
    // it is retained (not rotated) on the deletion tombstone.
    expect(block()).toMatch(/purchase_owner_ref\s+uuid not null/);
    expect(sql).toMatch(/create index if not exists karaoke_apple_purchases_owner_ref_idx/);
  });

  it('M. does NOT re-create or alter the BUILD 26E account authority columns', () => {
    expect(sql).not.toMatch(/alter table public\.karaoke_accounts/);
    expect(sql).not.toMatch(/add column if not exists purchase_owner_ref/);
    expect(sql).not.toMatch(/add column if not exists authority_ref/);
  });
});

describe('BUILD 26L — E: no client role can touch the purchase ledger', () => {
  it('E. revokes public/anon/authenticated on both commerce tables', () => {
    expect(sql).toMatch(/revoke all on table public\.karaoke_apple_purchases from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on table public\.karaoke_product_catalog from public, anon, authenticated/);
  });

  it('E. enables RLS on both commerce tables (fail closed)', () => {
    expect(sql).toMatch(/alter table public\.karaoke_apple_purchases enable row level security/);
    expect(sql).toMatch(/alter table public\.karaoke_product_catalog enable row level security/);
  });

  it('E. grants write on the ledger to service_role ONLY', () => {
    expect(sql).toMatch(/grant select, insert, update on table public\.karaoke_apple_purchases to service_role/);
    for (const [, role] of sql.matchAll(/grant [^;]*on table public\.karaoke_apple_purchases to (\w+)/g)) {
      expect(role).toBe('service_role');
    }
  });

  it('E. never grants anon/authenticated anything on either commerce table', () => {
    expect(sql).not.toMatch(/grant [^;]*public\.karaoke_apple_purchases to [^;]*(anon|authenticated)/);
    expect(sql).not.toMatch(/grant [^;]*public\.karaoke_product_catalog to [^;]*(anon|authenticated)/);
  });

  // NAMED FOR WHAT IT ACTUALLY PINS. The migration grants the catalog no write privilege,
  // which is the intent. It does NOT make the catalog read-only in effect: Supabase's
  // pg_default_acl grants arwdDxtm to service_role on every new table in `public`, so
  // service_role retains write access here exactly as it does on every pre-existing table
  // in this database (karaoke_accounts, timed_access_pass_grants, timed_access_pass_audit
  // all measured identical). Making it genuinely read-only needs an explicit REVOKE and is
  // a database-wide policy question, not a BUILD 26L one — recorded, not silently implied.
  it('E. the migration itself grants the catalog no write privilege', () => {
    expect(sql).toMatch(/grant select on table public\.karaoke_product_catalog to service_role/);
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]*on table public\.karaoke_product_catalog/);
  });

  it('E. creates no RLS policy that would re-open the tables to a client role', () => {
    expect(sql).not.toMatch(/create policy/i);
  });
});

describe('BUILD 26L — F/G: the catalog is the server-side duration authority', () => {
  it('F. product_code and storekit_product_id are both unique', () => {
    expect(sql).toMatch(
      /create unique index if not exists karaoke_product_catalog_code_idx\s+on public\.karaoke_product_catalog \(product_code\)/,
    );
    expect(sql).toMatch(
      /create unique index if not exists karaoke_product_catalog_storekit_idx\s+on public\.karaoke_product_catalog \(storekit_product_id\)/,
    );
  });

  it('F. seeds exactly the three ratified FD-1 Product IDs', () => {
    for (const id of [
      'com.btydaily.norebang.pass.1hour',
      'com.btydaily.norebang.pass.4hour',
      'com.btydaily.norebang.pass.24hour',
    ]) {
      expect(sql).toContain(`'${id}'`);
    }
    const ids = [...sql.matchAll(/'com\.btydaily\.norebang\.pass\.[^']*'/g)];
    expect(ids).toHaveLength(3);
  });

  it('G. duration cannot contradict pass type', () => {
    expect(sql).toMatch(/constraint karaoke_product_catalog_duration_matches_type check \(/);
    expect(sql).toMatch(/pass_type = 'ONE_HOUR'\s+and duration_seconds = 3600/);
    expect(sql).toMatch(/pass_type = 'FOUR_HOURS'\s+and duration_seconds = 14400/);
    expect(sql).toMatch(/pass_type = 'TWENTY_FOUR_HOURS' and duration_seconds = 86400/);
    expect(sql).toMatch(/duration_seconds\s+int\s+not null check \(duration_seconds > 0\)/);
  });

  it('G. each seeded Product ID maps to its contract duration', () => {
    expect(sql).toMatch(/'com\.btydaily\.norebang\.pass\.1hour',\s*'ONE_HOUR',\s*3600,/);
    expect(sql).toMatch(/'com\.btydaily\.norebang\.pass\.4hour',\s*'FOUR_HOURS',\s*14400,/);
    expect(sql).toMatch(/'com\.btydaily\.norebang\.pass\.24hour',\s*'TWENTY_FOUR_HOURS',\s*86400,/);
  });

  it('G. seeds every product INACTIVE — a DB seed cannot create an App Store product', () => {
    const seed = sql.slice(sql.indexOf('insert into public.karaoke_product_catalog'));
    const tail = seed.slice(0, seed.indexOf(';'));
    expect(tail).not.toMatch(/,\s*true,\s*\d+\)/); // (…, is_paid, is_active, display_order)
    expect(tail.match(/false, \d+\)/g) ?? []).toHaveLength(3);
  });

  it('G. the seed is idempotent', () => {
    expect(sql).toMatch(/on conflict \(product_code\) do nothing/);
  });

  it('G. price is NEVER entitlement authority — no price column exists', () => {
    expect(sql).not.toMatch(/\b(price|currency|amount|display_price|price_tier)\b/i);
    expect(sql).not.toContain('1.99');
    expect(sql).not.toContain('4.99');
    expect(sql).not.toContain('9.99');
  });
});

describe('BUILD 26L — H/I/J: paid vs promotional is structural', () => {
  it('H. the grant carries source_type / is_paid / apple_purchase_id', () => {
    expect(sql).toMatch(/add column if not exists source_type\s+text/);
    expect(sql).toMatch(/add column if not exists is_paid\s+boolean/);
    expect(sql).toMatch(
      /add column if not exists apple_purchase_id uuid references public\.karaoke_apple_purchases \(id\) on delete restrict/,
    );
  });

  it('H. source_type is constrained to the four contract values', () => {
    expect(sql).toMatch(
      /constraint timed_pass_source_type_chk\s+check \(source_type in \('PAID', 'WELCOME', 'REFERRAL', 'MANUAL_PROMOTIONAL'\)\)/,
    );
  });

  it('I. apple_purchase_id must be NULL for every non-paid grant (18C invariant 13)', () => {
    expect(sql).toMatch(/constraint timed_pass_paid_linkage_chk/);
    expect(sql).toMatch(/source_type <> 'PAID' and is_paid = false and apple_purchase_id is null/);
    expect(sql).toMatch(/source_type = 'PAID'\s+and is_paid = true\s+and apple_purchase_id is not null/);
  });

  it('J. the purchase <-> paid grant relation is 1:1 in BOTH directions', () => {
    // One purchase cannot fan out to two grants...
    expect(sql).toMatch(
      /create unique index if not exists timed_pass_apple_purchase_idx\s+on public\.timed_access_pass_grants \(apple_purchase_id\) where apple_purchase_id is not null/,
    );
    // ...and two purchases cannot claim the same grant.
    expect(sql).toMatch(
      /create unique index if not exists karaoke_apple_purchases_pass_grant_idx\s+on public\.karaoke_apple_purchases \(pass_grant_id\) where pass_grant_id is not null/,
    );
  });

  it('J. a GRANTED purchase must name the pass it produced', () => {
    expect(sql).toMatch(/constraint karaoke_apple_purchases_grant_linkage_chk/);
    expect(sql).toMatch(/grant_status = 'NOT_GRANTED' and pass_grant_id is null and granted_seconds is null/);
  });
});

describe('BUILD 26L — K/L: the legacy backfill proves rather than assumes', () => {
  it('K. backfills only rows with actual issuance provenance', () => {
    expect(sql).toMatch(
      /update public\.timed_access_pass_grants\s+set source_type = 'MANUAL_PROMOTIONAL',\s+is_paid\s+= false\s+where source_type is null\s+and issued_by_manager is not null/,
    );
  });

  it('K. refuses to apply if any grant cannot be proven non-paid (fail closed)', () => {
    expect(sql).toMatch(/select count\(\*\) into v_unclassified/);
    expect(sql).toMatch(/raise exception\s*\n?\s*'BUILD 26L: % timed_access_pass_grants row\(s\) carry no issuance provenance/);
  });

  it('K/L. the backfill touches ONLY the three new columns — never id, status or times', () => {
    const update = sql.slice(sql.indexOf('update public.timed_access_pass_grants'));
    const stmt = update.slice(0, update.indexOf(';'));
    for (const forbidden of [
      'id', 'account_id', 'pass_type', 'duration_seconds', 'status',
      'activated_at', 'expires_at', 'expired_at', 'revoked_at', 'selected_at', 'created_at',
    ]) {
      expect(stmt, `backfill must not set ${forbidden}`).not.toMatch(
        new RegExp(`(set|,)\\s*${forbidden}\\s*=`),
      );
    }
  });

  it('L. never deletes, truncates or recreates an existing pass row', () => {
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/drop table/i);
  });

  it('L. does not hardcode a row count — it works against the measured population', () => {
    expect(sql).not.toMatch(/limit \d+/i);
    expect(sql).not.toMatch(/backfill 5 rows/i);
  });
});

describe('BUILD 26L — BUILD 26E non-duplication', () => {
  it('does NOT re-relax timed_pass_status_time_chk (already done in 20260809120000)', () => {
    expect(sql).not.toMatch(/timed_pass_status_time_chk/);
  });

  it('the 26E relaxation is still the deployed shape (regression pin, read from 26E)', () => {
    const e26 = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260809120000_karaoke_account_deletion_authority_v1.sql'),
      'utf8',
    )
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n');
    // Refund-after-use must remain representable: REVOKED retaining activation facts.
    expect(e26).toMatch(
      /when 'REVOKED'\s+then revoked_at is not null and \([\s\S]*?or \(activated_at is not null and expires_at is not null\)\)/,
    );
  });

  it('does not touch the account tombstone or deletion authority', () => {
    expect(sql).not.toMatch(/karaoke_delete_host_account|account_status|deleted_at\s*=/);
  });
});

describe('BUILD 26L — audit domain is widened, never emitted', () => {
  it('extends the action domain to a STRICT SUPERSET of the deployed six', () => {
    const m = sql.match(/check \(action in \(([^)]*)\)\)/);
    expect(m, 'audit action CHECK').not.toBeNull();
    const values = [...m![1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
    for (const deployed of ['ISSUED', 'SELECTED', 'DESELECTED', 'ACTIVATED', 'EXPIRED', 'REVOKED']) {
      expect(values, `deployed action ${deployed} must remain valid`).toContain(deployed);
    }
    for (const added of ['PURCHASE_VERIFIED', 'REFUND_RECEIVED', 'REVOKED_AFTER_USE']) {
      expect(values).toContain(added);
    }
    expect(values).toHaveLength(9);
  });

  it('writes no audit row, no purchase row and no grant — the migration grants nothing', () => {
    expect(sql).not.toMatch(/insert into public\.timed_access_pass_audit/);
    expect(sql).not.toMatch(/insert into public\.karaoke_apple_purchases/);
    expect(sql).not.toMatch(/insert into public\.timed_access_pass_grants/);
  });
});

describe('BUILD 26L — slice discipline (no Slice 3/4 creep)', () => {
  it('adds no purchase RPC, verification function or notification receiver', () => {
    expect(sql).not.toMatch(/create or replace function/i);
    expect(sql).not.toMatch(/apple_transaction_verify|verify_apple|app_store_notification/i);
  });

  it('does not alter the activation boundary — purchase never activates a pass', () => {
    expect(sql).not.toMatch(/karaoke_begin_song/);
    expect(sql).not.toMatch(/issue_timed_access_pass|select_timed_access_pass|revoke_timed_access_pass/);
  });
});
