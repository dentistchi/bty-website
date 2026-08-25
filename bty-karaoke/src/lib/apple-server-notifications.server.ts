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

/**
 * What actually happened to this delivery. BUILD 26U-R4G-R1.
 *
 * `duplicate` alone could not carry this, because it was answering the wrong question: it meant
 * "a row with this uuid exists", and a row exists the moment we write it — long before anything
 * has been applied. These four words say what was DONE.
 */
export type NotificationDisposition =
  /** First delivery, and the lifecycle applied. */
  | 'NEWLY_APPLIED'
  /** An UNFINISHED row (RECEIVED or FAILED) was picked back up and applied. */
  | 'REPROCESSED'
  /** A prior row is already APPLIED or IGNORED. Nothing was re-run. */
  | 'ALREADY_HANDLED'
  /** Verified, durably recorded, and deliberately not acted on (an unhandled type, or not ours). */
  | 'IGNORED';

export type NotificationOutcome =
  | {
      ok: true;
      handled: boolean;
      /**
       * REDEFINED by R4G-R1: "already successfully handled", NOT "same uuid seen before".
       * It is true only for `ALREADY_HANDLED`.
       */
      duplicate: boolean;
      disposition: NotificationDisposition;
      detail: string;
    }
  | {
      ok: false;
      code: 'unverifiable' | 'malformed' | 'not_found' | 'internal';
      detail?: string;
      /**
       * True when a REFUND / REFUND_REVERSED was durably recorded but did NOT reach a handled
       * state. The operator tooling counts these: a recovery run that looks clean must actually
       * mean no financial event in the scanned set is still unfinished.
       */
      unfinishedFinancial?: boolean;
    };

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

