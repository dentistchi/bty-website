"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * EN/KO 토글: pathname prefix만 /en <-> /ko 로 바꾸고 query 유지
 *
 * `ensureParams` (Slice R4-R1B) — query keys the CALLER guarantees must be on the target URL,
 * merged over whatever is already there.
 *
 * It exists because the app shell deliberately SCRUBS `?tab=` from the URL on mount ("so a
 * re-render / back never re-triggers them and no navigation loop forms"), so by the time someone
 * is standing on Me the address is a bare `/{locale}/app`. Preserving that query faithfully —
 * which is all this component ever did — would land them on Today in the other language.
 *
 * This is NOT a second language state. Locale still lives in exactly one place, the path prefix,
 * and this component is still the only thing that changes it. The caller is only saying where it
 * is, which the URL no longer says on its behalf. Default is empty, so every existing call site
 * behaves exactly as before.
 */
export function LangSwitch({ ensureParams }: { ensureParams?: Record<string, string> } = {}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  // `useSearchParams()` is nullable in the App Router (and null in several shell test harnesses).
  // The previous direct `.toString()` was only ever safe because nothing mounted this inside the
  // app shell; Me does now, so the absence of a query is treated as an empty one.
  const merged = new URLSearchParams(searchParams?.toString() ?? "");
  for (const [k, v] of Object.entries(ensureParams ?? {})) merged.set(k, v);
  const query = merged.toString();
  const q = query ? `?${query}` : "";

  const isEn = pathname.startsWith("/en");
  const isKo = pathname.startsWith("/ko");
  const rest = isEn ? pathname.slice(3) || "/" : isKo ? pathname.slice(3) || "/" : pathname || "/";
  const toEn = `/en${rest}${q}`;
  const toKo = `/ko${rest}${q}`;

  return (
    <div className="flex items-center gap-1 text-sm">
      <a
        href={toEn}
        className={`px-2 py-1 rounded ${isEn ? "font-medium underline bg-black/5" : "text-gray-500 hover:text-gray-800"}`}
      >
        EN
      </a>
      <span className="text-gray-300">|</span>
      <a
        href={toKo}
        className={`px-2 py-1 rounded ${isKo ? "font-medium underline bg-black/5" : "text-gray-500 hover:text-gray-800"}`}
      >
        KO
      </a>
    </div>
  );
}
