// Server-only data access for paired DJ/Admin device sessions. We store ONLY the
// SHA-256 hash of each device's opaque token; the raw token lives solely in the
// paired device's localStorage. Revoking a row (or rotating) blocks the device
// on its next authenticated call.

import { karaokeDb } from './supabase.server';
import { sha256Hex } from './dj-auth.server';
import type { DeviceRole } from '@/domain/pairing';

export interface DjDevice {
  id: string;
  room_id: string;
  role: DeviceRole;
  label: string;
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// Public-safe device view for the Admin device list (never exposes token_hash).
const DEVICE_COLS = 'id, room_id, role, label, status, created_at, last_used_at, revoked_at';

export interface AuthorizedDevice {
  id: string;
  role: DeviceRole;
  label: string;
}

/**
 * Resolve a raw bearer token to an ACTIVE device session for the given room.
 * Returns the device (id/role/label) or null. Touches last_used_at best-effort.
 */
export async function authorizeDevice(
  roomId: string,
  rawToken: string,
): Promise<AuthorizedDevice | null> {
  if (!rawToken) return null;
  const hash = await sha256Hex(rawToken);
  const { data, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .select('id, role, label, status')
    .eq('room_id', roomId)
    .eq('token_hash', hash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'active') return null;

  // Best-effort last-used stamp; never block the request on it.
  void karaokeDb()
    .from('karaoke_dj_devices')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(undefined, () => undefined);

  return { id: data.id as string, role: data.role as DeviceRole, label: data.label as string };
}

/**
 * Create a durable device session for a room. `rawToken` is hashed here; the
 * caller keeps the raw. Returns the new device row (no token).
 */
export async function createDeviceSession(args: {
  roomId: string;
  rawToken: string;
  role: DeviceRole;
  label: string;
}): Promise<DjDevice> {
  const token_hash = await sha256Hex(args.rawToken);
  const { data, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .insert({
      room_id: args.roomId,
      role: args.role,
      label: args.label,
      token_hash,
      status: 'active',
    })
    .select(DEVICE_COLS)
    .single();
  if (error) throw error;
  return data as DjDevice;
}

/** All devices for a room (active + revoked), newest first, without hashes. */
export async function listDevices(roomId: string): Promise<DjDevice[]> {
  const { data, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .select(DEVICE_COLS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DjDevice[]) ?? [];
}

/** Count of ACTIVE admin-role devices in a room (for the last-admin guard). */
export async function countActiveAdminDevices(roomId: string): Promise<number> {
  const { count, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('role', 'admin')
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

export type RevokeOutcome =
  | { outcome: 'ok'; device: DjDevice }
  | { outcome: 'not_found' }
  | { outcome: 'last_admin' };

/**
 * Revoke with server-side guards: refuses to revoke the LAST active admin device
 * (so a room can never be left with no usable Admin). DJ devices revoke freely.
 */
export async function revokeDeviceSafely(roomId: string, deviceId: string): Promise<RevokeOutcome> {
  const { data, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .select('id, role, status')
    .eq('room_id', roomId)
    .eq('id', deviceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { outcome: 'not_found' };

  if (data.role === 'admin' && data.status === 'active') {
    if ((await countActiveAdminDevices(roomId)) <= 1) return { outcome: 'last_admin' };
  }
  const device = await revokeDevice(roomId, deviceId);
  return device ? { outcome: 'ok', device } : { outcome: 'not_found' };
}

/** Revoke a single device (scoped to the room). Idempotent. */
export async function revokeDevice(roomId: string, deviceId: string): Promise<DjDevice | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('id', deviceId)
    .select(DEVICE_COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as DjDevice) ?? null;
}

/**
 * Rotate global DJ authorization: revoke every ACTIVE dj-role device for the
 * room in one shot (admin devices are left intact so the operator keeps control).
 * Also expires outstanding pairing tokens. Returns the number of devices revoked.
 */
export async function revokeAllDjDevices(roomId: string): Promise<number> {
  const db = karaokeDb();
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from('karaoke_dj_devices')
    .update({ status: 'revoked', revoked_at: nowIso })
    .eq('room_id', roomId)
    .eq('role', 'dj')
    .eq('status', 'active')
    .select('id');
  if (error) throw error;

  // Burn any un-redeemed pairing tokens so a stale QR can't create a new device.
  await db
    .from('karaoke_pairing_tokens')
    .update({ redeemed_at: nowIso })
    .eq('room_id', roomId)
    .is('redeemed_at', null);

  return (data as { id: string }[] | null)?.length ?? 0;
}
