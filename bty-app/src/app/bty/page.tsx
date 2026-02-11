"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Comeback } from "@/components/Comeback";
import { JourneyGraph } from "@/components/JourneyGraph";
import { Nav } from "@/components/Nav";
import { PracticeJournal } from "@/components/PracticeJournal";
import { ThemeBody } from "@/components/ThemeBody";
import { cn } from "@/lib/utils";

export default function BTYPage() {
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <Comeback />
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale="ko" pathname="/bty" />
          <header className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-semibold text-dojo-purple-dark">bty</h1>
            <p className="text-dojo-ink-soft mt-1">어제보다 나은 연습. Integrity & Practice.</p>
          </header>
          <div className="space-y-8">
            <Link
              href="/bty/integrity"
              className={cn(
                "block rounded-2xl border border-dojo-purple-muted bg-dojo-white p-6 sm:p-8",
                "shadow-sm hover:bg-dojo-purple/5 hover:border-dojo-purple/40 transition-colors"
              )}
            >
              <h2 className="text-xl font-semibold text-dojo-purple-dark">
                역지사지 시뮬레이터
              </h2>
              <p className="text-sm text-dojo-ink-soft mt-1">
                갈등 상황을 입력하면 Dr. Chi가 &quot;만약 입장이 반대라면 어떨까요?&quot;로
                되묻는 채팅을 진행해요.
              </p>
              <span className="inline-block mt-3 text-dojo-purple font-medium text-sm hover:underline">
                채팅으로 이동 →
              </span>
            </Link>
            <PracticeJournal onRecordComplete={() => setJournalRefreshKey((k) => k + 1)} />
            <JourneyGraph refreshKey={journalRefreshKey} />
          </div>
          <footer className="mt-12 pt-6 border-t border-dojo-purple-muted text-center text-sm text-dojo-ink-soft">
            <a href="/" className="text-dojo-purple hover:underline">
              Dear Me로 가기
            </a>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
