// BUILD 26O — pass issuance actor attribution migration pins.
//
// THE DEFECT THIS CLOSES: `issue_timed_access_pass` wrote the issuer as a hardcoded 'bty_mgr'
// default and left `timed_access_pass_audit.metadata` NULL on every ISSUED row — measured on
// production as 53 ISSUED rows, 0 with metadata. An issuance could be proven to have happened
// and never proven to have been originated by anything.
//
// These pins are STRUCTURAL, over the migration text with comments STRIPPED, so no assertion can
// be satisfied by prose. The behavioural proof lives in supabase/tests/b26o (real Postgres).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260815120000_karaoke_pass_issuance_actor_attribution_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');
const sql = raw.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const fn = (() => {
  const start = sql.indexOf('create or replace function public.issue_timed_access_pass');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('revoke all on function public.issue_timed_access_pass', start);
  return sql.slice(start, end === -1 ? undefined : end);
})();

describe('BUILD 26O migration — the comment stripper works', () => {
  it('strips -- comments, so prose can never satisfy an assertion below', () => {
    expect(raw).toContain('-- BUILD 26O');
    expect(sql).not.toContain('-- BUILD 26O');
    // Non-vacuity: real SQL survived the stripping.
    expect(sql).toContain('create or replace function public.issue_timed_access_pass');
  });
});

describe('BUILD 26O — provenance is mandatory', () => {
  it('p_issuance is jsonb and has NO default', () => {
    expect(fn).toMatch(/p_issuance\s+jsonb/);
    // A default would let a caller omit provenance and still issue — the whole defect.
    expect(fn).not.toMatch(/p_issuance\s+jsonb\s+default/i);
  });

  it('refuses with a typed error when provenance is missing or malformed', () => {
    expect(fn).toContain("'issuance_provenance_required'");
    expect(fn).toMatch(/p_issuance is null/);
    expect(fn).toMatch(/jsonb_typeof\(p_issuance\) <> 'object'/);
  });

  it('requires every field the forensic record depends on', () => {
    for (const key of ['source', 'actor_kind', 'actor_id', 'version']) {
      expect(fn).toContain(`p_issuance->>'${key}'`);
    }
  });

  it('validates BEFORE the lock and before every write, so a refusal mutates nothing', () => {
    const refusal = fn.indexOf("'issuance_provenance_required'");
    const lock = fn.indexOf('pg_advisory_xact_lock');
    const grantInsert = fn.indexOf('insert into public.timed_access_pass_grants');
    const auditInsert = fn.indexOf('insert into public.timed_access_pass_audit');
    expect(refusal).toBeGreaterThan(0);
    expect(refusal).toBeLessThan(lock);
    expect(refusal).toBeLessThan(grantInsert);
    expect(refusal).toBeLessThan(auditInsert);
  });
});

