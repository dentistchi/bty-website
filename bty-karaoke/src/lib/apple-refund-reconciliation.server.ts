// BUILD 26U-R4G-R2-R1 — the retention-safe backstop (server-only, operator-invoked).
//
// THE ORDER OF AUTHORITY, and this file is the last of the three:
//   1. the live V2 notification
//   2. Notification History recovery (R4E-R3), bounded by Apple's 30/180-day retention
//   3. THIS — Get Refund History + Get Transaction Info, which outlive that window
//
// It is NOT a hot path. Nothing at app launch, My Norebang, selection, Start New Room, room join,
// queue, playback or QR reaches it.
//
// WHAT IT MAY AND MAY NOT DO. It fetches Apple-signed transactions, verifies each through the
// proven 26P verifier, records the verified CLAIMS as its own evidence, and then hands the
// decision to `@/domain/refund-reconciliation`. Where that decision is to write, it calls the
// SAME canonical RPCs the notification path calls — never a second refund implementation, never
// a manufactured notificationUUID, never an inbox row.

import { createSign, createHash } from 'node:crypto';
import { verifyAppleSignedTransaction } from './apple-iap.server';
import { karaokeDb } from './supabase.server';
import { optionalEnv } from './env.server';
import {
  decideReconciliation, isUnresolved,
  type AppleRefundSnapshot, type LocalRefundState, type ReconciliationDecision,
} from '@/domain/refund-reconciliation';

export const APPLE_API_HOSTS = {
  Sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
  Production: 'https://api.storekit.itunes.apple.com',
} as const;
export type AppleApiEnvironment = keyof typeof APPLE_API_HOSTS;

/** Apple returns at most 20 signed transactions per Refund History page. */
export const REFUND_HISTORY_PAGE_SIZE = 20;

const BUNDLE_ID = 'com.bty.BTYNorebangAdmin';
const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function mintToken(): string {
  const issuer = optionalEnv('KARAOKE_APPLE_IAP_ISSUER_ID');
  const keyId = optionalEnv('KARAOKE_APPLE_IAP_KEY_ID');
  const rawKey = optionalEnv('KARAOKE_APPLE_IAP_PRIVATE_KEY');
  if (!issuer || !keyId || !rawKey) throw new Error('iap_credentials_absent');
  const now = Math.floor(Date.now() / 1000);
  const input =
    `${b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))}.` +
    `${b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: BUNDLE_ID }))}`;
  const signer = createSign('SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${b64url(signer.sign({ key: rawKey.replace(/\\n/g, '\n'), dsaEncoding: 'ieee-p1363' }))}`;
}

/** A verified snapshot plus the digest of the exact bytes that produced it. */
interface VerifiedSnapshot { snapshot: AppleRefundSnapshot; digest: string; signedDate: number | null }

function toSnapshot(claims: Record<string, unknown>, environment: AppleApiEnvironment, jws: string): VerifiedSnapshot {
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    digest: sha256(jws),
    signedDate: num(claims.signedDate),
    snapshot: {
      environment,
      transactionId: String(claims.transactionId ?? ''),
      productId: typeof claims.productId === 'string' ? claims.productId : null,
      revocationDate: num(claims.revocationDate),
      revocationReason: (claims.revocationReason as number | string | undefined) ?? null,
      revocationType: typeof claims.revocationType === 'string' ? claims.revocationType : null,
      revocationPercentage: num(claims.revocationPercentage),
    },
  };
}

/**
 * Get Refund History for the customer this transaction belongs to.
 *
 * FULLY PAGINATED. Apple caps a page at 20 and continues through `revision` while `hasMore`; the
 * first page is not the history. `revision` is deliberately NOT checkpointed anywhere — a full
 * rescan has to stay safe regardless, because idempotency lives in the evidence digest and the
 * canonical RPCs, not in a cursor we remembered.
 */
