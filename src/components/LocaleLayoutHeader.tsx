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
  /*
    Slice R4-R1A — `/{locale}/observe/{id}` is an APP-SHELL DESTINATION, not a web page. It is
    pushed from Practice → Field Actions and its own Back returns to `/{locale}/app?tab=practice`,
    so it belongs with `/app` above: the page owns its top controls, and a second fixed switch
    floating over them is the double-switch the admin exclusion already exists to prevent.
  */
  const isObserveArea = /^\/(en|ko)\/observe(\/|$)/.test(pathname);
  if (
    isArenaArea || isCenterArea || isMyPageArea || isAdminArea ||
    isLandingPage || isTodayArea || isDailyAppArea || isObserveArea
  ) {
    return null;
  }
  return (
    /*
      BELOW THE STATUS BAR, ALWAYS (Slice R4-R1A).

      The root layout sets `viewportFit: "cover"`, which is what makes `env(safe-area-inset-*)`
      resolve to non-zero — and which also lets the WebView draw UNDER the iOS status bar. With a
      bare `top-2` this switch sat 8px from the physical top of the screen, i.e. inside the clock
      and battery. `max()` keeps the existing 0.5rem on every surface where the inset is 0
      (desktop, Android without a cutout), so nothing outside iOS moves.
    */
    <div className="fixed right-2 z-[9998] top-[max(0.5rem,calc(env(safe-area-inset-top)_+_0.25rem))]">
      <Suspense fallback={<span className="px-2 py-1 text-sm text-gray-400">…</span>}>
        <LangSwitch />
      </Suspense>
    </div>
  );
}
