// BUILD 26E — canonical account deletion authority (service layer).
//
// This module owns the THREE things the deletion RPC cannot do for itself:
//
//   1. the one-way provider fingerprint (F-5). The HMAC secret must never live in the
//      database, so the fingerprint is computed here and passed in as hex. A database
//      compromise alone therefore cannot reverse or re-derive a provider subject.
//   2. provider authorization revocation (F-3), which is an outbound call, not SQL — and
//      whose outcome is reported TRUTHFULLY, including when it is unavailable.
//   3. Supabase Storage object deletion (F-2), which is not part of any DB transaction
//      and is therefore driven from a durable outbox rather than best-effort.
//
// The account is NEVER taken from a caller: routes derive it from the authenticated
// session and pass it here. This is the orchestration boundary, not the authentication
// boundary — the same division the pass and room RPCs already use.

import { karaokeDb } from './supabase.server';
import { optionalEnv } from './env.server';
import { LOGO_BUCKET, deleteLogoObject } from './logo-storage.server';
import type { IdentityProvider } from './host-auth.server';
import {
  type AppleRevocationConfig,
  appleRevocationConfig,
  decryptRefreshToken,
  encryptRefreshToken,
  exchangeAppleAuthorizationCode,
  nextAttemptDelayMs,
  revokeAppleToken,
} from './apple-revocation.server';

/** Written into the audit and the tombstone so a future schema change is identifiable. */
export const DELETION_VERSION = 'BUILD26E_V1';

export type DeletionSource = 'host_native' | 'host_web';

// ── 1. One-way provider fingerprint (F-5) ────────────────────────────────────

/**
 * Whether the dedicated fingerprint secret is configured. Deletion FAILS CLOSED without
 * it: deleting a provider subject while unable to retain its fingerprint would silently
 * reopen the delete-and-recreate FREE-window reset, which is precisely what F-5 forbids.
 * A dedicated secret — never the service-role key, never the CSRF secret.
 */
const MIN_FINGERPRINT_SECRET_LEN = 32;

export function fingerprintSecret(): string | null {
  const s = optionalEnv('KARAOKE_IDENTITY_FINGERPRINT_SECRET');
  if (!s || s.length < MIN_FINGERPRINT_SECRET_LEN) return null;
  return s;
}

export function fingerprintConfigured(): boolean {
  return fingerprintSecret() !== null;
}

/**
 * HMAC-SHA256(secret, provider || NUL || subject) as lowercase hex.
 *
 * The NUL separator matters: without it ('apple' + 'x1') and ('applex' + '1') would
 * collide, letting one provider's subject shadow another's. Never logged, never returned
 * to a client, never used for anything but deletion replay, FREE-window continuity, and
 * (later) transaction-replay refusal.
 */
