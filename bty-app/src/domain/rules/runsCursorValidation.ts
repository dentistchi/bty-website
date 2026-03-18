/**
 * GET arena/runs `cursor` — base64url JSON `{ sa, rid }` 순수 검증·파싱.
 * 잘못된 인코딩·형식은 null. lib `runsCursor`는 이 모듈을 단일 소스로 사용.
 */

export type RunsListCursorPayload = {
  sa: string;
  rid: string;
};

const RUN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64UrlToUtf8(b64url: string): string | null {
  const t = b64url.trim();
  if (!t.length || t.length > 4096) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  const b64 = t.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(pad);
  try {
    if (typeof atob !== "function") return null;
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** 유효한 runs cursor면 payload, 아니면 null. */
export function parseRunsListCursorOrNull(raw: string): RunsListCursorPayload | null {
  const json = base64UrlToUtf8(raw);
  if (json == null) return null;
  try {
    const j = JSON.parse(json) as { sa?: unknown; rid?: unknown };
    if (typeof j.sa !== "string" || typeof j.rid !== "string") return null;
    if (!j.sa.trim() || !j.rid.trim()) return null;
    if (!RUN_ID_RE.test(j.rid)) return null;
    if (Number.isNaN(Date.parse(j.sa))) return null;
    return { sa: j.sa, rid: j.rid };
  } catch {
    return null;
  }
}

export function isValidRunsListCursorEncoding(raw: string): boolean {
  return parseRunsListCursorOrNull(raw) !== null;
}