export async function fetchRefundHistory(
  environment: AppleApiEnvironment,
  seedTransactionId: string,
  maxPages = 25,
): Promise<{ ok: boolean; records: VerifiedSnapshot[]; pages: number; unverifiable: number; error?: string }> {
  const host = APPLE_API_HOSTS[environment];
  const records: VerifiedSnapshot[] = [];
  let unverifiable = 0;
  let pages = 0;
  let revision: string | null = null;
  let token: string;
  try { token = mintToken(); } catch { return { ok: false, records, pages, unverifiable, error: 'credentials_unavailable' }; }

  do {
    const url = `${host}/inApps/v2/refund/lookup/${encodeURIComponent(seedTransactionId)}` +
      (revision ? `?revision=${encodeURIComponent(revision)}` : '');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false, records, pages, unverifiable, error: `refund_history_http_${res.status}` };
    const page = (await res.json()) as { signedTransactions?: string[]; hasMore?: boolean; revision?: string };
    pages += 1;

    for (const jws of page.signedTransactions ?? []) {
      // NOTHING is read from a claim before its signature chains to Apple's root.
      const verified = await verifyAppleSignedTransaction(jws);
      if (!verified.ok) { unverifiable += 1; continue; }
      records.push(toSnapshot(verified.claims as unknown as Record<string, unknown>, environment, jws));
    }
    revision = page.hasMore ? (page.revision ?? null) : null;
  } while (revision && pages < maxPages);

  return { ok: true, records, pages, unverifiable };
}

/** Get Transaction Info — the CURRENT state, and the only thing that may authorize a write. */
export async function fetchCurrentTransaction(
  environment: AppleApiEnvironment,
  transactionId: string,
): Promise<{ ok: boolean; verified?: VerifiedSnapshot; error?: string }> {
  const host = APPLE_API_HOSTS[environment];
  let token: string;
  try { token = mintToken(); } catch { return { ok: false, error: 'credentials_unavailable' }; }
  const res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, error: `transaction_http_${res.status}` };
  const body = (await res.json()) as { signedTransactionInfo?: string };
  if (!body.signedTransactionInfo) return { ok: false, error: 'no_signed_transaction' };
  const verified = await verifyAppleSignedTransaction(body.signedTransactionInfo);
  if (!verified.ok) return { ok: false, error: `unverifiable_${verified.code}` };
  return {
    ok: true,
    verified: toSnapshot(verified.claims as unknown as Record<string, unknown>, environment, body.signedTransactionInfo),
  };
}

export interface ReconcileRequest {
  environment: AppleApiEnvironment;
  /** Restrict to one transaction; otherwise every local paid purchase in the environment. */
  transactionId?: string;
  accountId?: string;
  limit?: number;
  /** Calls Apple, verifies, decides — and writes NOTHING. Not a lifecycle row, not an evidence row. */
  dryRun?: boolean;
}

export interface ReconcileOutcome {
  transactionId: string;
  action: ReconciliationDecision['action'];
  detail: string;
  applied?: string;
  evidenceId?: string | null;
}

export interface ReconcileReport {
  ok: boolean;
  environment: AppleApiEnvironment;
  dryRun: boolean;
  seeds: number;
  historyPages: number;
  candidates: number;
  unverifiable: number;
  noAction: number;
  alreadyApplied: number;
  appliedRefunds: number;
  appliedReversals: number;
  reversedBeforeWeSaw: number;
  /** Anything a human must look at. Drives the operator's exit status. */
  unresolved: number;
  outcomes: ReconcileOutcome[];
  error?: string;
}

/** Every local paid purchase we could ask Apple about. Seeds come from OUR ledger, never a client. */
async function localSeeds(req: ReconcileRequest): Promise<{ transactionId: string; accountId: string }[]> {
  let q = karaokeDb()
    .from('karaoke_apple_purchases')
    .select('apple_transaction_id, account_id, created_at')
    .eq('environment', req.environment)
    .order('created_at', { ascending: true });
  if (req.transactionId) q = q.eq('apple_transaction_id', req.transactionId);
  if (req.accountId) q = q.eq('account_id', req.accountId);
  if (req.limit) q = q.limit(req.limit);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({ transactionId: String(r.apple_transaction_id), accountId: String(r.account_id) }));
}

