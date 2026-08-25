// BUILD 26U-R4E-R1 — App Store Server Notifications V2 (server-only).
//
// WHY THIS EXISTS. R4E-R0 measured the gap: Apple revocation was captured only when a transaction
// was FIRST verified, a replay updated nothing, and no code read a purchase's revocation to touch
// a grant. A refunded customer kept paid room time until natural expiry — up to 24 hours — and no
// operator could stop it, because `revoke_timed_access_pass` refuses anything that is not
// AVAILABLE or SELECTED. This is the ingestion side of closing that.
//
// THE VERIFIER IS NOT REWRITTEN. `verifyAppleSignedTransaction` (BUILD 26P) already does the hard
// part — full x5c chain to a pinned Apple root, purpose OIDs, ES256, length limits — and it is
// proven against the REAL Apple certificate chain. The outer notification JWS is verified with
// exactly the same function, because it is signed the same way by the same authority. Writing a
// second verifier would mean a second thing to get wrong.
//
// NOTHING HERE TRUSTS A CLAIM BEFORE ITS SIGNATURE. The decoded body is read only after the
// signature chained to a trusted root, and the transaction is located ONLY by immutable Apple
// evidence (environment + transactionId). No client-supplied account or grant identity is
// accepted anywhere in this path.

import {
  verifyAppleSignedPayload,
  verifyAppleSignedTransaction,
  signedTransactionDigest,
} from './apple-iap.server';
import { karaokeDb } from './supabase.server';

/** The V2 notification types this build acts on. Anything else is recorded and ignored. */
export type HandledNotification = 'REFUND' | 'REFUND_REVERSED';

/**
 * How this event reached us. BUILD 26U-R4E-R3-R1.
 *
 * `SERVER_NOTIFICATION` — Apple pushed it to our endpoint.
 * `API_RECOVERY`        — we later fetched the SAME signed event from Get Notification History.
 *
 * The two are the same authoritative event and take the same path through this handler; only the
 * operational provenance differs, and it is recorded in its own column rather than smuggled into
 * the notificationUUID.
 */
export type DiscoverySource = 'SERVER_NOTIFICATION' | 'API_RECOVERY';

export type NotificationOutcome =
  | { ok: true; handled: boolean; duplicate: boolean; detail: string }
  | { ok: false; code: 'unverifiable' | 'malformed' | 'not_found' | 'internal'; detail?: string };

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

/**
 * Verify and apply one App Store Server Notification.
 *
 * RETRY SEMANTICS (§Q). `ok: true` is returned only when the notification was applied or was
 * recognised as an already-applied duplicate. A processing failure returns `ok: false` so Apple
 * retries: acknowledging a failure to stop the retries would turn a transient outage into a
 * permanently missed refund, which is the one outcome this whole path exists to prevent.
 */
