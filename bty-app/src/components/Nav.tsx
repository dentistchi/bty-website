"use client";

import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavTheme = "dear" | "dojo";

export function Nav({
  locale,
  pathname,
  theme = "dojo",
}: {
  locale: Locale;
  pathname: string;
  theme?: NavTheme;
}) {
  const t = getMessages(locale).nav;
  const isEn = pathname.startsWith("/en");
  const isBty = pathname.includes("/bty") && !pathname.includes("/bty-arena");
  const isArena = pathname.includes("/bty-arena");
  const isDearMe = pathname.includes("/dear-me");
  const isDear = theme === "dear";
  const muted = isDear ? "text-dear-charcoal-soft" : "text-dojo-ink-soft";
  const mutedDivider = isDear ? "text-dear-charcoal-soft/60" : "text-dojo-ink-soft/60";
  const rest = pathname.slice(isEn ? 3 : 3) || "/";
  const toggleHref = isEn ? `/ko${rest}` : `/en${rest}`;
  return (
    <nav className="flex items-center justify-center gap-4 py-3 text-sm flex-wrap">
      <Link
        href={isEn ? "/en/dear-me" : "/ko/dear-me"}
        className={isDearMe ? "font-medium underline" : cn(muted, "hover:underline")}
      >
        {t.todayMe}
      </Link>
      <Link
        href={isEn ? "/en/bty" : "/ko/bty"}
        className={isBty ? "font-medium underline" : cn(muted, "hover:underline")}
      >
        {t.bty}
      </Link>
      <Link
        href={isEn ? "/en/bty-arena" : "/ko/bty-arena"}
        className={isArena ? "font-medium underline" : cn(muted, "hover:underline")}
      >
        {t.arena}
      </Link>
      <span className={mutedDivider}>|</span>
      <Link href={toggleHref} className={cn(muted, "hover:underline")}>
        {isEn ? t.ko : t.en}
      </Link>
    </nav>
  );
}
