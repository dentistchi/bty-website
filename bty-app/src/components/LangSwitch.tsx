"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * EN/KO 토글: pathname prefix만 /en <-> /ko 로 바꾸고 query 유지
 */
export function LangSwitch() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const query = searchParams.toString();
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
