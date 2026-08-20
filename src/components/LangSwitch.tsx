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
 *
 * R4-R4B-R1N-R1(-R1) — IT NOW ALSO REMEMBERS, AND THE SERVER DOES THE REMEMBERING.
 *
 * The path prefix held the choice perfectly while a tab was alive and lost it the moment the
 * WebView was destroyed: the native shell relaunches at the locale-neutral `/start`, so a person
 * who chose Korean reopened the app in English.
 *
 * The first fix wrote `NEXT_LOCALE` here with `document.cookie` before navigating. It passed every
 * test and failed on device, for a reason this repository had already measured twice: a JS-store
 * cookie write is not the reliable direction for the hosted WKWebView, and WebKit flushes that
 * store to disk asynchronously — so a write racing a document teardown, followed by a deliberate
 * hard kill, can simply vanish.
 *
 * So the links now point at `/api/locale/set`, which sets the cookie and redirects in ONE response.
 * There is no pre-navigation JS step left to lose. Locale is still the path prefix, and the
 * preference is still written ONLY by an explicit click here — never inferred from visiting `/ko`.
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

  /** The one place a language choice becomes durable: server writes, server redirects. */
  const prefHref = (locale: "en" | "ko", to: string) =>
    `/api/locale/set?to=${locale}&next=${encodeURIComponent(to)}`;

  return (
    <div className="flex items-center gap-1 text-sm">
      {/*
        The visible control is unchanged — still EN | KO, still two links. Only the target moved:
        each now goes through the route that writes the preference and redirects to the same place
        the link used to point at directly.
      */}
      <a
        href={prefHref("en", toEn)}
        data-testid="lang-switch-en"
        className={`px-2 py-1 rounded ${isEn ? "font-medium underline bg-black/5" : "text-gray-500 hover:text-gray-800"}`}
      >
        EN
      </a>
      <span className="text-gray-300">|</span>
      <a
        href={prefHref("ko", toKo)}
        data-testid="lang-switch-ko"
        className={`px-2 py-1 rounded ${isKo ? "font-medium underline bg-black/5" : "text-gray-500 hover:text-gray-800"}`}
      >
        KO
      </a>
    </div>
  );
}
