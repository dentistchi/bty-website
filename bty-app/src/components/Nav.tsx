"use client";

import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavTheme = "dear" | "foundry";

export function Nav({
  locale,
  pathname,
  theme = "foundry",
}: {
  locale: Locale;
  pathname: string;
  theme?: NavTheme;
}) {
  const t = getMessages(locale).nav;
  const isBty = pathname.includes("/bty") && !pathname.includes("/bty-arena");
  const isArena = pathname.includes("/bty-arena");
  const isCenter = pathname.includes("/center");
  const isDear = theme === "dear";
  const muted = isDear ? "text-dear-charcoal-soft" : "text-foundry-ink-soft";
  const mutedDivider = isDear ? "text-dear-charcoal-soft/60" : "text-foundry-ink-soft/60";
  const rest = pathname.slice(pathname.startsWith("/en") ? 3 : 3) || "/";
  const toggleHref = pathname.startsWith("/en") ? `/ko${rest}` : `/en${rest}`;
  const navAriaLabel = locale === "ko" ? "주요 메뉴" : "Main navigation";
  return (
    <nav className="flex items-center justify-center gap-4 py-3 text-sm flex-wrap" aria-label={navAriaLabel}>
      <Link
        href={`/${locale}/center`}
        className={isCenter ? "font-medium underline" : cn(muted, "hover:underline")}
      >
        {t.center}
      </Link>
      <Link
        href={`/${locale}/bty`}
        className={isBty ? "font-medium underline" : cn(muted, "hover:underline")}
      >
        {t.bty}
      </Link>
      <Link
        href={`/${locale}/bty-arena`}
        className={isArena ? "font-medium underline" : cn(muted, "hover:underline")}
      >
        {t.arena}
      </Link>
      <span className={mutedDivider}>|</span>
      <Link
        href={toggleHref}
        className={cn(muted, "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2", isDear ? "focus-visible:ring-dear-sage" : "focus-visible:ring-foundry-purple")}
        aria-label={locale === "en" ? t.ko : t.en}
      >
        {locale === "en" ? t.ko : t.en}
      </Link>
    </nav>
  );
}
