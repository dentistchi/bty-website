/**
 * Validates Playwright cookie jar matches what @supabase/ssr expects for session restore:
 * `sb-<project>-auth-token` (+ optional `.0`, `.1`, … chunks), JSON or `base64-<base64url(json)>`, with both tokens.
 * @see @supabase/ssr dist/module/utils/chunker.js combineChunks
 */

export type SupabaseSessionCookieCheck = {
  ok: true;
  cookieNames: string[];
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
};

export type SupabaseSessionCookieFailure = {
  ok: false;
  reason: string;
  cookieNames: string[];
  combinedLength: number;
};

const BASE64_PREFIX = "base64-";

/** Single cookie `sb-…-auth-token` or chunked `sb-…-auth-token.0`, `.1`, … */
export function combineSupabaseAuthStorageCookieValue(
  cookies: { name: string; value: string }[],
): string | null {
  const auth = cookies.filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (auth.length === 0) return null;

  const chunkSuffix = /\.(0|[1-9]\d*)$/;
  const base = auth.find((c) => !chunkSuffix.test(c.name));
  if (base?.value) return base.value;

  const chunks = auth
    .filter((c) => chunkSuffix.test(c.name))
    .map((c) => {
      const m = c.name.match(/\.(0|[1-9]\d*)$/);
      const idx = m ? parseInt(m[1], 10) : NaN;
      return { idx, value: c.value };
    })
    .filter((x) => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx);

  if (chunks.length === 0) return null;
  return chunks.map((c) => c.value).join("");
}

function decodeStorageValue(combined: string): string {
  if (combined.startsWith(BASE64_PREFIX)) {
    const payload = combined.slice(BASE64_PREFIX.length);
    return Buffer.from(payload, "base64url").toString("utf8");
  }
  return combined;
}

export function checkSupabaseAuthCookiesForE2E(
  cookies: { name: string; value: string }[],
): SupabaseSessionCookieCheck | SupabaseSessionCookieFailure {
  const authNames = cookies
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .map((c) => c.name);

  const combined = combineSupabaseAuthStorageCookieValue(cookies);
  if (!combined) {
    return {
      ok: false,
      reason: "no_sb_auth_token_cookie",
      cookieNames: authNames,
      combinedLength: 0,
    };
  }

  let jsonStr: string;
  try {
    jsonStr = decodeStorageValue(combined);
  } catch (e) {
    return {
      ok: false,
      reason: `base64_decode_failed:${e instanceof Error ? e.message : String(e)}`,
      cookieNames: authNames,
      combinedLength: combined.length,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      reason: `json_parse_failed:${e instanceof Error ? e.message : String(e)}`,
      cookieNames: authNames,
      combinedLength: combined.length,
    };
  }

  const o = parsed as { access_token?: unknown; refresh_token?: unknown };
  const accessOk = typeof o.access_token === "string" && o.access_token.length > 0;
  const refreshOk = typeof o.refresh_token === "string" && o.refresh_token.length > 0;

  if (!accessOk || !refreshOk) {
    return {
      ok: false,
      reason: `missing_tokens access=${accessOk} refresh=${refreshOk}`,
      cookieNames: authNames,
      combinedLength: combined.length,
    };
  }

  return {
    ok: true,
    cookieNames: authNames,
    hasAccessToken: true,
    hasRefreshToken: true,
  };
}
