/**
 * fetchJson — fetch with JSON parse, returns { ok, json, raw, status }
 * Used by SafeMirror, JourneyBoard, safe-mirror API route.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; json?: T; raw?: string; status?: number }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
      },
    });
    const raw = await res.text();
    let json: T | undefined;
    try {
      json = raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      json = undefined;
    }
    return {
      ok: res.ok,
      json,
      raw: raw || undefined,
      status: res.status,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, raw: msg, status: 0 };
  }
}
