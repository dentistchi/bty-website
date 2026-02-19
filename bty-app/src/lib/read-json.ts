export async function readJsonSafe<T>(res: Response): Promise<{ ok: boolean; data?: T; raw?: string }> {
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text(); // json() 대신 text() — body 한 번만 소비

  if (!raw) return { ok: false, raw: "" };

  // JSON이 아닌데 json() 시도하면 "Unexpected end..." 나기 쉬움
  if (!ct.includes("application/json")) {
    return { ok: false, raw };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T, raw };
  } catch {
    return { ok: false, raw };
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    // 세션류는 캐시 타면 이상해질 수 있어
    cache: "no-store",
    credentials: "include",
  });

  const parsed = await readJsonSafe<T>(res);

  if (!res.ok || !parsed.ok) {
    // 여기 raw를 찍으면 "서버가 뭘 내보냈는지" 잡힘 (빈바디/HTML/에러메시지)
    console.error("[fetchJson] failed", {
      url,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get("content-type"),
      raw: parsed.raw?.slice(0, 300),
    });
    return { ok: false as const, status: res.status, raw: parsed.raw };
  }

  return { ok: true as const, status: res.status, json: parsed.data as T };
}
