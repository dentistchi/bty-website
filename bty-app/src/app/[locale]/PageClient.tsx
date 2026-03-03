"use client";

import React, { useState } from "react";
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

type CenterMessages = {
  loading: string;
  title: string;
  /** §1·§8: 아늑한 방 톤 / locale별 헤더. 없으면 "Center, I'm listening." */
  heroTitleMain?: string;
  heroTitleAccent?: string;
  tagline: string;
  /** §5: 단일 CTA — 클릭 시 /${locale}/bty 로 직행 (재로그인 유도 금지) */
  ctaToFoundry: string;
  linkToBty: string;
  assessmentCta: string;
  assessmentCtaSub: string;
  /** §3: 5문항 아래 안내 — "더 자세한 테스트를 원하시면 클릭하세요" + 50문항 링크 */
  assessmentDetailHint: string;
  entryIntro: string;
  startCta: string;
  todayStepTitle: string;
  todayMoodLabel: string;
  todayEnergyLabel: string;
  todayOneWordLabel: string;
  todayMoodPlaceholder: string;
  todayOneWordPlaceholder: string;
  todayNext: string;
  todaySkip: string;
  letterStepTitle: string;
  letterPrompt: string;
  letterPlaceholder: string;
  submitLetter: string;
  sendingLetter: string;
  replyStepTitle: string;
  completedTitle: string;
  completedSub: string;
  continueToChat: string;
};

type Props = {
  locale: string;
  lang: "en" | "ko";
  pathname: string;
  t: CenterMessages;
};

