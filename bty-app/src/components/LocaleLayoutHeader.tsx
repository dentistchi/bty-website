"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";

/**
 * Fixed LangSwitch only when NOT on bty / bty-arena routes.
 * On /en/bty/*, /ko/bty/*, /en/bty-arena/*, /ko/bty-arena/* the Arena layout shows LangSwitch + Logout in its own bar.
 * LangSwitch uses useSearchParams() — must be inside Suspense for Next 15 prerender (e.g. /[locale]/center).
 */
export function LocaleLayoutHeader() {
  const pathname = usePathname() ?? "";
  const isArenaArea = /^\/(en|ko)\/(bty\/|bty-arena)/.test(pathname);
  if (isArenaArea) return null;
  return (
    <div className="fixed top-2 right-2 z-[9998]">
      <Suspense fallback={<span className="px-2 py-1 text-sm text-gray-400">…</span>}>
        <LangSwitch />
      </Suspense>
    </div>
  );
}