/**
 * Verify and apply one App Store Server Notification.
 *
 * RETRY SEMANTICS (§Q). `ok: true` is returned only when the notification was applied, or when a
 * prior row is already in a successfully terminal state. A processing failure returns `ok: false`
 * so Apple retries: acknowledging a failure to stop the retries would turn a transient outage into
 * a permanently missed refund, which is the one outcome this whole path exists to prevent.
 *
 * BUILD 26U-R4G-R1 — AND THAT IS EXACTLY WHAT USED TO HAPPEN ON THE SECOND DELIVERY. The recorder
 * reported "duplicate" from the row's mere existence, so the retry that the 503 had correctly
 * asked for was answered 200 and the lifecycle never re-ran. Only APPLIED and IGNORED now mean
 * there is nothing left to do; RECEIVED and FAILED are unfinished and are always picked back up,
 * by a live Apple retry and by operator recovery alike, through this same one path.
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
  // No lifecycle call without durable evidence. A recorder failure is ours to fix, so it is a
  // retryable failure rather than a silent proceed.
  if (recordError) return { ok: false, code: 'internal', detail: 'inbox' };
  const rec = (recorded ?? {}) as Record<string, unknown>;
  if (rec.ok !== true) return { ok: false, code: 'internal', detail: String(rec.error ?? 'inbox') };

  const priorStatus = String(rec.processingStatus ?? '');
  // ONLY a successfully terminal prior state may short-circuit. The database decides this — the
  // caller never re-derives it from a status string it was handed.
  if (rec.shouldProcess !== true) {
    return {
      ok: true,
      handled: false,
      duplicate: true,
      disposition: 'ALREADY_HANDLED',
      detail: `already_handled:${priorStatus}`,
    };
  }
  // An existing row we are picking back up: the first attempt died somewhere between recording the
  // event and finishing it. Reported distinctly so a recovery run cannot describe repair as
  // routine no-op traffic.
  const reprocessing = rec.inserted !== true;

  // 5. Act, but only on the types this build handles. Everything else is durably recorded and
  //    acknowledged — an unhandled type is not an error, and retrying it forever helps nobody.
  if (notificationType !== 'REFUND' && notificationType !== 'REFUND_REVERSED') {
    if (!(await markProcessed(notificationUUID, 'IGNORED', `unhandled:${notificationType}`))) {
      // The decision is right but it is not durable yet, and a row left at RECEIVED would be
      // re-examined forever. Ask for the retry that writes it down.
      return { ok: false, code: 'internal', detail: 'mark_ignored' };
    }
    return { ok: true, handled: false, duplicate: false, disposition: 'IGNORED', detail: 'ignored' };
  }
  if (!transactionId) {
    // Verified, financial, and unusable. Recorded as FAILED so an operator can see it; refused
    // 400 because replaying the identical bytes cannot supply a transaction id they never had.
    await markProcessed(notificationUUID, 'FAILED', 'no_transaction_id');
    return { ok: false, code: 'malformed', detail: 'transaction_id', unfinishedFinancial: true };
  }

  if (notificationType === 'REFUND') {
    const { data: applied, error } = await db.rpc('apply_apple_purchase_refund', {
      p_environment: env,
      p_transaction_id: transactionId,
      p_revocation_date: revocationDate,
      p_revocation_reason: revocationReason ?? 'apple_refund',
      p_notification_uuid: notificationUUID,
    });
    if (error) {
      await markProcessed(notificationUUID, 'FAILED', 'rpc');
      return { ok: false, code: 'internal', detail: 'refund_rpc', unfinishedFinancial: true };
    }
    const res = (applied ?? {}) as Record<string, unknown>;
    if (res.ok !== true) {
      // BUILD 26U-R4G-R1 — a refund for a transaction we cannot resolve is now FAILED, not
      // IGNORED, and that is a deliberate reversal of the previous reading. Fulfilment and
      // Apple's notification are two independent arrivals with no guaranteed order, so "we have
      // no such purchase" can simply mean "not yet". Marking it IGNORED made that ordering race
      // permanent: the row became terminal and no retry or recovery would ever look at it again.
      // FAILED keeps it recoverable, and the 503 asks Apple to come back.
      await markProcessed(notificationUUID, 'FAILED', String(res.error ?? 'not_applicable'));
      return {
        ok: false, code: 'not_found',
        detail: String(res.error ?? 'not_applicable'), unfinishedFinancial: true,
      };
    }
    // THE LIFECYCLE HAS COMMITTED. If the bookkeeping write fails now, the 503 is still correct
    // and the retry is still safe: the RPC is idempotent, so the next attempt replays it as a
    // no-op and writes the status. What must never happen is undoing a committed financial
    // mutation because a status column could not be updated afterwards.
    if (!(await markProcessed(notificationUUID, 'APPLIED', `denied=${String(res.deniedSeconds ?? 0)}`))) {
      return { ok: false, code: 'internal', detail: 'mark_applied', unfinishedFinancial: true };
    }
    return {
      ok: true, handled: true, duplicate: false,
      disposition: reprocessing ? 'REPROCESSED' : 'NEWLY_APPLIED',
      detail: res.replayed === true ? 'refund_replayed' : 'refund_applied',
    };
  }

  const { data: reversed, error: revError } = await db.rpc('apply_apple_refund_reversal', {
    p_environment: env,
    p_transaction_id: transactionId,
    p_notification_uuid: notificationUUID,
  });
  if (revError) {
    await markProcessed(notificationUUID, 'FAILED', 'rpc');
    return { ok: false, code: 'internal', detail: 'reversal_rpc', unfinishedFinancial: true };
  }
  const rev = (reversed ?? {}) as Record<string, unknown>;
  if (rev.ok !== true) {
    // Same reasoning as the refund branch: an unresolvable reversal stays recoverable.
    await markProcessed(notificationUUID, 'FAILED', String(rev.error ?? 'not_applicable'));
    return {
      ok: false, code: 'not_found',
      detail: String(rev.error ?? 'not_applicable'), unfinishedFinancial: true,
    };
  }
  if (!(await markProcessed(notificationUUID, 'APPLIED', `restored=${String(rev.restoredSeconds ?? 0)}`))) {
    return { ok: false, code: 'internal', detail: 'mark_applied', unfinishedFinancial: true };
  }
  return {
    ok: true, handled: true, duplicate: false,
    disposition: reprocessing ? 'REPROCESSED' : 'NEWLY_APPLIED',
    detail: rev.replayed === true ? 'reversal_replayed' : 'reversal_applied',
  };
}

/**
 * Write the terminal state. Returns whether it actually landed.
 *
 * It used to swallow its own error, which is how a row could stay RECEIVED after a successful
 * apply — an outcome R4G-R0 measured and R4G-R1 has to be able to recover from. The caller now
 * decides what a failure means, and in the applied case it means 503: come back, and we will
 * replay the idempotent RPC and finish writing this down.
 */
async function markProcessed(uuid: string, status: string, detail: string): Promise<boolean> {
  const { error } = await karaokeDb()
    .from('karaoke_apple_server_notifications')
    .update({ processing_status: status, processing_detail: detail, processed_at: new Date().toISOString() })
    .eq('notification_uuid', uuid);
  return !error;
}
