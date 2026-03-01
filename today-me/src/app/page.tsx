"use client";

import { useState, useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { SafeMirror } from "@/components/SafeMirror";
import { SmallWinsStack } from "@/components/SmallWinsStack";
import { SelfEsteemTest, type SelfEsteemLocale } from "@/components/SelfEsteemTest";

const LANG_KEY = "dearme:lang";

export default function TodayMePage() {
  const [locale, setLocale] = useState<SelfEsteemLocale>("ko");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LANG_KEY) : null;
    if (stored === "en" || stored === "ko") setLocale(stored);
  }, []);

  const setLocaleAndStore = (next: SelfEsteemLocale) => {
    setLocale(next);
    if (typeof window !== "undefined") localStorage.setItem(LANG_KEY, next);
  };

  return (
    <AuthGate>
    <main className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        <header className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">
            Dear Me
          </h1>
          <p className="text-sanctuary-text-soft">
            {locale === "ko" ? "나는 안전하다. 잠시 쉬어가도 돼요." : "I am safe. It's okay to rest a while."}
          </p>
          <div className="flex justify-center gap-2 mt-3 text-sm">
            <button
              type="button"
              onClick={() => setLocaleAndStore("en")}
              className={`px-3 py-1 rounded ${locale === "en" ? "font-medium underline bg-black/5" : "text-sanctuary-text-soft hover:text-sanctuary-text"}`}
            >
              EN
            </button>
            <span className="text-sanctuary-text-soft/60">|</span>
            <button
              type="button"
              onClick={() => setLocaleAndStore("ko")}
              className={`px-3 py-1 rounded ${locale === "ko" ? "font-medium underline bg-black/5" : "text-sanctuary-text-soft hover:text-sanctuary-text"}`}
            >
              KO
            </button>
          </div>
        </header>

        <div className="space-y-8">
          <SafeMirror />
          <SmallWinsStack />
          <SelfEsteemTest locale={locale} />
        </div>

        <footer className="mt-12 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft space-x-4">
          <a
            href="/journey"
            className="underline hover:text-sanctuary-text"
          >
            28일 여정
          </a>
          <span>·</span>
          <a
            href="https://bty-website.pages.dev"
            className="underline hover:text-sanctuary-text"
          >
            어제보다 나은 연습하러 가기 (bty)
          </a>
        </footer>
      </div>
    </main>
    </AuthGate>
  );
}