export async function identityFingerprint(
  provider: IdentityProvider,
  subject: string,
): Promise<string> {
  const secretValue = fingerprintSecret();
  if (!secretValue) throw new Error('KARAOKE_IDENTITY_FINGERPRINT_SECRET is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretValue),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${provider}\u0000${subject}`),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── 2. Provider authorization revocation (F-3, Apple revision) ───────────────

/**
 * Per-provider revocation outcome recorded in the permanent audit.
 *
 * `unavailable_missing_credentials` is DELIBERATELY GONE. Missing Worker secrets are a
 * deployment blocker that stops an Apple-linked deletion before it starts (the route
 * answers 503), so a configuration mistake can never be written into a user's permanent
 * audit as though it were an outcome they experienced.
 */
export type ProviderRevocationStatus =
  | 'revoked' //          revocation completed
  | 'pending' //          owed and retryable; a durable job carries it
  | 'manual_required' //  Apple permanently refused; user must finish in Settings
  | 'not_linked'; //      the account never had this provider

export interface ProviderRevocationReport {
  apple?: ProviderRevocationStatus;
  google?: ProviderRevocationStatus;
}

// ── 3. The deletion call ─────────────────────────────────────────────────────

export type DeleteAccountResult =
  | {
      outcome: 'deleted' | 'already_deleted';
      deletedAt: string | null;
      roomsRetired: number;
      storageCleanup: 'NONE_REQUIRED' | 'ENQUEUED';
      storagePending: number;
      providerRevocation: ProviderRevocationReport;
    }
  | { outcome: 'fingerprint_unavailable' }
  | { outcome: 'fingerprint_incomplete' }
  | { outcome: 'apple_revocation_not_configured' }
  | { outcome: 'apple_reauth_required' }
  | { outcome: 'apple_identity_mismatch' }
  | { outcome: 'apple_code_invalid' }
  | { outcome: 'account_not_found' }
  | { outcome: 'invalid_source' };

interface IdentityRow {
  provider: IdentityProvider;
  provider_subject: string;
}

/** The shape `karaoke_delete_account_v1` returns. */
interface DeleteRpcRow {
  outcome: string;
  deletedAt?: string;
  roomsRetired?: number;
  storageCleanup?: string;
}

export interface DeleteAccountArgs {
  accountId: string;
  source: DeletionSource;
  /** Apple authorization code from the deletion-confirmation re-auth. Required when the
   *  account has an Apple identity; ignored otherwise. */
  appleAuthorizationCode?: string | null;
  /** Test seam only. */
  fetchImpl?: typeof fetch;
}

/**
 * Delete the canonical account behind an authenticated session.
 *
 * SEQUENCE (the ordering IS the contract — see BUILD 26E §7):
 *   1. read identities while they still exist;
 *   2. fingerprint every identity — FAIL CLOSED before any mutation;
 *   3. Apple-linked? config must be valid, an authorization code must be present, and the
 *      exchange must resolve to the subject THIS account owns — all before mutating;
 *   4. persist a `prepared` revocation job holding only encrypted token material;
 *   5. run the single-transaction deletion RPC;
 *   6. RPC failed → delete the prepared job and erase the token (it must never be left
 *      usable); RPC succeeded → promote the job to `pending`;
 *   7. attempt revocation immediately; success erases the token, transient failure stays
 *      durable and retryable, permanent failure becomes manual_required.
 *
 * After step 5 commits, NOTHING restores account access — not an Apple outage, not a
 * Storage outage, not a crash. That is why revocation is a job and not a precondition.
 */
export async function deleteAccount(args: DeleteAccountArgs): Promise<DeleteAccountResult> {
  const db = karaokeDb();
  const { accountId, source } = args;

  if (!fingerprintConfigured()) return { outcome: 'fingerprint_unavailable' };

  const ids = await db
    .from('karaoke_account_identities')
    .select('provider, provider_subject')
    .eq('account_id', accountId);
  if (ids.error) throw ids.error;
  const rows = (ids.data ?? []) as IdentityRow[];
  const appleIdentity = rows.find((r) => r.provider === 'apple') ?? null;

  const fingerprints = await Promise.all(
    rows.map(async (r) => ({
      provider: r.provider,
      fingerprint: await identityFingerprint(r.provider, r.provider_subject),
    })),
  );

  // ── Apple pre-flight. Every refusal here happens with ZERO mutation. ──
  let preparedJobId: string | null = null;
  let appleConfig: AppleRevocationConfig | null = null;

  if (appleIdentity) {
    const cfg = appleRevocationConfig();
    if (!cfg.ok) {
      // DEPLOYMENT BLOCKER, not a user outcome. The account stays active, its identities
      // and sessions untouched, and the route answers 503.
      return { outcome: 'apple_revocation_not_configured' };
    }
    appleConfig = cfg.config;

    const code = (args.appleAuthorizationCode ?? '').trim();
    if (!code) return { outcome: 'apple_reauth_required' };

    const exchanged = await exchangeAppleAuthorizationCode({
      authorizationCode: code,
      expectedSubject: appleIdentity.provider_subject,
      config: appleConfig,
      fetchImpl: args.fetchImpl,
    });
    if (!exchanged.ok) {
      if (exchanged.code === 'subject_mismatch') return { outcome: 'apple_identity_mismatch' };
      if (exchanged.code === 'transient') return { outcome: 'apple_code_invalid' };
      // invalid_code covers expired AND already-redeemed (replayed) codes.
      return { outcome: 'apple_code_invalid' };
    }

    const enc = await encryptRefreshToken(exchanged.refreshToken, appleConfig.encryptionKey);
    const acct = await db
      .from('karaoke_accounts')
      .select('authority_ref')
      .eq('id', accountId)
      .maybeSingle();
    if (acct.error) throw acct.error;

    const job = await db
      .from('karaoke_provider_revocation_jobs')
      .upsert(
        {
          account_id: accountId,
          authority_ref: (acct.data as { authority_ref: string } | null)?.authority_ref ?? null,
          provider: 'apple',
          status: 'prepared',
          encrypted_refresh_token: enc.ciphertext,
          token_nonce: enc.nonce,
          encryption_key_version: enc.keyVersion,
          attempt_count: 0,
          last_error_code: null,
        },
        { onConflict: 'account_id,provider' },
      )
      .select('id')
      .maybeSingle();
    if (job.error) throw job.error;
    preparedJobId = (job.data as { id: string } | null)?.id ?? null;
  }

  const providerRevocation: ProviderRevocationReport = {
    apple: appleIdentity ? 'pending' : 'not_linked',
    google: rows.some((r) => r.provider === 'google')
      ? source === 'host_native'
        ? 'revoked'
        : 'pending'
      : 'not_linked',
  };

  // ── The single deletion transaction ──
  let rpcRow: DeleteRpcRow | null = null;
  try {
    const { data, error } = await db.rpc('karaoke_delete_account_v1', {
      p_account_id: accountId,
      p_deletion_source: source,
      p_fingerprints: fingerprints,
      p_provider_revocation: providerRevocation,
    });
    if (error) throw error;
    rpcRow = (Array.isArray(data) ? data[0] : data) as DeleteRpcRow | null;
  } catch (e) {
    // The deletion did NOT commit → the prepared job must not survive holding a usable
    // token. Erase it entirely rather than leaving revocation authority for an account
    // that still exists.
    await discardPreparedJob(preparedJobId);
    throw e;
  }

  if (!rpcRow) {
    await discardPreparedJob(preparedJobId);
    return { outcome: 'account_not_found' };
  }
  if (rpcRow.outcome !== 'deleted' && rpcRow.outcome !== 'already_deleted') {
    await discardPreparedJob(preparedJobId);
    return {
      outcome: rpcRow.outcome as 'fingerprint_incomplete' | 'account_not_found' | 'invalid_source',
    };
  }

  // ── Committed. From here the account is gone regardless of what follows. ──
  if (preparedJobId) {
    await db
      .from('karaoke_provider_revocation_jobs')
      .update({ status: 'pending' })
      .eq('id', preparedJobId);
    await appendDeletionEvent(accountId, 'APPLE_REVOCATION_PREPARED', null, 0);
  }

  if (preparedJobId && appleConfig) {
    providerRevocation.apple = await runAppleRevocation({
      jobId: preparedJobId,
      accountId,
      config: appleConfig,
      fetchImpl: args.fetchImpl,
    });
  }

  const pending = await drainStorageCleanup(20);

  return {
    outcome: rpcRow.outcome as 'deleted' | 'already_deleted',
    deletedAt: rpcRow.deletedAt ?? null,
    roomsRetired: rpcRow.roomsRetired ?? 0,
    storageCleanup: (rpcRow.storageCleanup as 'NONE_REQUIRED' | 'ENQUEUED') ?? 'NONE_REQUIRED',
    storagePending: pending,
    providerRevocation,
  };
}

/** Remove an uncommitted preparation, erasing its token material. Never throws. */
async function discardPreparedJob(jobId: string | null): Promise<void> {
  if (!jobId) return;
  try {
    await karaokeDb()
      .from('karaoke_provider_revocation_jobs')
      .delete()
      .eq('id', jobId)
      .eq('status', 'prepared'); // never delete a job that already went pending
  } catch {
    // Best-effort; a stranded 'prepared' row grants nothing on its own because the
    // account still exists and the drain only processes 'pending'/'retryable_failure'.
  }
}

/** Append a non-PII post-deletion event. Never throws. */
async function appendDeletionEvent(
  accountId: string,
  eventType: string,
  detailCode: string | null,
  attemptCount: number | null,
): Promise<void> {
  try {
    const db = karaokeDb();
    const acct = await db
      .from('karaoke_accounts')
      .select('authority_ref')
      .eq('id', accountId)
      .maybeSingle();
    await db.from('karaoke_account_deletion_events').insert({
      account_id: accountId,
      authority_ref: (acct.data as { authority_ref: string } | null)?.authority_ref ?? null,
      event_type: eventType,
      detail_code: detailCode,
      attempt_count: attemptCount,
    });
  } catch {
    // An audit-event write failure must never undo or block a committed deletion.
  }
}

/**
 * Attempt one revocation for a pending/retryable job and record the outcome durably.
 * Returns the status to report to the caller. Never throws.
 */
export async function runAppleRevocation(args: {
  jobId: string;
  accountId: string;
  config: AppleRevocationConfig;
  fetchImpl?: typeof fetch;
}): Promise<ProviderRevocationStatus> {
  const db = karaokeDb();
  const now = new Date();

  const jobRes = await db
    .from('karaoke_provider_revocation_jobs')
    .select('id, status, encrypted_refresh_token, token_nonce, attempt_count')
    .eq('id', args.jobId)
    .maybeSingle();
  const job = jobRes.data as {
    id: string;
    status: string;
    encrypted_refresh_token: string | null;
    token_nonce: string | null;
    attempt_count: number;
  } | null;
  if (!job || job.status === 'succeeded') return 'revoked';
  if (job.status === 'manual_required') return 'manual_required';
  if (!job.encrypted_refresh_token || !job.token_nonce) return 'manual_required';

  const token = await decryptRefreshToken(
    { ciphertext: job.encrypted_refresh_token, nonce: job.token_nonce },
    args.config.encryptionKey,
  );
  if (!token) {
    // Unreadable token material can never be revoked with. Terminal, and the token is
    // erased so nothing keeps a useless secret.
    await db
      .from('karaoke_provider_revocation_jobs')
      .update({
        status: 'manual_required',
        manual_required_at: now.toISOString(),
        encrypted_refresh_token: null,
        token_nonce: null,
        last_error_code: 'token_unreadable',
      })
      .eq('id', job.id);
    await appendDeletionEvent(args.accountId, 'APPLE_REVOCATION_MANUAL_REQUIRED', 'token_unreadable', job.attempt_count);
    return 'manual_required';
  }

  const attempt = job.attempt_count + 1;
  const result = await revokeAppleToken({
    refreshToken: token,
    config: args.config,
    fetchImpl: args.fetchImpl,
  });

  if (result.outcome === 'revoked') {
    await db
      .from('karaoke_provider_revocation_jobs')
      .update({
        status: 'succeeded',
        completed_at: now.toISOString(),
        attempt_count: attempt,
        // Erased the moment it is no longer needed.
        encrypted_refresh_token: null,
        token_nonce: null,
        next_attempt_at: null,
        last_error_code: null,
      })
      .eq('id', job.id);
    await appendDeletionEvent(args.accountId, 'APPLE_REVOCATION_SUCCEEDED', null, attempt);
    return 'revoked';
  }

  if (result.outcome === 'retryable') {
    await db
      .from('karaoke_provider_revocation_jobs')
      .update({
        status: 'retryable_failure',
        attempt_count: attempt,
        // Token RETAINED — the next attempt needs it.
        next_attempt_at: new Date(now.getTime() + nextAttemptDelayMs(attempt)).toISOString(),
        last_error_code: result.code,
      })
      .eq('id', job.id);
    await appendDeletionEvent(args.accountId, 'APPLE_REVOCATION_RETRYABLE_FAILURE', result.code, attempt);
    return 'pending';
  }

  await db
    .from('karaoke_provider_revocation_jobs')
    .update({
      status: 'manual_required',
      manual_required_at: now.toISOString(),
      attempt_count: attempt,
      encrypted_refresh_token: null,
      token_nonce: null,
      next_attempt_at: null,
      last_error_code: result.code,
    })
    .eq('id', job.id);
  await appendDeletionEvent(args.accountId, 'APPLE_REVOCATION_MANUAL_REQUIRED', result.code, attempt);
  return 'manual_required';
}

// ── 4. Storage cleanup outbox drain (F-2) ────────────────────────────────────

interface OutboxRow {
  id: string;
  bucket: string;
  object_key: string;
  attempts: number;
}

/**
 * Delete enqueued Storage objects and record the outcome. Returns how many rows are
 * still PENDING after this pass.
 *
 * Never throws: a Storage outage must not fail the deletion response, because the
 * account is already anonymized and its logo pointers already cleared — the image is
 * unreachable regardless. The row stays PENDING and is retried on the next drain, which
 * is what makes this durable rather than best-effort.
 */
export async function drainStorageCleanup(limit = 20): Promise<number> {
  const db = karaokeDb();
  const { data, error } = await db
    .from('karaoke_storage_cleanup_outbox')
    .select('id, bucket, object_key, attempts')
    .eq('status', 'PENDING')
    .order('enqueued_at', { ascending: true })
    .limit(limit);
  if (error) return 0;

  const rows = (data ?? []) as OutboxRow[];
  let stillPending = 0;

  for (const r of rows) {
    const now = new Date().toISOString();
    let ok = false;
    try {
      ok = r.bucket === LOGO_BUCKET ? await deleteLogoObject(r.object_key) : false;
    } catch {
      ok = false;
    }
    if (ok) {
      await db
        .from('karaoke_storage_cleanup_outbox')
        .update({ status: 'DONE', completed_at: now, last_attempt_at: now, attempts: r.attempts + 1 })
        .eq('id', r.id);
    } else {
      stillPending += 1;
      await db
        .from('karaoke_storage_cleanup_outbox')
        .update({
          last_attempt_at: now,
          attempts: r.attempts + 1,
          last_error: 'delete_failed',
        })
        .eq('id', r.id);
    }
  }
  return stillPending;
}

// ── 5. FREE-window carryover on recreation (F-5) ─────────────────────────────

/**
 * Called immediately after a BRAND-NEW canonical account is created for a verified
 * identity. If that identity's fingerprint matches a tombstone, the current window's
 * consumed seconds and grace state are carried forward, so deleting and re-creating an
 * account cannot hand out a second 900-second allowance inside one window.
 *
 * Restores NOTHING else: no rooms, no branding, no saved songs, no entitlements. Never
 * relinks or reactivates the tombstone. Non-fatal by design — a failure here must not
 * block a legitimate sign-in, and the next window resets normally anyway.
 */
export async function applyFreeWindowCarryover(
  newAccountId: string,
  provider: IdentityProvider,
  subject: string,
): Promise<void> {
  if (!fingerprintConfigured()) return;
  try {
    const fp = await identityFingerprint(provider, subject);
    await karaokeDb().rpc('karaoke_apply_free_window_carryover_v1', {
      p_new_account_id: newAccountId,
      p_fingerprint: fp,
    });
  } catch {
    // Never block sign-in on anti-abuse bookkeeping.
  }
}
