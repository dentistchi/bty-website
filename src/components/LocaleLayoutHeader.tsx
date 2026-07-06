"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";

/**
 * Fixed LangSwitch only when NOT on bty / bty-arena routes.
 * On /en/bty/*, /ko/bty/*, /en/bty-arena/*, /ko/bty-arena/* the Arena layout shows LangSwitch + Logout in its own bar.
 * On /en/admin/*, /ko/admin/* the AdminNav shows its own LangSwitch — hide the global one to avoid a double switch (#23).
 * On /en/today, /ko/today the Daily landing stays clean (STEP 3.5) — language switch lives under Me → Account Settings.
 * On /en/app, /ko/app (+ nested) the native BTY Daily App owns its full-screen shell — the web locale header would
 * collide with the iOS status bar and read as web-page smell; app-level language treatment lives inside the shell later.
 * LangSwitch uses useSearchParams() — must be inside Suspense for Next 15 prerender (e.g. /[locale]/center).
 */
export function LocaleLayoutHeader() {
  const pathname = usePathname() ?? "";
  const isArenaArea = /^\/(en|ko)\/(bty\/|bty-arena)/.test(pathname);
  const isCenterArea = /^\/(en|ko)\/(center|dear-me|assessment|journal)(\/|$)/.test(pathname);
  const isMyPageArea = /^\/(en|ko)\/my-page/.test(pathname);
  const isAdminArea = /^\/(en|ko)\/admin(\/|$)/.test(pathname);
  const isLandingPage = /^\/(en|ko)\/?$/.test(pathname);
  const isTodayArea = /^\/(en|ko)\/today(\/|$)/.test(pathname);
  const isDailyAppArea = /^\/(en|ko)\/app(\/|$)/.test(pathname);
  if (isArenaArea || isCenterArea || isMyPageArea || isAdminArea || isLandingPage || isTodayArea || isDailyAppArea) return null;
  return (
    <div className="fixed top-2 right-2 z-[9998]">
      <Suspense fallback={<span className="px-2 py-1 text-sm text-gray-400">…</span>}>
        <LangSwitch />
      </Suspense>
    </div>
  );
}
