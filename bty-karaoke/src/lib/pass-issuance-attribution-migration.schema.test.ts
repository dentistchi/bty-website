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

describe('BUILD 26O-R1 — the idempotency replay boundary', () => {
  // `timed_pass_issue_idem_idx` is UNIQUE on (issue_idempotency_key) ALONE — global, not
  // account-scoped — and the key is CALLER-supplied. The pre-R1 read therefore returned another
  // account's grant as a success, and accepted a different pass_type as the same request.

  it('replays ONLY for the same account AND the same pass type', () => {
    expect(fn).toMatch(/v_existing\.account_id = p_account_id\s+and\s+v_existing\.pass_type = p_pass_type/);
  });

  it('fails closed with idempotency_conflict otherwise', () => {
    expect(fn).toContain("'idempotency_conflict'");
  });

  it('the conflict response leaks nothing about the row that owns the key', () => {
    // Find the conflict return and prove it carries no identity of the other grant.
    const idx = fn.indexOf("'idempotency_conflict'");
    const stmt = fn.slice(fn.lastIndexOf('return', idx), fn.indexOf(';', idx));
    for (const leak of ['v_existing.id', 'v_existing.status', 'v_existing.pass_type', 'v_existing.account_id', 'passGrantId']) {
      expect(stmt).not.toContain(leak);
    }
  });

  it('still returns reused:true on a genuine replay', () => {
    expect(fn).toContain("'reused', true");
    const replay = fn.slice(fn.indexOf('if v_existing.account_id = p_account_id'), fn.indexOf("'idempotency_conflict'"));
    expect(replay).toContain('v_existing.id');
  });

  it('keeps the lookup GLOBAL so a collision is detected rather than hidden', () => {
    // Narrowing the SELECT to the account would make the cross-account case look like a fresh
    // issue, and the global unique index would then surface it as a raw 23505.
    expect(fn).toMatch(/where issue_idempotency_key = v_key/);
    expect(fn).not.toMatch(/where issue_idempotency_key = v_key\s+and account_id/);
  });

  it('converts a CONCURRENT unique collision into the same typed conflict', () => {
    // The advisory lock is keyed by ACCOUNT, so it cannot serialize two accounts sharing a key.
    expect(fn).toMatch(/exception when unique_violation then/);
    const handler = fn.slice(fn.indexOf('exception when unique_violation then'));
    expect(handler).toContain("'idempotency_conflict'");
    // It must RETURN A FAILURE, never swallow into a success or a null.
    expect(handler.slice(0, handler.indexOf('end;'))).not.toMatch(/null;\s*$/);
    expect(handler.slice(0, handler.indexOf('end;'))).not.toContain("'ok', true");
  });

  it('catches ONLY unique_violation — never a blanket handler', () => {
    expect(fn).not.toMatch(/exception\s+when\s+others/i);
  });

  it('leaves the audit insert OUTSIDE the handler, so attribution failure still aborts', () => {
    const handlerEnd = fn.indexOf('exception when unique_violation then');
    const auditInsert = fn.indexOf('insert into public.timed_access_pass_audit');
    expect(auditInsert).toBeGreaterThan(handlerEnd);
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

    // Nothing may split the two inserts into independently-committable units.
    const between = fn.slice(grantInsert, auditInsert);
    expect(between).not.toMatch(/\bcommit\b/i);
    expect(between).not.toMatch(/\brollback\b/i);

    // R1 NOTE — this assertion originally forbade `exception` outright, and R1's narrow
    // unique_violation handler correctly tripped it. The handler is PERMITTED and the intent is
    // preserved, because it guards the GRANT insert alone and RETURNS: if it fires there is no
    // grant at all, and if it does not, execution reaches the audit insert in the same
    // transaction. What must stay forbidden is a handler that could let execution CONTINUE past
    // a failure — that is how a grant outlives its attribution.
    const handlers = between.match(/exception\s+when\s+([a-z_]+)/gi) ?? [];
    expect(handlers).toEqual(['exception when unique_violation']);
    const handlerBody = between.slice(between.indexOf('exception when unique_violation'));
    expect(handlerBody).toMatch(/return jsonb_build_object\('ok', false/);
    expect(handlerBody).not.toMatch(/\bnull\s*;/);
  });

  it('never updates metadata after the fact', () => {
    expect(sql).not.toMatch(/update\s+public\.timed_access_pass_audit\s+set/i);
  });
});

describe('BUILD 26O-R2 — the legacy signature is a wrapper, not a bypass', () => {
  // R1 DROPPED this signature, which was correct for R1 and unshippable: the deployed Worker
  // calls it, so removing it breaks issuance the instant the migration lands, and deploying the
  // Worker first breaks it the other way. R2 replaces it in place instead.

  const wrapper = (() => {
    const marker = 'p_manager_actor   text default \'bty_mgr\'';
    const start = sql.lastIndexOf('create or replace function public.issue_timed_access_pass', sql.indexOf(marker));
    expect(start).toBeGreaterThanOrEqual(0);
    return sql.slice(start, sql.indexOf('revoke all on function public.issue_timed_access_pass(uuid, text, text, text, text)', start));
  })();

  it('does NOT drop the legacy signature (that is the rollout gap)', () => {
    expect(sql).not.toMatch(/drop function if exists public\.issue_timed_access_pass\(uuid, text, text, text, text\)/);
  });

  it('re-declares it with the EXACT deployed parameter list, so the old call still resolves', () => {
    expect(wrapper).toMatch(/p_account_id\s+uuid/);
    expect(wrapper).toMatch(/p_pass_type\s+text/);
    expect(wrapper).toMatch(/p_reason\s+text/);
    expect(wrapper).toMatch(/p_idempotency_key text/);
    expect(wrapper).toMatch(/p_manager_actor\s+text default 'bty_mgr'/);
  });

  it('DELEGATES to the canonical function and inserts nothing itself', () => {
    expect(wrapper).toMatch(/return public\.issue_timed_access_pass\(/);
    expect(wrapper).not.toMatch(/insert\s+into/i);
  });

  it('stamps its own truthful legacy provenance', () => {
    expect(wrapper).toContain("'manager_issue_legacy_compat'");
    expect(wrapper).toContain("'shared_manager_credential'");
    expect(wrapper).toContain("'actor_id',   'bty_mgr'");
    expect(wrapper).toContain("'version',    1");
  });

  it('NEVER fabricates a token fingerprint — the legacy call has none', () => {
    expect(wrapper).not.toContain('session_fp');
  });

  it('refuses a non-shared actor rather than relabelling it', () => {
    expect(wrapper).toContain("'legacy_actor_not_supported'");
    expect(wrapper).toMatch(/v_actor <> 'bty_mgr'/);
  });

  it('claims no human identity anywhere', () => {
    for (const human of ['authenticated_human', 'email', 'operator_name', 'person']) {
      expect(wrapper).not.toContain(human);
    }
  });

  it('keeps the legacy signature service_role-only', () => {
    expect(sql).toMatch(
      /revoke all on function public\.issue_timed_access_pass\(uuid, text, text, text, text\) from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.issue_timed_access_pass\(uuid, text, text, text, text\) to service_role/,
    );
  });
});

describe('BUILD 26O — the canonical function carries no legacy actor parameter', () => {
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
    // R2 — idempotency for the functions is now `create or replace` on BOTH signatures rather
    // than a drop. That is not merely equivalent: replacing in place is what leaves no instant
    // in which the deployed Worker's function is missing. Both must be replaceable, so both are
    // pinned. (Proven behaviourally: the harness applies this migration three times.)
    const replaces = sql.match(/create or replace function public\.issue_timed_access_pass/g) ?? [];
    expect(replaces).toHaveLength(2);
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
