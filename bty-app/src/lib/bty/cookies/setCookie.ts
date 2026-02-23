export function serializeSetCookie(params: {
  name: string;
  value: string;
  maxAge?: number;
  expires?: Date | string;
}): string {
  const { name, value, maxAge, expires } = params;

  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];
  parts.push("Path=/");
  parts.push("SameSite=Lax");
  parts.push("Secure");
  parts.push("HttpOnly");

  if (typeof maxAge === "number") parts.push(`Max-Age=${Math.floor(maxAge)}`);

  if (expires) {
    const d = typeof expires === "string" ? new Date(expires) : expires;
    if (!Number.isNaN(d.getTime())) parts.push(`Expires=${d.toUTCString()}`);
  }

  return parts.join("; ");
}

export function appendSetCookies(
  res: { headers: Headers },
  cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>
) {
  for (const c of cookies) {
    const opt = (c.options ?? {}) as { maxAge?: number; expires?: Date | string };
    res.headers.append(
      "Set-Cookie",
      serializeSetCookie({
        name: c.name,
        value: c.value,
        maxAge: typeof opt.maxAge === "number" ? opt.maxAge : undefined,
        expires: opt.expires,
      })
    );
  }
}
