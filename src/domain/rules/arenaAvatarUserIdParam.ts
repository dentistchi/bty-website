/**
 * Query `userId` for GET /api/arena/avatar (storage path segment).
 * Display/proxy only — not auth; weekly rank / season unrelated.
 */

const ARENA_AVATAR_USER_ID_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidArenaAvatarUserIdKey(
  value: string | null | undefined,
): value is string {
  if (value == null || typeof value !== "string") return false;
  return ARENA_AVATAR_USER_ID_KEY_RE.test(value.trim());
}