async function readLocal(environment: string, transactionId: string): Promise<LocalRefundState> {
  const { data, error } = await karaokeDb()
    .from('karaoke_apple_purchases')
    .select('environment, apple_transaction_id, revoked_at, refund_kind, refund_revocation_type, refund_revocation_percentage, refund_reversed_at')
    .eq('environment', environment)
    .eq('apple_transaction_id', transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { found: false };
  const r = data as Record<string, unknown>;
  return {
    found: true,
    environment: r.environment as 'Sandbox' | 'Production',
    transactionId: String(r.apple_transaction_id),
    revokedAt: (r.revoked_at as string | null) ?? null,
    refundKind: (r.refund_kind as 'FULL' | 'PRORATED' | null) ?? null,
    refundRevocationType: (r.refund_revocation_type as string | null) ?? null,
    refundRevocationPercentage: (r.refund_revocation_percentage as number | null) ?? null,
    refundReversedAt: (r.refund_reversed_at as string | null) ?? null,
  };
}

/**
 * Reconcile one environment against Apple's financial truth.
 *
 * The shape of every candidate is the same and the order is not negotiable: verified history is a
 * reason to LOOK, verified CURRENT state is the authority, the local ledger says what we already
 * did, and only when all three agree does anything get written.
 */
export async function reconcileAppleRefunds(req: ReconcileRequest): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    ok: false, environment: req.environment, dryRun: req.dryRun === true,
    seeds: 0, historyPages: 0, candidates: 0, unverifiable: 0,
    noAction: 0, alreadyApplied: 0, appliedRefunds: 0, appliedReversals: 0,
    reversedBeforeWeSaw: 0, unresolved: 0, outcomes: [],
  };
  if (!APPLE_API_HOSTS[req.environment]) { report.error = 'unknown_environment'; return report; }

  let seeds: { transactionId: string; accountId: string }[];
  try { seeds = await localSeeds(req); } catch { report.error = 'local_seed_read_failed'; return report; }
  report.seeds = seeds.length;

  // One Refund History call is CUSTOMER-scoped and may answer for several purchases, so the
  // account is the natural grouping. Correctness first: a seed whose account cannot be grouped
  // is simply queried on its own.
  const byAccount = new Map<string, string>();
  for (const s of seeds) if (!byAccount.has(s.accountId)) byAccount.set(s.accountId, s.transactionId);

  // The transactions we will actually decide: everything Apple's history mentions, PLUS every
  // local purchase — because "Apple has no refund for this" is also an answer worth checking.
  const candidates = new Map<string, AppleRefundSnapshot | null>();
  for (const s of seeds) if (!candidates.has(s.transactionId)) candidates.set(s.transactionId, null);

  for (const seed of byAccount.values()) {
    const history = await fetchRefundHistory(req.environment, seed);
    report.historyPages += history.pages;
    report.unverifiable += history.unverifiable;
    if (!history.ok) { report.error = history.error; return report; }
    for (const rec of history.records) {
      // §Y — never assume the seed IS the refund target. Each returned transaction resolves on
      // its own, and duplicates collapse.
      candidates.set(rec.snapshot.transactionId, rec.snapshot);
      if (!req.dryRun) await recordEvidence(rec, 'REFUND_HISTORY');
    }
  }
  report.candidates = candidates.size;

  for (const [transactionId, history] of candidates) {
    const current = await fetchCurrentTransaction(req.environment, transactionId);
    if (!current.ok || !current.verified) {
      report.unresolved += 1;
      report.outcomes.push({ transactionId, action: 'FAILED', detail: current.error ?? 'CURRENT_STATE_UNVERIFIABLE' });
      continue;
    }
    let evidenceId: string | null = null;
    if (!req.dryRun) evidenceId = await recordEvidence(current.verified, 'TRANSACTION_INFO');

    const local = await readLocal(req.environment, transactionId);
    const decision = decideReconciliation({ history, current: current.verified.snapshot, local });

    if (isUnresolved(decision)) {
      report.unresolved += 1;
      if (!req.dryRun && evidenceId) await markEvidence(evidenceId, 'FAILED', decision.detail);
      report.outcomes.push({ transactionId, action: decision.action, detail: decision.detail, evidenceId });
      continue;
    }

    if (decision.action === 'APPLY_REFUND' && decision.refund) {
      if (req.dryRun) {
        report.outcomes.push({ transactionId, action: decision.action, detail: 'DRY_RUN would apply refund' });
        report.appliedRefunds += 1;
        continue;
      }
      const { data, error } = await karaokeDb().rpc('apply_apple_purchase_refund', {
        p_environment: req.environment,
        p_transaction_id: transactionId,
        p_revocation_date: decision.refund.revocationDate != null
          ? new Date(decision.refund.revocationDate).toISOString() : null,
        p_revocation_reason: 'apple_refund',
        p_notification_uuid: null,
        p_revocation_type: current.verified.snapshot.revocationType,
        p_revocation_percentage: current.verified.snapshot.revocationPercentage,
        p_reconciliation_evidence_id: evidenceId,
      });
      const res = (data ?? {}) as Record<string, unknown>;
      if (error || res.ok !== true) {
        report.unresolved += 1;
        if (evidenceId) await markEvidence(evidenceId, 'FAILED', String(res.error ?? 'rpc'));
        report.outcomes.push({ transactionId, action: 'FAILED', detail: String(res.error ?? 'rpc'), evidenceId });
        continue;
      }
      report.appliedRefunds += 1;
      if (evidenceId) await markEvidence(evidenceId, 'APPLIED', `denied=${String(res.deniedSeconds ?? 0)}`);
      report.outcomes.push({ transactionId, action: decision.action, evidenceId,
        detail: `denied=${String(res.deniedSeconds ?? 0)} remainder=${String(res.remainderGrantId ?? 'none')}` });
      continue;
    }

    if (decision.action === 'APPLY_REVERSAL') {
      if (req.dryRun) {
        report.outcomes.push({ transactionId, action: decision.action, detail: 'DRY_RUN would apply reversal' });
        report.appliedReversals += 1;
        continue;
      }
      const { data, error } = await karaokeDb().rpc('apply_apple_refund_reversal', {
        p_environment: req.environment,
        p_transaction_id: transactionId,
        p_notification_uuid: null,
        p_reconciliation_evidence_id: evidenceId,
      });
      const res = (data ?? {}) as Record<string, unknown>;
      if (error || res.ok !== true) {
        report.unresolved += 1;
        if (evidenceId) await markEvidence(evidenceId, 'FAILED', String(res.error ?? 'rpc'));
        report.outcomes.push({ transactionId, action: 'FAILED', detail: String(res.error ?? 'rpc'), evidenceId });
        continue;
      }
      report.appliedReversals += 1;
      if (evidenceId) await markEvidence(evidenceId, 'APPLIED', `restored=${String(res.restoredSeconds ?? 0)}`);
      report.outcomes.push({ transactionId, action: decision.action, evidenceId,
        detail: `restored=${String(res.restoredSeconds ?? 0)}` });
      continue;
    }

    if (decision.action === 'NO_ACTION_REFUND_ALREADY_REVERSED') report.reversedBeforeWeSaw += 1;
    else if (decision.action === 'ALREADY_APPLIED') report.alreadyApplied += 1;
    else report.noAction += 1;
    if (!req.dryRun && evidenceId) await markEvidence(evidenceId, 'NO_ACTION', decision.detail);
    report.outcomes.push({ transactionId, action: decision.action, detail: decision.detail, evidenceId });
  }

  report.ok = true;
  return report;
}

