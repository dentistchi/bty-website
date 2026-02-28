"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { EmotionalStatsPhrases } from "@/components/bty/EmotionalStatsPhrases";

type BtyMessages = {
  title: string;
  tagline: string;
  linkToTodayMe: string;
  entryIntro: string;
  startCta: string;
};

type Props = { locale: string; t: BtyMessages };

/** PROJECT_BACKLOG §7: Dojo 진입 — 소개 + 시작하기, 클릭 시 1단계(멘토)로 이동 */
export default function BtyIndexPage({ locale, t }: Props) {
  const router = useRouter();
  return (
    <ArenaLayoutShell>
      <div className="max-w-xl mx-auto px-4 py-8">
        <BtyTopNav />
        <header className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--arena-text)] mb-2">{t.title}</h1>
          <p className="text-[var(--arena-text-soft)]">{t.tagline}</p>
        </header>
        <p className="text-center text-[var(--arena-text-soft)] mb-6 max-w-md mx-auto">{t.entryIntro}</p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/bty/mentor`)}
          className="w-full bty-btn-primary rounded-xl py-4 text-center font-semibold text-white"
          style={{ background: "var(--arena-accent)" }}
        >
          {t.startCta}
        </button>
        <footer className="mt-8 pt-6 border-t border-[var(--arena-text-soft)]/20 text-center text-sm text-[var(--arena-text-soft)]">
          <EmotionalStatsPhrases />
          <div className="mt-4">
          <Link href={`/${locale}/bty/dashboard`} className="text-[var(--arena-accent)] hover:underline">
            Dashboard
          </Link>
          {" · "}
          <Link href={`/${locale}/bty-arena`} className="text-[var(--arena-accent)] hover:underline">
            Arena
          </Link>
          </div>
        </footer>
      </div>
    </ArenaLayoutShell>
  );
}
