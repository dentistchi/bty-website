"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";

type LandingMessages = {
  heroTitle: string;
  heroSubtitle: string;
  recommended: string;
  arenaTitle: string;
  arenaDesc: string;
  arenaCta: string;
  dojoTitle: string;
  dojoDesc: string;
  dojoCta: string;
  dearMeTitle: string;
  dearMeDesc: string;
  dearMeCta: string;
  footerHint: string;
};

type Props = {
  locale: string;
  pathname: string;
  t: LandingMessages;
};

export default function LandingClient({ locale, pathname, t }: Props) {
  const arenaHref = `/${locale}/bty-arena`;
  const dojoHref = `/${locale}/bty`;
  const dearMeHref = `/${locale}/dear-me`;

  return (
    <>
      <ThemeBody theme="sanctuary" />
      <main className="min-h-screen bg-gradient-to-b from-[#F8F4F0] via-[#FDF9F5] to-[#F0EDF5]">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <Nav locale={locale as "en" | "ko"} pathname={pathname} theme="dear" />

          <header className="text-center mb-12 sm:mb-16 pt-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#3D3A36] tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="mt-3 text-[#6B6560] text-base sm:text-lg">
              {t.heroSubtitle}
            </p>
          </header>

          <div className="space-y-6">
            {/* Arena — primary, emphasized */}
            <Link
              href={arenaHref}
              className="block rounded-2xl border-2 border-[#5B4B8A] bg-white/90 shadow-lg shadow-[#5B4B8A]/12 hover:shadow-[#5B4B8A]/20 hover:bg-white transition-all duration-200 overflow-hidden group"
            >
              <div className="p-6 sm:p-8">
                <span className="text-xs font-medium uppercase tracking-wider text-[#5B4B8A]/80">
                  Recommended
                </span>
                <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-[#2D2A36] group-hover:text-[#5B4B8A] transition-colors">
                  {t.arenaTitle}
                </h2>
                <p className="mt-2 text-[#5C5868] text-sm sm:text-base leading-relaxed">
                  {t.arenaDesc}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-[#5B4B8A] font-medium">
                  {t.arenaCta}
                  <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </div>
            </Link>

            {/* Dojo & Dear Me — secondary row or stack */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                href={dojoHref}
                className="block rounded-xl border border-[#D4D0CC] bg-white/80 hover:border-[#5B4B8A]/40 hover:bg-white p-5 transition-all duration-200"
              >
                <h3 className="text-lg font-semibold text-[#2D2A36]">{t.dojoTitle}</h3>
                <p className="mt-1.5 text-sm text-[#5C5868] leading-relaxed">{t.dojoDesc}</p>
                <span className="mt-3 text-sm font-medium text-[#5B4B8A]">{t.dojoCta} →</span>
              </Link>
              <Link
                href={dearMeHref}
                className="block rounded-xl border border-[#D4D0CC] bg-white/80 hover:border-[#8A9A5B]/50 hover:bg-white p-5 transition-all duration-200"
              >
                <h3 className="text-lg font-semibold text-[#2D2A36]">{t.dearMeTitle}</h3>
                <p className="mt-1.5 text-sm text-[#5C5868] leading-relaxed">{t.dearMeDesc}</p>
                <span className="mt-3 text-sm font-medium text-[#8A9A5B]">{t.dearMeCta} →</span>
              </Link>
            </div>
          </div>

          <footer className="mt-14 pt-6 border-t border-[#E8E4E0] text-center text-sm text-[#6B6560]">
            {t.footerHint}
          </footer>
        </div>
      </main>
    </>
  );
}