async function recordEvidence(v: VerifiedSnapshot, source: 'REFUND_HISTORY' | 'TRANSACTION_INFO'): Promise<string | null> {
  const s = v.snapshot;
  const { data, error } = await karaokeDb().rpc('karaoke_record_reconciliation_evidence', {
    p_environment: s.environment,
    p_transaction_id: s.transactionId,
    p_original_transaction_id: null,
    p_evidence_source: source,
    p_signed_sha256: v.digest,
    p_apple_signed_date: v.signedDate != null ? new Date(v.signedDate).toISOString() : null,
    p_revocation_date: s.revocationDate != null ? new Date(s.revocationDate).toISOString() : null,
    p_revocation_reason: s.revocationReason != null ? String(s.revocationReason) : null,
    p_revocation_type: s.revocationType ?? null,
    p_revocation_percentage: s.revocationPercentage ?? null,
    p_product_id: s.productId ?? null,
  });
  if (error) return null;
  const r = (data ?? {}) as Record<string, unknown>;
  return r.ok === true ? String(r.evidenceId) : null;
}

async function markEvidence(id: string, status: string, detail: string): Promise<void> {
  await karaokeDb().rpc('karaoke_mark_reconciliation_evidence', {
    p_evidence_id: id, p_status: status, p_detail: detail,
  });
}