export async function handleAppleServerNotification(
  signedPayload: string,
  discoverySource: DiscoverySource = 'SERVER_NOTIFICATION',
): Promise<NotificationOutcome> {
  // 1. The OUTER envelope must verify against Apple's real chain before anything is read.
  //
  //    `verifyAppleSignedPayload`, NOT `verifyAppleSignedTransaction`. A notification envelope is
  //    signed exactly like a transaction but carries different claims — no top-level
  //    `environment` — and R4E-R1 put it through the transaction verifier, which rejected it on
  //    that final claim check. A real Apple TEST delivery is what caught it: chain and signature
  //    verified, then a 400, recorded by Apple as UNSUCCESSFUL_HTTP_RESPONSE_CODE.
  const outer = await verifyAppleSignedPayload(signedPayload);
  if (!outer.ok) return { ok: false, code: 'unverifiable', detail: outer.code };

  // 2. The body is the VERIFIED payload — read from the verifier's own output rather than
  //    re-decoded from the raw string, so what is acted on is exactly what was signed.
  const body = outer.payload;

  const notificationType = str(body.notificationType);
  const subtype = str(body.subtype);
  const notificationUUID = str(body.notificationUUID);
  if (!notificationType || !notificationUUID) {
    return { ok: false, code: 'malformed', detail: 'missing_type_or_uuid' };
  }

  // 3. The INNER signedTransactionInfo is a separate JWS and gets the same treatment: verified,
  //    then read. An unverifiable inner payload fails the whole notification.
  const data = (body.data ?? {}) as Record<string, unknown>;
  const signedTransactionInfo = str(data.signedTransactionInfo);
  let transactionId: string | null = null;
  let originalTransactionId: string | null = null;
  let environment: 'Sandbox' | 'Production' | null = null;
  let revocationDate: string | null = null;
  let revocationReason: string | null = null;

  if (signedTransactionInfo) {
    const inner = await verifyAppleSignedTransaction(signedTransactionInfo);
    if (!inner.ok) return { ok: false, code: 'unverifiable', detail: `inner:${inner.code}` };
    transactionId = str(inner.claims.transactionId);
    originalTransactionId = str(inner.claims.originalTransactionId);
    environment = inner.environment;
    const raw = inner.claims as unknown as Record<string, unknown>;
    revocationDate =
      typeof raw.revocationDate === 'number' ? new Date(raw.revocationDate).toISOString() : null;
    revocationReason = raw.revocationReason != null ? String(raw.revocationReason) : null;
  }

  // The environment is the VERIFIER's reading, never the outer envelope's claim.
  const env = environment ?? (str(body.data && (data.environment as string)) as 'Sandbox' | 'Production' | null);
  if (!env) return { ok: false, code: 'malformed', detail: 'environment' };

  const digest = await signedTransactionDigest(signedPayload);
  const db = karaokeDb();

  // 4. Record it. The UNIQUE notificationUUID is the whole duplicate-suppression mechanism, and
  //    it is checked in the database rather than here, so two concurrent deliveries cannot both
  //    pass a read-then-write check.
  const { data: recorded, error: recordError } = await db.rpc('karaoke_record_apple_notification', {
    p_notification_uuid: notificationUUID,
    p_notification_type: notificationType,
    p_subtype: subtype,
    p_environment: env,
    p_transaction_id: transactionId,
    p_original_transaction_id: originalTransactionId,
    p_signed_date: typeof body.signedDate === 'number' ? new Date(body.signedDate).toISOString() : null,
    p_payload_sha256: digest,
    p_discovery_source: discoverySource,
  });
  if (recordError) return { ok: false, code: 'internal', detail: 'inbox' };
  const rec = (recorded ?? {}) as Record<string, unknown>;
  if (rec.duplicate === true) {
    return { ok: true, handled: false, duplicate: true, detail: 'already_recorded' };
  }

  // 5. Act, but only on the types this build handles. Everything else is durably recorded and
  //    acknowledged — an unhandled type is not an error, and retrying it forever helps nobody.
  if (notificationType !== 'REFUND' && notificationType !== 'REFUND_REVERSED') {
    await markProcessed(notificationUUID, 'IGNORED', `unhandled:${notificationType}`);
    return { ok: true, handled: false, duplicate: false, detail: 'ignored' };
  }
  if (!transactionId) {
    await markProcessed(notificationUUID, 'FAILED', 'no_transaction_id');
    return { ok: false, code: 'malformed', detail: 'transaction_id' };
  }

  if (notificationType === 'REFUND') {
    const { data: applied, error } = await db.rpc('apply_apple_purchase_refund', {
      p_environment: env,
      p_transaction_id: transactionId,
      p_revocation_date: revocationDate,
      p_revocation_reason: revocationReason ?? 'apple_refund',
      p_notification_uuid: notificationUUID,
    });
    if (error) { await markProcessed(notificationUUID, 'FAILED', 'rpc'); return { ok: false, code: 'internal' }; }
    const res = (applied ?? {}) as Record<string, unknown>;
    if (res.ok !== true) {
      // A refund for a transaction we never recorded is not our purchase to revoke. Recorded and
      // acknowledged: retrying cannot make a row appear.
      await markProcessed(notificationUUID, 'IGNORED', String(res.error ?? 'not_applicable'));
      return { ok: true, handled: false, duplicate: false, detail: String(res.error ?? 'not_applicable') };
    }
    await markProcessed(notificationUUID, 'APPLIED', `denied=${String(res.deniedSeconds ?? 0)}`);
    return { ok: true, handled: true, duplicate: res.replayed === true, detail: 'refund_applied' };
  }

  const { data: reversed, error: revError } = await db.rpc('apply_apple_refund_reversal', {
    p_environment: env,
    p_transaction_id: transactionId,
    p_notification_uuid: notificationUUID,
  });
  if (revError) { await markProcessed(notificationUUID, 'FAILED', 'rpc'); return { ok: false, code: 'internal' }; }
  const rev = (reversed ?? {}) as Record<string, unknown>;
  if (rev.ok !== true) {
    await markProcessed(notificationUUID, 'IGNORED', String(rev.error ?? 'not_applicable'));
    return { ok: true, handled: false, duplicate: false, detail: String(rev.error ?? 'not_applicable') };
  }
  await markProcessed(notificationUUID, 'APPLIED', `restored=${String(rev.restoredSeconds ?? 0)}`);
  return { ok: true, handled: true, duplicate: rev.replayed === true, detail: 'reversal_applied' };
}

async function markProcessed(uuid: string, status: string, detail: string): Promise<void> {
  await karaokeDb()
    .from('karaoke_apple_server_notifications')
    .update({ processing_status: status, processing_detail: detail, processed_at: new Date().toISOString() })
    .eq('notification_uuid', uuid);
}