export default function LocaleLandingPage({ locale, lang, pathname, t }: Props) {
  const [hasStartedCenter, setHasStartedCenter] = useState(false);
  const [centerStep, setCenterStep] = useState<2 | 3 | 4 | 5>(2);
  const [todayMood, setTodayMood] = useState("");
  const [todayEnergy, setTodayEnergy] = useState<number | "">("");
  const [todayOneWord, setTodayOneWord] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [letterReply, setLetterReply] = useState<string | null>(null);
  const [sendingLetter, setSendingLetter] = useState(false);
  const isCenterPath = pathname.includes("/center");

  if (lang === "en") {
    if (isCenterPath && !hasStartedCenter) {
      return (
        <>
          <AuthHashGate />
          <AuthGate loadingMessage={t.loading}>
            <ThemeBody theme="sanctuary" />
            <main className="min-h-screen">
              <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
                <Nav locale="en" pathname={pathname} theme="dear" />
                <header className="text-center mb-10">
                  <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">
                    {t.heroTitleMain ?? t.title},{` `}
                    <span className="text-sanctuary-flower/90">{t.heroTitleAccent ?? "I'm listening."}</span>
                  </h1>
                  <p className="text-sanctuary-text-soft">{t.tagline}</p>
                </header>
                <p className="text-center text-sanctuary-text-soft mb-6 max-w-md mx-auto">{t.entryIntro}</p>
                <button
                  type="button"
                  onClick={() => setHasStartedCenter(true)}
                  className="w-full rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 py-4 text-center hover:bg-sanctuary-peach/20 transition-colors font-medium text-sanctuary-text"
                >
                  {t.startCta}
                </button>
              </div>
            </main>
          </AuthGate>
        </>
      );
    }
    // §2: EN same as KO — question first → steps 2–5 → main
    if (isCenterPath && hasStartedCenter && centerStep <= 4) {
      return (
        <>
          <AuthHashGate />
          <AuthGate loadingMessage={t.loading}>
            <ThemeBody theme="sanctuary" />
            <main className="min-h-screen">
              <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
                <Nav locale="en" pathname={pathname} theme="dear" />
                <header className="text-center mb-10 pt-4">
                  <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text">
                    {t.title}
                  </h1>
                </header>
                {centerStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-medium text-sanctuary-text">{t.todayStepTitle}</h2>
                    <div>
                      <label className="block text-sm text-sanctuary-text-soft mb-1">{t.todayMoodLabel}</label>
                      <input
                        type="text"
                        value={todayMood}
                        onChange={(e) => setTodayMood(e.target.value)}
                        placeholder={t.todayMoodPlaceholder}
                        className="w-full rounded-xl border border-sanctuary-peach/50 bg-white/80 px-4 py-3 text-sanctuary-text placeholder:text-sanctuary-text-soft/60"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-sanctuary-text-soft mb-1">{t.todayEnergyLabel}</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setTodayEnergy(n)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              todayEnergy === n
                                ? "border-sanctuary-peach bg-sanctuary-peach/10 text-sanctuary-text"
                                : "border-sanctuary-text-soft/30 text-sanctuary-text-soft hover:border-sanctuary-peach/50"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-sanctuary-text-soft mb-1">{t.todayOneWordLabel}</label>
                      <input
                        type="text"
                        value={todayOneWord}
                        onChange={(e) => setTodayOneWord(e.target.value)}
                        placeholder={t.todayOneWordPlaceholder}
                        className="w-full rounded-xl border border-sanctuary-peach/50 bg-white/80 px-4 py-3 text-sanctuary-text placeholder:text-sanctuary-text-soft/60"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setCenterStep(3)}
                        className="flex-1 rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 py-4 text-center hover:bg-sanctuary-peach/20 transition-colors font-medium text-sanctuary-text"
                      >
                        {t.todayNext}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCenterStep(3)}
                        className="rounded-2xl border border-sanctuary-text-soft/20 py-4 px-6 text-sanctuary-text-soft hover:bg-sanctuary-text-soft/5 text-sm"
                      >
                        {t.todaySkip}
                      </button>
                    </div>
                  </div>
                )}
                {centerStep === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-medium text-sanctuary-text">{t.letterStepTitle}</h2>
                    <p className="text-sanctuary-text-soft text-sm">{t.letterPrompt}</p>
                    <textarea
                      value={letterBody}
                      onChange={(e) => setLetterBody(e.target.value)}
                      placeholder={t.letterPlaceholder}
                      rows={6}
                      className="w-full rounded-xl border border-sanctuary-peach/50 bg-white/80 px-4 py-3 text-sanctuary-text placeholder:text-sanctuary-text-soft/60 resize-y"
                    />
                    <button
                      type="button"
                      disabled={!letterBody.trim() || sendingLetter}
                      onClick={async () => {
                        setSendingLetter(true);
                        try {
                          const r = await fetch("/api/center/letter", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              body: letterBody.trim(),
                              mood: todayMood || undefined,
                              energy: todayEnergy !== "" ? todayEnergy : undefined,
                              oneWord: todayOneWord || undefined,
                              lang,
                            }),
                          });
                          const data = await r.json().catch(() => ({}));
                          if (data.reply) setLetterReply(data.reply);
                          setCenterStep(4);
                        } finally {
                          setSendingLetter(false);
                        }
                      }}
                      className="w-full rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 py-4 text-center hover:bg-sanctuary-peach/20 transition-colors font-medium text-sanctuary-text disabled:opacity-50"
                    >
                      {sendingLetter ? t.sendingLetter : t.submitLetter}
                    </button>
                  </div>
                )}
                {centerStep === 4 && letterReply && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-medium text-sanctuary-text">{t.replyStepTitle}</h2>
                    <div className="rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 p-5 text-sanctuary-text whitespace-pre-wrap">
                      {letterReply}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCenterStep(5)}
                      className="w-full rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 py-4 text-center hover:bg-sanctuary-peach/20 transition-colors font-medium text-sanctuary-text"
                    >
                      {t.todayNext}
                    </button>
                  </div>
                )}
              </div>
            </main>
          </AuthGate>
        </>
      );
    }
    if (isCenterPath && hasStartedCenter && centerStep === 5) {
      return (
        <>
          <AuthHashGate />
          <AuthGate loadingMessage={t.loading}>
            <ThemeBody theme="sanctuary" />
            <main className="min-h-screen">
              <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
                <Nav locale="en" pathname={pathname} theme="dear" />
                <header className="text-center mb-10 pt-4">
                  <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text">
                    {t.heroTitleMain ?? t.title}{` `}
                    <span className="text-sanctuary-flower/90">{t.heroTitleAccent ?? "I'm listening."}</span>
                  </h1>
                </header>
                <div className="space-y-6">
                  <h2 className="text-xl font-medium text-sanctuary-text">{t.completedTitle}</h2>
                  <p className="text-sanctuary-text-soft">{t.completedSub}</p>
                  <Link
                    href={`/${locale}/center#open-chat`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("open-chatbot"));
                      }
                    }}
                    className="block w-full rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 py-4 text-center hover:bg-sanctuary-peach/20 transition-colors font-medium text-sanctuary-text"
                  >
                    {t.continueToChat}
                  </Link>
                </div>
              </div>
            </main>
          </AuthGate>
          <AuthGate loadingMessage={t.loading}>
            <div className="max-w-xl mx-auto px-4 pb-12">
              <div className="pt-8 border-t border-sanctuary-peach/40 space-y-8">
                <PaperCard>
                  <SelfEsteemTest locale="en" />
                </PaperCard>
                <p className="text-center text-sanctuary-text-soft text-sm">
                  {t.assessmentDetailHint}{" "}
                  <Link href={`/${locale}/assessment`} className="underline hover:text-sanctuary-text font-medium">
                    {t.assessmentCta}
                  </Link>
                </p>
                <Link
                  href={`/${locale}/assessment`}
                  className="block rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 p-5 text-center hover:bg-sanctuary-peach/20 transition-colors"
                >
                  <span className="font-medium text-sanctuary-text">{t.assessmentCta}</span>
                  <p className="text-sm text-sanctuary-text-soft mt-1">{t.assessmentCtaSub}</p>
                </Link>
                <SafeMirror locale="en" />
                <SmallWinsStack locale="en" />
                <ResilienceGraph theme="sanctuary" locale="en" />
                <EmotionalBridge theme="sanctuary" locale="en" />
              </div>
              <footer className="mt-12 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft">
                <Link
                  href={`/${locale}/bty`}
                  className="inline-block rounded-xl px-6 py-3 font-medium text-sanctuary-text bg-sanctuary-peach/20 border border-sanctuary-peach/50 hover:bg-sanctuary-peach/30 transition-colors"
                  prefetch={true}
                >
                  {t.ctaToFoundry}
                </Link>
              </footer>
            </div>
          </AuthGate>
        </>
      );
    }
    return (
      <>
        <AuthHashGate />
        <AuthGate loadingMessage={t.loading}>
          <ThemeBody theme="sanctuary" />
          <main className="min-h-screen">
            <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
              <Nav locale="en" pathname={pathname} theme="dear" />
              <header className="text-center mb-10">
                <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">
                  {t.heroTitleMain ?? t.title}{` `}
                  <span className="text-sanctuary-flower/90">{t.heroTitleAccent ?? "I'm listening."}</span>
                </h1>
                <p className="text-sanctuary-text-soft">{t.tagline}</p>
              </header>
              {/* §3: 5문항 맨 위 → 안내 문구 + 50문항 링크 → 50문항 카드 순서 */}
              <div className="space-y-8">
                <PaperCard>
                  <SelfEsteemTest locale="en" />
                </PaperCard>
                <p className="text-center text-sanctuary-text-soft text-sm">
                  {t.assessmentDetailHint}{" "}
                  <Link href={`/${locale}/assessment`} className="underline hover:text-sanctuary-text font-medium">
                    {t.assessmentCta}
                  </Link>
                </p>
                <Link
                  href={`/${locale}/assessment`}
                  className="block rounded-2xl border border-sanctuary-peach/50 bg-sanctuary-peach/10 p-5 text-center hover:bg-sanctuary-peach/20 transition-colors"
                >
                  <span className="font-medium text-sanctuary-text">{t.assessmentCta}</span>
                  <p className="text-sm text-sanctuary-text-soft mt-1">{t.assessmentCtaSub}</p>
                </Link>
                <SafeMirror locale="en" />
                <SmallWinsStack locale="en" />
                <ResilienceGraph theme="sanctuary" locale="en" />
                <EmotionalBridge theme="sanctuary" locale="en" />
              </div>
              <footer className="mt-12 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft">
                <Link
                  href={`/${locale}/bty`}
                  className="inline-block rounded-xl px-6 py-3 font-medium text-sanctuary-text bg-sanctuary-peach/20 border border-sanctuary-peach/50 hover:bg-sanctuary-peach/30 transition-colors"
                  prefetch={true}
                >
                  {t.ctaToFoundry}
                </Link>
              </footer>
            </div>
          </main>
        </AuthGate>
      </>
    );
  }

  if (isCenterPath && !hasStartedCenter) {
    return (
      <>
        <AuthHashGate />
        <AuthGate loadingMessage={t.loading}>
          <ThemeBody theme="dear" />
          <main className="min-h-screen">
            <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
              <Nav locale="ko" pathname={pathname} theme="dear" />
              <header className="text-center mb-14 sm:mb-16 pt-4">
                <h1 className="font-serif text-3xl sm:text-4xl md:text-[2.75rem] font-medium text-dear-charcoal tracking-tight leading-tight">
                  {t.heroTitleMain ?? "Center,"}
                  <br />
                  <span className="text-dear-sage">{t.heroTitleAccent ?? "I'm listening."}</span>
                </h1>
                <p className="mt-4 text-dear-charcoal-soft text-base sm:text-lg font-sans max-w-md mx-auto">
                  {t.tagline}
                </p>
              </header>
              <p className="text-center text-dear-charcoal-soft text-base sm:text-lg mb-8 max-w-md mx-auto">
                {t.entryIntro}
              </p>
              <button
                type="button"
                onClick={() => setHasStartedCenter(true)}
                className="w-full rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-4 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal"
              >
                {t.startCta}
              </button>
            </div>
          </main>
        </AuthGate>
      </>
    );
  }

  const centerStepContent = isCenterPath && hasStartedCenter && (
    <>
      <AuthHashGate />
      <AuthGate loadingMessage={t.loading}>
        <ThemeBody theme="dear" />
        <main className="min-h-screen">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
            <Nav locale="ko" pathname={pathname} theme="dear" />
            <header className="text-center mb-10 pt-4">
              <h1 className="font-serif text-2xl sm:text-3xl font-medium text-dear-charcoal">
                {t.heroTitleMain ?? "Center,"} <span className="text-dear-sage">{t.heroTitleAccent ?? "I'm listening."}</span>
              </h1>
            </header>

            {centerStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-dear-charcoal">{t.todayStepTitle}</h2>
                <div>
                  <label className="block text-sm text-dear-charcoal-soft mb-1">{t.todayMoodLabel}</label>
                  <input
                    type="text"
                    value={todayMood}
                    onChange={(e) => setTodayMood(e.target.value)}
                    placeholder={t.todayMoodPlaceholder}
                    className="w-full rounded-xl border border-dear-sage/30 bg-white/80 px-4 py-3 text-dear-charcoal placeholder:text-dear-charcoal-soft/60"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dear-charcoal-soft mb-1">{t.todayEnergyLabel}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTodayEnergy(n)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          todayEnergy === n
                            ? "border-dear-sage bg-dear-sage/10 text-dear-charcoal"
                            : "border-dear-charcoal/20 text-dear-charcoal-soft hover:border-dear-sage/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-dear-charcoal-soft mb-1">{t.todayOneWordLabel}</label>
                  <input
                    type="text"
                    value={todayOneWord}
                    onChange={(e) => setTodayOneWord(e.target.value)}
                    placeholder={t.todayOneWordPlaceholder}
                    className="w-full rounded-xl border border-dear-sage/30 bg-white/80 px-4 py-3 text-dear-charcoal placeholder:text-dear-charcoal-soft/60"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCenterStep(3)}
                    className="flex-1 rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-4 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal"
                  >
                    {t.todayNext}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterStep(3)}
                    className="rounded-2xl border border-dear-charcoal/10 py-4 px-6 text-dear-charcoal-soft hover:bg-dear-charcoal/5 text-sm"
                  >
                    {t.todaySkip}
                  </button>
                </div>
              </div>
            )}

            {centerStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-dear-charcoal">{t.letterStepTitle}</h2>
                <p className="text-dear-charcoal-soft text-sm">{t.letterPrompt}</p>
                <textarea
                  value={letterBody}
                  onChange={(e) => setLetterBody(e.target.value)}
                  placeholder={t.letterPlaceholder}
                  rows={6}
                  className="w-full rounded-xl border border-dear-sage/30 bg-white/80 px-4 py-3 text-dear-charcoal placeholder:text-dear-charcoal-soft/60 resize-y"
                />
                <button
                  type="button"
                  disabled={!letterBody.trim() || sendingLetter}
                  onClick={async () => {
                    setSendingLetter(true);
                    try {
                      const r = await fetch("/api/center/letter", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          body: letterBody.trim(),
                          mood: todayMood || undefined,
                          energy: todayEnergy !== "" ? todayEnergy : undefined,
                          oneWord: todayOneWord || undefined,
                          lang,
                        }),
                      });
                      const data = await r.json().catch(() => ({}));
                      if (data.reply) setLetterReply(data.reply);
                      setCenterStep(4);
                    } finally {
                      setSendingLetter(false);
                    }
                  }}
                  className="w-full rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-4 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal disabled:opacity-50"
                >
                  {sendingLetter ? t.sendingLetter : t.submitLetter}
                </button>
              </div>
            )}

            {centerStep === 4 && letterReply && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-dear-charcoal">{t.replyStepTitle}</h2>
                <div className="rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-5 text-dear-charcoal whitespace-pre-wrap">
                  {letterReply}
                </div>
                <button
                  type="button"
                  onClick={() => setCenterStep(5)}
                  className="w-full rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-4 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal"
                >
                  {t.todayNext}
                </button>
              </div>
            )}

            {centerStep === 5 && (
              <div className="space-y-6">
                <h2 className="text-xl font-medium text-dear-charcoal">{t.completedTitle}</h2>
                <p className="text-dear-charcoal-soft">{t.completedSub}</p>
                <Link
                  href={`/${locale}/center#open-chat`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("open-chatbot"));
                    }
                  }}
                  className="block w-full rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-4 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal"
                >
                  {t.continueToChat}
                </Link>
              </div>
            )}
          </div>
        </main>
      </AuthGate>
    </>
  );

  if (isCenterPath && hasStartedCenter && centerStep <= 4) {
    return centerStepContent;
  }
  if (isCenterPath && hasStartedCenter && centerStep === 5) {
    return (
      <>
        {centerStepContent}
        <AuthGate loadingMessage={t.loading}>
          <div className="max-w-xl mx-auto px-4 pb-12">
            <div className="pt-8 border-t border-dear-charcoal/10 space-y-8">
              {/* §3: 5문항 맨 위 → 안내 문구 + 50문항 링크 → 50문항 카드 순서 */}
              <PaperCard>
                <SelfEsteemTest locale="ko" theme="dear" />
              </PaperCard>
              <p className="text-center text-dear-charcoal-soft text-sm">
                {t.assessmentDetailHint}{" "}
                <Link href={`/${locale}/assessment`} className="text-dear-sage hover:text-dear-sage-soft underline underline-offset-2 font-medium">
                  {t.assessmentCta}
                </Link>
              </p>
              <Link
                href={`/${locale}/assessment`}
                className="block rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-5 text-center hover:bg-dear-sage/10 transition-colors"
              >
                <span className="font-medium text-dear-charcoal">{t.assessmentCta}</span>
                <p className="text-sm text-dear-charcoal-soft mt-1">{t.assessmentCtaSub}</p>
              </Link>
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
                <EmotionalBridge theme="dear" locale="ko" />
              </PaperCard>
            </div>
            <footer className="mt-12 pt-6 border-t border-dear-charcoal/10 text-center text-sm text-dear-charcoal-soft">
              <Link
                href={`/${locale}/bty`}
                className="inline-block rounded-xl px-6 py-3 font-medium text-dear-charcoal bg-dear-sage/10 border border-dear-sage/30 hover:bg-dear-sage/20 transition-colors"
                prefetch={true}
              >
                {t.ctaToFoundry}
              </Link>
            </footer>
          </div>
        </AuthGate>
      </>
    );
  }

  return (
    <>
      <AuthHashGate />
      <AuthGate loadingMessage={t.loading}>
        <ThemeBody theme="dear" />
        <main className="min-h-screen">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
            <Nav locale="ko" pathname={pathname} theme="dear" />
            <header className="text-center mb-14 sm:mb-16 pt-4">
              <h1 className="font-serif text-3xl sm:text-4xl md:text-[2.75rem] font-medium text-dear-charcoal tracking-tight leading-tight">
                {t.heroTitleMain ?? "Center,"}
                <br />
                <span className="text-dear-sage">{t.heroTitleAccent ?? "I'm listening."}</span>
              </h1>
              <p className="mt-4 text-dear-charcoal-soft text-base sm:text-lg font-sans max-w-md mx-auto">
                {t.tagline}
              </p>
            </header>
            {/* §3: 5문항 맨 위 → 안내 문구 + 50문항 링크 → 50문항 카드 순서 */}
            <div className="space-y-8">
              <PaperCard>
                <SelfEsteemTest locale="ko" theme="dear" />
              </PaperCard>
              <p className="text-center text-dear-charcoal-soft text-sm">
                {t.assessmentDetailHint}{" "}
                <Link href={`/${locale}/assessment`} className="text-dear-sage hover:text-dear-sage-soft underline underline-offset-2 font-medium">
                  {t.assessmentCta}
                </Link>
              </p>
              <Link
                href={`/${locale}/assessment`}
                className="block rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-5 text-center hover:bg-dear-sage/10 transition-colors"
              >
                <span className="font-medium text-dear-charcoal">{t.assessmentCta}</span>
                <p className="text-sm text-dear-charcoal-soft mt-1">{t.assessmentCtaSub}</p>
              </Link>
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
                <EmotionalBridge theme="dear" locale="ko" />
              </PaperCard>
            </div>
            <footer className="mt-12 pt-6 border-t border-dear-charcoal/10 text-center text-sm text-dear-charcoal-soft">
              <Link
                href={`/${locale}/bty`}
                className="inline-block rounded-xl px-6 py-3 font-medium text-dear-charcoal bg-dear-sage/10 border border-dear-sage/30 hover:bg-dear-sage/20 transition-colors"
                prefetch={true}
              >
                {t.ctaToFoundry}
              </Link>
            </footer>
          </div>
        </main>
      </AuthGate>
    </>
  );
}
