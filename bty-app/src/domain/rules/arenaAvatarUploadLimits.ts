/**
 * Arena avatar upload limits (display/storage only — weekly rank / season unrelated).
 */

export const ARENA_AVATAR_UPLOAD_MAX_BYTES = 2 * 1024 * 1024; // 2MB

export const ARENA_AVATAR_UPLOAD_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function isAllowedArenaAvatarMimeType(type: string): boolean {
  return (ARENA_AVATAR_UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(
    type,
  );
}
