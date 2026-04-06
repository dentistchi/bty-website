/**
 * Single source of truth for `next` / post-login redirects.
 * Blocks open redirects, protocol-relative URLs, and login loops.
 */
export type SanitizeNextLocale = "en" | "ko";

const LOGIN_LOOP_PREFIXES = [
  "/bty/login",
  "/en/bty/login",
  "/ko/bty/login",
  "/admin/login",
  "/en/admin/login",
  "/ko/admin/login",
] as const;

function tryDecodeOnce(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Normalize query/header `next` to a path string, or null if unusable.
 */
export function normalizeNextPathCandidate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let path = tryDecodeOnce(trimmed);
  if (path == null) return null;
  path = path.trim();
  if (!path) return null;

  // Second decode pass for double-encoded payloads (best-effort)
  const again = tryDecodeOnce(path);
  if (again != null && again.trim()) path = again.trim();

  return path;
}

function isLoginLoopPath(path: string): boolean {
  const lower = path.toLowerCase();
  for (const p of LOGIN_LOOP_PREFIXES) {
    if (lower === p || lower.startsWith(`${p}/`) || lower.startsWith(`${p}?`)) return true;
  }
  return false;
}

function isUnsafeRelativePath(path: string): boolean {
  if (!path.startsWith("/")) return true;
  if (path.includes("\\")) return true;
  if (path.includes("://")) return true;
  if (path.includes("//")) return true;
  return false;
}

/**
 * Infer locale from a path like `/ko/bty/...` vs `/en/...`.
 */
export function inferLocaleFromNextParam(raw: string | null | undefined): SanitizeNextLocale {
  const p = normalizeNextPathCandidate(raw);
  if (p?.toLowerCase().startsWith("/ko/")) return "ko";
  return "en";
}

export type SanitizeNextForRedirectOptions = {
  locale: SanitizeNextLocale;
};

/**
 * Returns a same-origin relative path safe to pass to `new URL(path, origin)` or `redirect()`.
 * On any violation, returns `/${locale}/bty`.
 */
export function sanitizeNextForRedirect(
  raw: string | null | undefined,
  options: SanitizeNextForRedirectOptions,
): string {
  const fallback = `/${options.locale}/bty`;
  const path = normalizeNextPathCandidate(raw);
  if (!path) return fallback;
  if (isUnsafeRelativePath(path)) return fallback;
  if (isLoginLoopPath(path)) return fallback;
  return path;
}
