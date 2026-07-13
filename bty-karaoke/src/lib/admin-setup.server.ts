// Server-only Admin setup-nonce lifecycle. Minting inserts a hash-only, 10-min,
// single-use nonce into the ISOLATED karaoke_admin_setup_tokens table (never the
// DJ pairing table). Redemption goes through the redeem_admin_setup RPC so
// consume-nonce + set-PIN + mint-admin-device commit atomically. Raw PIN and raw
// device token never reach Postgres — only their hashes.

import { karaokeDb } from './supabase.server';
import { sha256Hex, randomToken } from './dj-auth.server';

export const ADMIN_SETUP_TTL_MS = 10 * 60 * 1000;

export interface MintedSetup {
  /** RAW nonce — goes into the setup QR fragment only; never stored or logged. */
  token: string;
  expiresAt: string;
}

/** Mint a one-time admin-setup nonce for a room (only its hash is persisted). */
export async function mintAdminSetupNonce(roomId: string): Promise<MintedSetup> {
  const token = randomToken(24);
  const token_hash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + ADMIN_SETUP_TTL_MS).toISOString();
  const { error } = await karaokeDb()
    .from('karaoke_admin_setup_tokens')
    .insert({ room_id: roomId, token_hash, expires_at: expiresAt });
  if (error) throw error;
  return { token, expiresAt };
}

export type SetupResult =
  | { outcome: 'ok'; deviceToken: string; deviceId: string }
  | { outcome: 'invalid' };

/**
 * Atomically redeem a setup nonce: consume it, set the room's Admin PIN hash, and
 * mint a role='admin' device — all in one transaction (the RPC). `pinHash` is the
 * already-encoded PBKDF2 record; the raw device token is generated here and only
 * its hash is stored. Returns the raw device token to the caller on success.
 */
export async function redeemAdminSetup(args: {
  roomId: string;
  rawToken: string;
  pinHash: string;
  label: string;
}): Promise<SetupResult> {
  const token_hash = await sha256Hex(args.rawToken);
  const deviceToken = randomToken(24);
  const device_token_hash = await sha256Hex(deviceToken);

  const { data, error } = await karaokeDb().rpc('redeem_admin_setup', {
    p_room_id: args.roomId,
    p_token_hash: token_hash,
    p_pin_hash: args.pinHash,
    p_device_label: args.label,
    p_device_token_hash: device_token_hash,
  });
  if (error) throw error;

  const deviceId = (data as string | null) ?? null;
  if (!deviceId) return { outcome: 'invalid' };
  return { outcome: 'ok', deviceToken, deviceId };
}
