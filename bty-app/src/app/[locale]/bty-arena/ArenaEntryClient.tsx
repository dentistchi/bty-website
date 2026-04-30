"use client";

import React, { useState } from "react";
import Link from "next/link";
import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

const copy = {
  ko: {
    heading: "어떻게 훈련하겠습니까?",
    fullTitle: "Full Arena",
    fullDesc: "정식 훈련 — 7단계 리더십 플로우, 전체 XP",
    quickTitle: "Quick Decision",
    quickDesc: "빠른 결정 — 단일 시나리오, 즉각 행동",
  },
  en: {
    heading: "How would you like to train?",
    fullTitle: "Full Arena",
    fullDesc: "Full training — 7-step leadership flow, full XP",
    quickTitle: "Quick Decision",
    quickDesc: "Fast decision — single scenario, immediate action",
  },
};

interface Props {
  locale: string;
}

export default function ArenaEntryClient({ locale }: Props) {
  const isKo = locale !== "en";
  const t = isKo ? copy.ko : copy.en;
  const [mode, setMode] = useState<"select" | "full">("select");

  if (mode === "full") {
    return <BtyArenaRunPageClient pipelineDefault="new" />;
  }

  const quickHref = `/${locale}/bty-arena/quick`;

  return (
    <div className="min-h-screen bg-[var(--arena-bg)] text-[var(--arena-text)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-lg font-semibold text-center">{t.heading}</h1>

        <div className="flex flex-col gap-3">
          {/* Full Arena */}
          <button
            onClick={() => setMode("full")}
            className="w-full rounded-2xl border border-[var(--arena-accent)]/40 bg-[var(--arena-accent)]/5 hover:bg-[var(--arena-accent)]/10 px-5 py-4 text-left transition-colors group"
          >
            <p className="font-semibold text-[var(--arena-accent)] group-hover:underline">
              {t.fullTitle}
            </p>
            <p className="text-xs text-[var(--arena-text)]/60 mt-0.5">{t.fullDesc}</p>
          </button>

          {/* Quick Decision */}
          <Link
            href={quickHref}
            className="w-full rounded-2xl border border-[var(--arena-text)]/15 hover:border-[var(--arena-accent)]/30 px-5 py-4 text-left transition-colors group block"
          >
            <p className="font-semibold text-[var(--arena-text)] group-hover:text-[var(--arena-accent)] transition-colors">
              {t.quickTitle}
            </p>
            <p className="text-xs text-[var(--arena-text)]/60 mt-0.5">{t.quickDesc}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
