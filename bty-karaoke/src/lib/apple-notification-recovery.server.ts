// BUILD 26U-R4E-R3-R1 — recovering notifications Apple already sent (server-only).
//
// WHAT RECOVERY MEANS HERE, precisely:
//
//   Apple already produced an authoritative signed event
//   -> BTY later retrieves THAT SAME signed event from Get Notification History
//   -> BTY verifies it exactly as if it had arrived live
//   -> the SAME canonical handler applies it
//   -> the UNIQUE notificationUUID makes delivery order irrelevant
//
// What it must never mean: guessing that a refund probably happened, or manufacturing a
// notification identity. Nothing in this file constructs a notificationUUID, and nothing here
// touches a purchase or a grant — it fetches bytes Apple signed and hands them to the existing
// handler, which owns every decision.
//
// NOT IN ANY HOT PATH. Operator-invoked only. Nothing at app launch, My Norebang, selection,
// Start New Room, room join, playback, queue or QR reaches this module.

import { createSign } from 'node:crypto';
import { handleAppleServerNotification } from './apple-server-notifications.server';
import { optionalEnv } from './env.server';

/** Sandbox and Production are named explicitly; there is no inferred default. */
export const APPLE_API_HOSTS = {
  Sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
  Production: 'https://api.storekit.itunes.apple.com',
} as const;
export type AppleApiEnvironment = keyof typeof APPLE_API_HOSTS;

/**
 * Apple's own retention limits, recorded because they bound what recovery can ever fix:
 *   Sandbox    Notification History   30 days
 *   Production Notification History  180 days
 *   page size  20 records, paginationToken + hasMore
 * A gap longer than the window is unrecoverable from this source — which is the argument for a
 * cadence later, and the reason this file does not pretend history is unlimited.
 */
export const NOTIFICATION_HISTORY_RETENTION_DAYS = { Sandbox: 30, Production: 180 } as const;

