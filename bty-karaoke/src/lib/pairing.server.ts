// Server-only pairing-token lifecycle. Admin mints a one-use, 5-minute token
// (only its hash is stored); an iPad redeems it atomically to establish a durable
// DJ device session. No raw token or credential is ever logged.

import { karaokeDb } from './supabase.server';
import { sha256Hex, randomToken } from './dj-auth.server';
import { createDeviceSession, type DjDevice } from './devices.server';
import { pairingExpiryIso, defaultDeviceLabel, type DeviceRole } from '@/domain/pairing';

export interface MintedPairing {
  /** RAW pairing token — goes into the QR only; never stored or logged. */
  token: string;
  role: DeviceRole;
  expiresAt: string;
}

/** Mint a one-use pairing token (default DJ role) valid for 5 minutes. */
export async function mintPairingToken(args: {
  roomId: string;
  role?: DeviceRole;
  label?: string | null;
}): Promise<MintedPairing> {
  const role: DeviceRole = args.role ?? 'dj';
  const token = randomToken(24);
  const token_hash = await sha256Hex(token);
  const expiresAt = pairingExpiryIso(Date.now());

  const { error } = await karaokeDb()
    .from('karaoke_pairing_tokens')
    .insert({
      room_id: args.roomId,
      token_hash,
      role,
      label: args.label ?? null,
      expires_at: expiresAt,
    });
  if (error) throw error;
  return { token, role, expiresAt };
}

export type RedeemResult =
  | { outcome: 'ok'; deviceToken: string; device: DjDevice }
  | { outcome: 'invalid' }; // expired, already used, or unknown

/**
 * Atomically redeem a pairing token for a room and establish a device session.
 * The single-use guarantee is the conditional UPDATE (redeemed_at IS NULL AND
 * not expired): under concurrent double-redeem exactly one caller claims the row.
 */
export async function redeemPairingToken(args: {
  roomId: string;
  rawToken: string;
  userAgent?: string | null;
  label?: string | null;
}): Promise<RedeemResult> {
  const db = karaokeDb();
  const hash = await sha256Hex(args.rawToken);
  const nowIso = new Date().toISOString();

  // 1) Atomic claim. Only the winner gets a row back.
  const { data: claimed, error: claimErr } = await db
    .from('karaoke_pairing_tokens')
    .update({ redeemed_at: nowIso })
    .eq('room_id', args.roomId)
    .eq('token_hash', hash)
    .is('redeemed_at', null)
    .gt('expires_at', nowIso)
    .select('id, role, label')
    .maybeSingle();
  if (claimErr) throw claimErr;
  if (!claimed) return { outcome: 'invalid' };

  const role = (claimed.role as DeviceRole) ?? 'dj';
  const label =
    (args.label && args.label.trim()) ||
    (claimed.label as string | null) ||
    defaultDeviceLabel(args.userAgent, role);

  // 2) Establish the durable device session (raw token stays with the caller).
  const deviceToken = randomToken(24);
  const device = await createDeviceSession({
    roomId: args.roomId,
    rawToken: deviceToken,
    role,
    label,
  });

  // 3) Link the redeemed token to the device it created (best-effort audit).
  await db
    .from('karaoke_pairing_tokens')
    .update({ redeemed_device_id: device.id })
    .eq('id', claimed.id);

  return { outcome: 'ok', deviceToken, device };
}
