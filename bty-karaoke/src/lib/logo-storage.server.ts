// Room Branding V1 — server-only access to the PRIVATE `room-logos` Supabase bucket.
// The browser never talks to Storage; only the service-role client here does. The
// object key is ALWAYS server-generated and tied to the authorized Room id — no
// client-provided key, filename, account id, email, or token is ever in the path.

import { karaokeDb } from './supabase.server';
import { randomToken } from './dj-auth.server';

/** Private bucket. Objects are delivered only via the /api/public proxy, never public URL. */
export const LOGO_BUCKET = 'room-logos';

/** A fresh opaque key for a Room's logo. Only the roomId + CSPRNG randomness appear. */
export function newLogoObjectKey(roomId: string): string {
  return `rooms/${roomId}/logo-${randomToken(16)}.webp`;
}

/** A short cache-busting version token stamped on the Room row and used in the proxy URL. */
export function newLogoVersion(): string {
  return randomToken(6);
}

/** Upload the normalized WebP. Fails (throws) rather than overwriting an existing key. */
export async function uploadLogoObject(key: string, webp: Uint8Array): Promise<void> {
  const body = new Blob([webp.slice().buffer], { type: 'image/webp' }); // clean ArrayBuffer part
  const { error } = await karaokeDb()
    .storage.from(LOGO_BUCKET)
    .upload(key, body, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
}

/** Best-effort delete of a managed object. Returns whether it succeeded (never throws). */
export async function deleteLogoObject(key: string): Promise<boolean> {
  try {
    const { error } = await karaokeDb().storage.from(LOGO_BUCKET).remove([key]);
    return !error;
  } catch {
    return false;
  }
}

/** Fetch the normalized WebP bytes from the private bucket (server-side), or null. */
export async function downloadLogoObject(key: string): Promise<Uint8Array | null> {
  const { data, error } = await karaokeDb().storage.from(LOGO_BUCKET).download(key);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
