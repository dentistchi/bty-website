/**
 * TEMPORARY PKCE LIFECYCLE TRACE (Slice R1H). Privacy-safe by construction.
 *
 * WHY THIS EXISTS. Two source-based diagnoses have now been disproven on the device, so this slice
 * stops guessing and measures. The decisive question cannot be answered from server logs, because
 * the failure no longer reaches the server at all:
 *
 *   pre-b891   /authorize → /callback → POST /token 400 bad_code_verifier   (verifier WRONG)
 *   post-b891  /authorize → /callback → no /token request whatsoever        (verifier MISSING)
 *
 * auth-js throws `AuthPKCECodeVerifierMissingError` BEFORE issuing the request when the stored
 * verifier is empty, and our callback collapses that into `exchange_failed`. So the one thing that
 * matters is whether the verifier written at sign-in is still there at exchange:
 *
 *   does the fingerprint at P2 equal the fingerprint at P5?
 *
 * WHAT IT RECORDS, AND NOTHING ELSE: event name, a random attempt id, route, timestamp, whether a
 * verifier exists, its LENGTH, a one-way SHA-256 PREFIX (8 hex chars), the cookie chunk count, and
 * whether the runtime is native.
 *
 * WHAT IT NEVER RECORDS: the verifier itself, the authorization code, any token, any cookie value,
 * any email, oid or tid. A fingerprint is one-way and 8 hex characters wide — enough to compare two
 * observations, useless for reconstructing anything.
 *
 * It lives in `sessionStorage` under a NON-`sb-` key so it survives the redirect to Microsoft and
 * back without touching Supabase's own storage, and it is deliberately capped and disposable.
 *
 * REMOVE THIS once the lifecycle question is answered.
 */

const TRACE_KEY = "bty.pkce.trace";
const ATTEMPT_KEY = "bty.pkce.attempt";
const MAX_ENTRIES = 24;

export type PkceTraceEntry = {
  ev: string;
  attempt: string;
  route: string;
  at: string;
  exists: boolean;
  len: number;
  fp: string;
  chunks: number;
  native: boolean;
};

const canStore = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

/** A random, meaningless correlation id. One user tap must produce exactly one of these. */
export function startPkceAttempt(): string {
  const id = Math.random().toString(36).slice(2, 10);
  try {
    if (canStore()) window.sessionStorage.setItem(ATTEMPT_KEY, id);
  } catch {
    /* tracing must never break sign-in */
  }
  return id;
}

export function currentPkceAttempt(): string {
  try {
    return (canStore() && window.sessionStorage.getItem(ATTEMPT_KEY)) || "-";
  } catch {
    return "-";
  }
}

/**
 * Read the PKCE verifier cookie WITHOUT returning it. Returns only its shape: how many chunks the
 * storage is spread across and the combined length. The value never leaves this function.
 */
function readVerifierShape(): { raw: string; chunks: number } {
  if (typeof document === "undefined") return { raw: "", chunks: 0 };
  let chunks = 0;
  const parts: { name: string; value: string }[] = [];
  for (const pair of document.cookie.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    if (!name.includes("code-verifier")) continue;
    chunks += 1;
    parts.push({ name, value: pair.slice(idx + 1) });
  }
  // Chunked cookies are `<base>.0`, `<base>.1`, … and must be combined in index order.
  parts.sort((a, b) => a.name.localeCompare(b.name));
  return { raw: parts.map((p) => p.value).join(""), chunks };
}

async function fingerprint(value: string): Promise<string> {
  if (!value) return "-";
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf))
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "?";
  }
}

/** Record one observation point. Never throws; tracing must not be able to break a sign-in. */
export async function tracePkce(ev: string, attempt?: string): Promise<void> {
  try {
    if (!canStore()) return;
    const { raw, chunks } = readVerifierShape();
    const entry: PkceTraceEntry = {
      ev,
      attempt: attempt ?? currentPkceAttempt(),
      route: typeof window !== "undefined" ? window.location.pathname : "-",
      at: new Date().toISOString().slice(11, 23),
      exists: raw.length > 0,
      len: raw.length,
      fp: await fingerprint(raw),
      chunks,
      native:
        typeof window !== "undefined" &&
        Boolean((window as unknown as { Capacitor?: unknown }).Capacitor),
    };
    const prev = readPkceTrace();
    prev.push(entry);
    window.sessionStorage.setItem(TRACE_KEY, JSON.stringify(prev.slice(-MAX_ENTRIES)));
  } catch {
    /* never break sign-in for a diagnostic */
  }
}

export function readPkceTrace(): PkceTraceEntry[] {
  try {
    if (!canStore()) return [];
    const raw = window.sessionStorage.getItem(TRACE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as PkceTraceEntry[]) : [];
  } catch {
    return [];
  }
}

/** One compact line per observation — short enough to read from a phone screenshot. */
export function formatPkceTrace(entries: PkceTraceEntry[]): string[] {
  return entries.map(
    (e) =>
      `${e.at} ${e.ev} a=${e.attempt} ${e.native ? "native" : "web"} fp=${e.fp} len=${e.len} ch=${e.chunks} ${e.route}`,
  );
}