describe('BUILD 26O — one actor context, two rows, one transaction', () => {
  it('the audit ISSUED row persists the provenance document in metadata', () => {
    const auditInsert = fn.slice(fn.indexOf('insert into public.timed_access_pass_audit'));
    expect(auditInsert).toMatch(/metadata/);
    expect(auditInsert).toMatch(/p_issuance/);
    expect(auditInsert).toContain("'ISSUED'");
  });

  it('grant.issued_by_manager and audit.actor_ref come from the SAME extracted actor', () => {
    // Two independently-passed parameters could disagree about who issued a pass; one variable
    // extracted once cannot.
    expect(fn).toMatch(/v_actor\s*:?=\s*nullif\(btrim\(coalesce\(p_issuance->>'actor_id'/);
    const grantInsert = fn.slice(fn.indexOf('insert into public.timed_access_pass_grants'));
    expect(grantInsert.slice(0, grantInsert.indexOf('insert into public.timed_access_pass_audit'))).toContain('v_actor');
    expect(fn.slice(fn.indexOf('insert into public.timed_access_pass_audit'))).toContain('v_actor');
  });

  it('writes the grant and its attribution in ONE function body (one transaction)', () => {
    const grantInsert = fn.indexOf('insert into public.timed_access_pass_grants');
    const auditInsert = fn.indexOf('insert into public.timed_access_pass_audit');
    expect(grantInsert).toBeGreaterThan(0);
    expect(auditInsert).toBeGreaterThan(grantInsert);
    // No commit/rollback/subtransaction between them — a partial outcome must be impossible.
    const between = fn.slice(grantInsert, auditInsert);
    expect(between).not.toMatch(/\bcommit\b|\brollback\b|\bexception\b/i);
  });

  it('never updates metadata after the fact', () => {
    expect(sql).not.toMatch(/update\s+public\.timed_access_pass_audit\s+set/i);
  });
});

describe('BUILD 26O — the unattributed path is retired, not left beside the new one', () => {
  it('drops the legacy 5-text signature', () => {
    expect(sql).toMatch(
      /drop function if exists public\.issue_timed_access_pass\(uuid, text, text, text, text\)/,
    );
  });

  it('does not reintroduce a hardcoded actor default', () => {
    expect(fn).not.toMatch(/default\s+'bty_mgr'/);
    expect(fn).not.toMatch(/p_manager_actor/);
  });

  it('keeps execution to service_role only', () => {
    expect(sql).toMatch(
      /revoke all on function public\.issue_timed_access_pass\(uuid, text, text, text, jsonb\) from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.issue_timed_access_pass\(uuid, text, text, text, jsonb\) to service_role/,
    );
  });
});

describe('BUILD 26O — structural floor, and NO backfill', () => {
  it('adds a CHECK that a new ISSUED audit row carries provenance', () => {
    expect(sql).toContain('timed_pass_issue_attribution_chk');
    expect(sql).toMatch(/action <> 'ISSUED'/);
    for (const key of ['version', 'source', 'actor_kind', 'actor_id']) {
      expect(sql).toContain(`metadata ? '${key}'`);
    }
  });

  it('adds it NOT VALID, so historical rows are never examined or edited', () => {
    expect(sql).toMatch(/not valid/i);
  });

  it('is idempotent — re-applying adds no duplicate constraint', () => {
    expect(sql).toMatch(/if not exists \(select 1 from pg_constraint where conname = 'timed_pass_issue_attribution_chk'\)/);
    expect(sql).toMatch(/drop function if exists/);
  });

  it('BACKFILLS NOTHING — no UPDATE or DELETE against any pass table', () => {
    // The single most important assertion in this file. Attributing 53 historical rows to
    // 'bty_mgr' because the route uses 'bty_mgr' today would manufacture evidence about the past
    // from a fact about the present.
    expect(sql).not.toMatch(/update\s+public\.timed_access_pass_audit/i);
    expect(sql).not.toMatch(/update\s+public\.timed_access_pass_grants/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.timed_access_pass_audit/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.timed_access_pass_grants/i);
    expect(sql).not.toMatch(/\bvalidate\s+constraint\b/i);
  });

  it('touches no commerce object', () => {
    expect(sql).not.toMatch(/karaoke_apple_purchases|karaoke_product_catalog|is_active|storekit/i);
  });

  it('changes no pass duration, carryover, activation, expiry, selection or switch authority', () => {
    for (const forbidden of [
      'timed_pass_expiry_math_chk',
      'timed_pass_duration_matches_type',
      'carryover_seconds',
      'select_timed_access_pass',
      'switch_timed_access_pass',
      'karaoke_begin_song',
      'revoke_timed_access_pass',
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it('preserves the pre-existing issuance semantics verbatim', () => {
    expect(fn).toContain("'invalid_pass_type'");
    expect(fn).toContain("'idempotency_key_required'");
    expect(fn).toContain("'account_not_found'");
    expect(fn).toContain("'account_is_pro'");
    expect(fn).toMatch(/pg_advisory_xact_lock\(hashtext\('timed_pass:'/);
    expect(fn).toMatch(/when 'ONE_HOUR' then 3600 when 'FOUR_HOURS' then 14400 else 86400/);
    expect(fn).toMatch(/issue_idempotency_key = v_key/);
    expect(fn).toContain("'reused', true");
  });
});