const BUNDLE_ID = 'com.bty.BTYNorebangAdmin';
const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** Mint an App Store Server API token. ES256 with the raw r||s pair — DER is rejected as a bad signature. */
function mintToken(): string {
  // Fail closed and name what is missing: an absent credential must never be reported as
  // "Apple says there are no notifications".
  const issuer = optionalEnv('KARAOKE_APPLE_IAP_ISSUER_ID');
  const keyId = optionalEnv('KARAOKE_APPLE_IAP_KEY_ID');
  const rawKey = optionalEnv('KARAOKE_APPLE_IAP_PRIVATE_KEY');
  if (!issuer || !keyId || !rawKey) throw new Error('iap_credentials_absent');
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const input =
    `${b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))}.` +
    `${b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: BUNDLE_ID }))}`;
  const signer = createSign('SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${b64url(signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }))}`;
}

export interface RecoveryRequest {
  environment: AppleApiEnvironment;
  /** Bounded window. Required: an unbounded scan is not a recovery, it is a crawl. */
  startDate: number;
  endDate: number;
  /** Narrow to one transaction when it is known — the most precise form of recovery. */
  transactionId?: string;
  /** Safety rail on pagination; a runaway loop is never the right answer to a paging bug. */
  maxPages?: number;
}

/**
 * BUILD 26U-R4G-R1 — the counts an operator can actually act on.
 *
 * The previous shape had one `duplicates` bucket, and it concealed the thing recovery exists to
 * find: a FAILED row replayed as "duplicate (already recorded)", so a run that had repaired
 * nothing printed the same clean summary as a run with nothing to repair.
 *
 * `unfinished` is the number that matters. It is the count of VERIFIED FINANCIAL events in the
 * scanned window that did not reach a handled state, and it is what makes the command exit
 * non-zero — because an all-green summary must actually mean no money event is left hanging.
 */
export interface RecoveryReport {
  ok: boolean;
  environment: AppleApiEnvironment;
  pages: number;
  fetched: number;
  verified: number;
  unverifiable: number;
  /** First application of an event we had never recorded. */
  newlyApplied: number;
  /** An UNFINISHED row (RECEIVED or FAILED) picked back up and completed. This is a repair. */
  reprocessed: number;
  /** A prior row was already APPLIED or IGNORED. Nothing was re-run. */
  alreadyHandled: number;
  /** Verified, recorded, deliberately not acted on. */
  ignored: number;
  /** Processing failed on this run. */
  failed: number;
  /** Verified FINANCIAL events still not handled after this run. Drives the exit status. */
  unfinished: number;
  details: string[];
  error?: string;
}

/**
 * Fetch every notification Apple recorded in the window and replay each through the canonical
 * handler. Returns counts; it decides nothing about entitlement itself.
 */
export async function recoverAppleNotifications(req: RecoveryRequest): Promise<RecoveryReport> {
  const report: RecoveryReport = {
    ok: false, environment: req.environment, pages: 0, fetched: 0, verified: 0,
    unverifiable: 0, newlyApplied: 0, reprocessed: 0, alreadyHandled: 0, ignored: 0,
    failed: 0, unfinished: 0, details: [],
  };
  const host = APPLE_API_HOSTS[req.environment];
  if (!host) { report.error = 'unknown_environment'; return report; }

  let token: string;
  try { token = mintToken(); } catch { report.error = 'credentials_unavailable'; return report; }

  const maxPages = req.maxPages ?? 25;
  let paginationToken: string | null = null;

  do {
    const url = `${host}/inApps/v1/notifications/history` +
      (paginationToken ? `?paginationToken=${encodeURIComponent(paginationToken)}` : '');
    const body: Record<string, unknown> = { startDate: req.startDate, endDate: req.endDate };
    if (req.transactionId) body.transactionId = req.transactionId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      report.error = `history_http_${res.status}`;
      return report;
    }
    const page = (await res.json()) as {
      notificationHistory?: { signedPayload?: string }[];
      hasMore?: boolean;
      paginationToken?: string;
    };
    report.pages += 1;

    for (const item of page.notificationHistory ?? []) {
      const signedPayload = item.signedPayload;
      if (typeof signedPayload !== 'string' || signedPayload === '') {
        report.unverifiable += 1;
        report.details.push('item without signedPayload');
        continue;
      }
      report.fetched += 1;

      // THE SAME HANDLER. Verification, bundle/environment checks, transaction lookup, dedupe and
      // the refund/reversal RPCs are all its business, unchanged. Recovery differs by ONE
      // argument: how the event was discovered.
      const outcome = await handleAppleServerNotification(signedPayload, 'API_RECOVERY');
      if (!outcome.ok) {
        // A financial event that did not finish is counted as UNFINISHED whichever way it failed,
        // so a refusal can never be filed under "nothing to see" while its row sits at FAILED.
        if (outcome.unfinishedFinancial) report.unfinished += 1;
        if (outcome.code === 'unverifiable' || outcome.code === 'malformed') {
          report.unverifiable += 1;
          report.details.push(`REFUSED: ${outcome.code} ${outcome.detail ?? ''}`.trim());
        } else {
          report.failed += 1;
          report.details.push(`FAILED: ${outcome.code} ${outcome.detail ?? ''}`.trim());
        }
        continue;
      }
      report.verified += 1;
      switch (outcome.disposition) {
        case 'NEWLY_APPLIED':
          report.newlyApplied += 1;
          report.details.push(`NEWLY_APPLIED: ${outcome.detail}`);
          break;
        case 'REPROCESSED':
          // The whole point of the run. Named so it cannot read as routine duplicate traffic.
          report.reprocessed += 1;
          report.details.push(`REPROCESSED: ${outcome.detail}`);
          break;
        case 'ALREADY_HANDLED':
          report.alreadyHandled += 1;
          report.details.push(`ALREADY_HANDLED: ${outcome.detail}`);
          break;
        case 'IGNORED':
          report.ignored += 1;
          report.details.push(`IGNORED: ${outcome.detail}`);
          break;
      }
    }

    paginationToken = page.hasMore ? (page.paginationToken ?? null) : null;
  } while (paginationToken && report.pages < maxPages);

  report.ok = true;
  return report;
}

/**
 * READ-ONLY reconciliation. Asks Apple what a transaction looks like NOW.
 *
 * Deliberately separate from the write path and deliberately incapable of applying anything.
 * Notification History reflects state at the time an event was SENT; this reflects state now, and
 * the two are cross-checks, not substitutes. A current-state reading must never replace the
 * historical signed event — inferring a refund from the absence of a notification is exactly the
 * guessing this build forbids.
 */
export async function lookupRefundState(
  environment: AppleApiEnvironment,
  transactionId: string,
): Promise<{ ok: boolean; refunded?: boolean; revocationDate?: string | null; error?: string }> {
  const host = APPLE_API_HOSTS[environment];
  if (!host) return { ok: false, error: 'unknown_environment' };
  let token: string;
  try { token = mintToken(); } catch { return { ok: false, error: 'credentials_unavailable' }; }

  const res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, error: `transaction_http_${res.status}` };
  const body = (await res.json()) as { signedTransactionInfo?: string };
  if (!body.signedTransactionInfo) return { ok: false, error: 'no_signed_transaction' };

  // The App Store Server API returns a TRANSACTION JWS — the exact claim shape BUILD 26P's
  // verifier was written for, so it is reused unchanged. (A notification ENVELOPE is not, which
  // is why R2A had to split the verifier.)
  const { verifyAppleSignedTransaction } = await import('./apple-iap.server');
  const verified = await verifyAppleSignedTransaction(body.signedTransactionInfo);
  if (!verified.ok) return { ok: false, error: `unverifiable_${verified.code}` };

  const claims = verified.claims as unknown as Record<string, unknown>;
  const revocationDate = typeof claims.revocationDate === 'number'
    ? new Date(claims.revocationDate).toISOString() : null;
  // Absent, not null, is Apple's shape for "never revoked".
  return { ok: true, refunded: revocationDate !== null, revocationDate };
}
