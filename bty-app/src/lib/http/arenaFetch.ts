export type ArenaFetchInit = Omit<RequestInit, "credentials"> & {
  /** If provided, sets method to POST (unless overridden) and JSON.stringify body */
  json?: unknown;
};

export async function arenaFetch<T = unknown>(path: string, init: ArenaFetchInit = {}): Promise<T> {
  if (!path.startsWith("/api/arena/")) {
    throw new Error(`arenaFetch only supports /api/arena/* paths. Got: ${path}`);
  }

  const headers = new Headers(init.headers);

  let method = init.method;
  let body = init.body;

  if (typeof init.json !== "undefined") {
    method = method ?? "POST";
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(path, {
    ...init,
    method: method ?? "GET",
    body,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      typeof data === "string"
        ? data
        : (data && typeof data === "object" && "error" in data
            ? (data as { error?: string }).error
            : (data && typeof data === "object" && "detail" in data
                ? (data as { detail?: string }).detail
                : null)) ?? `HTTP_${res.status}`;
    throw new Error(String(msg));
  }

  return data as T;
}
