"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { EmotionalBridge } from "@/components/EmotionalBridge";
import { Nav } from "@/components/Nav";
import { ResilienceGraph } from "@/components/ResilienceGraph";
import { SafeMirror } from "@/components/SafeMirror";
import { SelfEsteemTest } from "@/components/SelfEsteemTest";
import { SmallWinsStack } from "@/components/SmallWinsStack";
import { ThemeBody } from "@/components/ThemeBody";
import { PaperCard } from "@/components/ui/PaperCard";
import AuthHashGate from "../_components/AuthHashGate";

type TodayMeMessages = {
  title: string;
  tagline: string;
  linkToBty: string;
  assessmentCta: string;
  assessmentCtaSub: string;
};

type Props = {
  locale: string;
  lang: "en" | "ko";
  pathname: string;
  t: TodayMeMessages;
};

export default function LocaleLandingPage({ locale, lang, pathname, t }: Props) {
  if (lang === "en") {
    return (
      <>
        <AuthHashGate />
        <AuthGate>
          <ThemeBody theme="sanctuary" />
          <main className="min-h-screen">
            <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
              <Nav locale="en" pathname={pathname} theme="dear" />
              <header className="text-center mb-10">
                <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">{t.title}</h1>
                <p className="text-sanctuary-text-soft">{t.tagline}</p>
              </header>
              <Link
                href={`/${locale}/assessment`}
                className="block rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 p-5 text-center hover:bg-sanctuary-peach/20 transition-colors"
              >
                <span className="font-medium text-sanctuary-text">{t.assessmentCta}</span>
                <p className="text-sm text-sanctuary-text-soft mt-1">{t.assessmentCtaSub}</p>
              </Link>
              <div className="space-y-8">
                <SafeMirror locale="en" />
                <SmallWinsStack locale="en" />
                <ResilienceGraph theme="sanctuary" locale="en" />
                <SelfEsteemTest locale="en" />
                <EmotionalBridge theme="sanctuary" locale="en" />
              </div>
              <footer className="mt-12 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft">
                <Link href="/en/bty" className="underline hover:text-sanctuary-text">
                  {t.linkToBty}
                </Link>
              </footer>
            </div>
          </main>
        </AuthGate>
      </>
    );
  }

  return (
    <>
      <AuthHashGate />
      <AuthGate>
        <ThemeBody theme="dear" />
        <main className="min-h-screen">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
            <Nav locale="ko" pathname={pathname} theme="dear" />
            <header className="text-center mb-14 sm:mb-16 pt-4">
              <h1 className="font-serif text-3xl sm:text-4xl md:text-[2.75rem] font-medium text-dear-charcoal tracking-tight leading-tight">
                Dear Me,
                <br />
                <span className="text-dear-sage">I&apos;m listening.</span>
              </h1>
              <p className="mt-4 text-dear-charcoal-soft text-base sm:text-lg font-sans max-w-md mx-auto">
                {t.tagline}
              </p>
            </header>
            <Link
              href={`/${locale}/assessment`}
              className="block rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-5 text-center hover:bg-dear-sage/10 transition-colors"
            >
              <span className="font-medium text-dear-charcoal">{t.assessmentCta}</span>
              <p className="text-sm text-dear-charcoal-soft mt-1">{t.assessmentCtaSub}</p>
            </Link>
            <div className="space-y-8">
              <PaperCard>
                <SafeMirror locale="ko" theme="dear" />
              </PaperCard>
              <PaperCard>
                <SmallWinsStack locale="ko" theme="dear" />
              </PaperCard>
              <PaperCard>
                <ResilienceGraph theme="dear" />
              </PaperCard>
              <PaperCard>
                <SelfEsteemTest locale="ko" theme="dear" />
              </PaperCard>
              <PaperCard>
                <EmotionalBridge theme="dear" locale="ko" />
              </PaperCard>
            </div>
            <footer className="mt-12 pt-6 border-t border-dear-charcoal/10 text-center text-sm text-dear-charcoal-soft">
              <Link href="/ko/bty" className="text-dear-sage hover:text-dear-sage-soft underline underline-offset-2">
                {t.linkToBty}
              </Link>
            </footer>
          </div>
        </main>
      </AuthGate>
    </>
  );
}
