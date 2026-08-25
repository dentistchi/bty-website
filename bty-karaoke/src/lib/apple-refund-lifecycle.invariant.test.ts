import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// BUILD 26U-R4E-R1 — invariants that must survive any future edit to the refund lifecycle.
// The behavioural proof lives in scripts/verify-r4e-refund.sh (real Postgres, every migration).
// These pin the CONTRACT in source so a change that breaks it fails here first.

/**
 * SQL with `--` comments stripped. Every scan below must measure the PROGRAM, not the prose
 * describing it: the first draft of REFUND-1 failed because the migration's own comment says
 * "NEVER 'switched_pass'", and a scan that reads commentary is not reading code. This repo has
 * hit that same class of false failure four times now across R4C/R4D.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n');
}

const MIGRATION = stripSqlComments(readFileSync(
  'supabase/migrations/20260827120000_karaoke_apple_refund_lifecycle_v1.sql', 'utf8'));
const SERVICE = readFileSync('src/lib/apple-server-notifications.server.ts', 'utf8');
const ROUTE = readFileSync('src/app/api/apple/server-notifications/route.ts', 'utf8');

describe('REFUND-1 — the refund reason is its own, never the voluntary-switch one', () => {
  it("writes revoke_reason = 'apple_refund'", () => {
    expect(MIGRATION).toContain("revoke_reason = 'apple_refund'");
  });

  it('NEVER writes switched_pass — that path carries time forward, a refund must not', () => {
    // The whole hazard R4E-R0 flagged: `switch_timed_access_pass` sets REVOKED *and* moves the
    // remaining seconds to the next pass. Reusing it for a refund would convert returned money
    // into free room time.
    const body = MIGRATION.slice(MIGRATION.indexOf('apply_apple_purchase_refund'));
    expect(body).not.toContain('switched_pass');
  });
});

describe('REFUND-2 — zero carryover', () => {
  it('the refund function never assigns carryover_seconds', () => {
    const fn = MIGRATION.slice(
      MIGRATION.indexOf('function public.apply_apple_purchase_refund'),
      MIGRATION.indexOf('function public.apply_apple_refund_reversal'));
    expect(fn).not.toMatch(/set[\s\S]{0,400}carryover_seconds\s*=/);
  });
});

describe('REFUND-3 — locate only by immutable Apple evidence', () => {
  it('the refund RPC takes no account or grant parameter', () => {
    const sig = MIGRATION.slice(
      MIGRATION.indexOf('function public.apply_apple_purchase_refund'),
      MIGRATION.indexOf('returns jsonb', MIGRATION.indexOf('function public.apply_apple_purchase_refund')));
    expect(sig).not.toContain('p_account_id');
    expect(sig).not.toContain('p_pass_grant_id');
    expect(sig).toContain('p_transaction_id');
  });

  it('the service never forwards a client-supplied identity', () => {
    expect(SERVICE).not.toMatch(/p_account_id|p_pass_grant_id/);
  });
});

describe('REFUND-4 — the documented lock order, in both functions', () => {
  it('session/account lock is taken before the timed-pass lock', () => {
    for (const fn of ['apply_apple_purchase_refund', 'apply_apple_refund_reversal']) {
      const body = MIGRATION.slice(MIGRATION.indexOf(`function public.${fn}`));
      const acct = body.indexOf('karaoke_account_lock_key');
      const pass = body.indexOf("hashtext('timed_pass:'");
      expect(acct, `${fn} takes the account lock`).toBeGreaterThan(-1);
      expect(pass, `${fn} takes the timed-pass lock`).toBeGreaterThan(-1);
      expect(acct, `${fn} takes them in the fixed order`).toBeLessThan(pass);
    }
  });
});

describe('REFUND-5 — signature before belief', () => {
  it('verifies the outer JWS before reading any claim', () => {
    const verify = SERVICE.indexOf('verifyAppleSignedTransaction(signedPayload)');
    const read = SERVICE.indexOf('body.notificationType');
    expect(verify).toBeGreaterThan(-1);
    expect(verify).toBeLessThan(read);
  });

  it('verifies the inner signedTransactionInfo too', () => {
    expect(SERVICE).toContain('verifyAppleSignedTransaction(signedTransactionInfo)');
  });

  it('reuses the proven 26P verifier rather than a second implementation', () => {
    expect(SERVICE).toContain("from './apple-iap.server'");
    expect(SERVICE).not.toMatch(/createVerify|crypto\.verify|new X509Certificate/);
  });
});

describe('REFUND-6 — retry semantics', () => {
  it('an unverifiable payload is refused 400 and never retried', () => {
    expect(ROUTE).toMatch(/unverifiable[\s\S]{0,200}status: 400/);
  });

  it('a processing failure returns 503 so Apple comes back', () => {
    expect(ROUTE).toContain('status: 503');
  });

  it('the endpoint reads only signedPayload', () => {
    expect(ROUTE).toContain('signedPayload');
    expect(ROUTE).not.toMatch(/accountId|passGrantId|purchaseId/);
  });
});

describe('REFUND-7 — a reversal compensates, it never resurrects', () => {
  it('never writes AVAILABLE/SELECTED/ACTIVE onto the original grant', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('function public.apply_apple_refund_reversal'));
    expect(fn).not.toMatch(/update public\.timed_access_pass_grants[\s\S]{0,300}set status\s*=\s*'(AVAILABLE|SELECTED|ACTIVE)'/);
  });

  it('issues the compensation from the frozen denied value, not a recomputed clock', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('function public.apply_apple_refund_reversal'));
    expect(fn).toContain('v_denied := coalesce(v_p.refund_denied_seconds, 0)');
  });

  it('one reversal can only ever produce one grant', () => {
    expect(MIGRATION).toContain('timed_pass_reversal_once_idx');
    expect(MIGRATION).toMatch(/unique index[\s\S]{0,120}reversal_notification_uuid/);
  });

  it('the compensation is not a second fulfilment of the Apple purchase', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('function public.apply_apple_refund_reversal'));
    expect(fn).toContain("'REFUND_REVERSAL', false");   // source_type, is_paid
    expect(fn).not.toContain('apple_purchase_id');
  });
});

describe('REFUND-8 — R4B/R4C/R4D stay frozen', () => {
  it('redefines none of their functions', () => {
    for (const fn of ['select_timed_access_pass', 'switch_timed_access_pass',
                      'issue_timed_access_pass', 'revoke_timed_access_pass',
                      'fulfil_apple_purchase', 'karaoke_start_premium_room_session',
                      'karaoke_premium_room_entitlement_at', 'karaoke_timed_pass_state_at']) {
      expect(MIGRATION, `${fn} must not be redefined`).not.toContain(`function public.${fn}`);
    }
  });

  it('leaves the audit immutability trigger alone', () => {
    expect(MIGRATION).not.toContain('timed_access_pass_audit_immutable');
  });

  it('does not poll Apple from any hot path', () => {
    expect(SERVICE).not.toMatch(/api\.storekit|Get Transaction History|setInterval|cron/i);
  });
});

describe('REFUND-9 — EXPIRED is not rewritten for financial labelling', () => {
  it('an already-EXPIRED grant stays EXPIRED with zero denied seconds', () => {
    const fn = MIGRATION.slice(
      MIGRATION.indexOf('function public.apply_apple_purchase_refund'),
      MIGRATION.indexOf('function public.apply_apple_refund_reversal'));
    expect(fn).toMatch(/v_g\.status = 'EXPIRED' then[\s\S]{0,300}v_to := 'EXPIRED'; v_denied := 0;/);
  });
});
