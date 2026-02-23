"use client";

import { usePathname } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";

/**
 * Fixed LangSwitch only when NOT on bty protected routes.
 * On /en/bty/mentor, /ko/bty/* etc. the bty protected layout shows LangSwitch + Logout in its own bar to avoid overlap.
 */
export function LocaleLayoutHeader() {
  const pathname = usePathname() ?? "";
  const isBtyProtected = /^\/(en|ko)\/bty\//.test(pathname);
  if (isBtyProtected) return null;
  return (
    <div className="fixed top-2 right-2 z-[9998]">
      <LangSwitch />
    </div>
  );
}
