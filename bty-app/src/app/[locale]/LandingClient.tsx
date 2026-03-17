"use client";

import Link from "next/link";
import HubTopNav from "@/components/bty/HubTopNav";
import { ThemeBody } from "@/components/ThemeBody";

type LandingMessages = {
  heroTitle: string;
  heroSubtitle: string;
  recommended: string;
  arenaTitle: string;
  arenaDesc: string;
  arenaCta: string;
  foundryTitle: string;
  foundryDesc: string;
  foundryCta: string;
  centerTitle: string;
  centerDesc: string;
  centerCta: string;
  footerHint: string;
};

type Props = {
  locale: string;
  t: LandingMessages;
};

export default function LandingClient({ locale, t }: Props) {
  const arenaHref = `/${locale}/bty-arena`;
  const foundryHref = `/${locale}/bty`;
  const centerHref = `/${locale}/center`;

  return (
    <>
      <ThemeBody theme="sanctuary" />
      <main className="min-h-screen bg-gradient-to-b from-[#F8F4F0] via-[#FDF9F5] to-[#F0EDF5]">
        <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
          <HubTopNav theme="dear" showLangSwitch />

          <header className="text-center mb-14 sm:mb-20 pt-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#3D3A36] tracking-tight leading-tight">
              {t.heroTitle}
            </h1>
            <p className="mt-4 text-[#6B6560] text-lg sm:text-xl max-w-lg mx-auto leading-relaxed">
              {t.heroSubtitle}
            </p>
          </header>

          <div className="space-y-8">
            {/* Arena — primary, visual and hierarchical focus */}
            <Link
              href={arenaHref}
              className="block rounded-2xl border-2 border-[#5B4B8A] bg-white/95 shadow-xl shadow-[#5B4B8A]/15 hover:shadow-[#5B4B8A]/25 hover:bg-white hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 overflow-hidden group"
            >
              <div className="p-6 sm:p-10 relative">
                <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider text-[#5B4B8A] bg-[#5B4B8A]/10">
                  {t.recommended}
                </span>
                <h2 className="mt-3 text-xl sm:text-2xl md:text-3xl font-bold text-[#2D2A36] group-hover:text-[#5B4B8A] transition-colors">
                  {t.arenaTitle}
                </h2>
                <p className="mt-3 text-[#5C5868] text-sm sm:text-base leading-relaxed">
                  {t.arenaDesc}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-[#5B4B8A] font-semibold text-base">
                  {t.arenaCta}
                  <span className="text-lg group-hover:translate-x-1 transition-transform" aria-hidden>→</span>
                </span>
              </div>
            </Link>

            {/* Foundry & Center — secondary destinations */}
            <div className="grid sm:grid-cols-2 gap-5">
              <Link
                href={foundryHref}
                className="block rounded-xl border border-[#D4D0CC] bg-white/90 hover:border-[#5B4B8A]/50 hover:bg-white hover:shadow-md p-5 sm:p-6 transition-all duration-200"
              >
                <h3 className="text-lg font-semibold text-[#2D2A36]">{t.foundryTitle}</h3>
                <p className="mt-2 text-sm text-[#5C5868] leading-relaxed">{t.foundryDesc}</p>
                <span className="mt-4 inline-block text-sm font-medium text-[#5B4B8A]">{t.foundryCta} →</span>
              </Link>
              <Link
                href={centerHref}
                className="block rounded-xl border border-[#D4D0CC] bg-white/90 hover:border-[#8A9A5B]/50 hover:bg-white hover:shadow-md p-5 sm:p-6 transition-all duration-200"
              >
                <h3 className="text-lg font-semibold text-[#2D2A36]">{t.centerTitle}</h3>
                <p className="mt-2 text-sm text-[#5C5868] leading-relaxed">{t.centerDesc}</p>
                <span className="mt-4 inline-block text-sm font-medium text-[#8A9A5B]">{t.centerCta} →</span>
              </Link>
            </div>
          </div>

          <footer className="mt-16 sm:mt-20 pt-8 border-t border-[#E8E4E0] text-center text-sm text-[#6B6560]">
            {t.footerHint}
          </footer>
        </div>
      </main>
    </>
  );
}
