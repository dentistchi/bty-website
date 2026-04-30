"use client";

import React from "react";
import Link from "next/link";
import {
  ProgramRecommenderWidget,
  PROGRAM_COMPLETED_EVENT,
  type ProgramCompletedDetail,
} from "@/components/foundry/ProgramRecommenderWidget";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

type BtyMessages = {
  dashboardLabel: string;
  leaderboardLabel: string;
};
type Land = {
  foundryTitle: string;
  foundryDesc: string;
};

// ── Arena 복귀 배너 ───────────────────────────────────────────────────────────
function ArenaReturnBanner({
  locale,
  isKo,
  programTitle,
  onDismiss,
}: {
  locale: string;
  isKo: boolean;
  programTitle: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start justify-between gap-4"
      role="status"
      aria-label={isKo ? "Arena 복귀 안내" : "Return to Arena"}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-800 m-0">
          {isKo ? `"${programTitle}" 완료! 🎉` : `"${programTitle}" complete! 🎉`}
        </p>
        <p className="text-xs text-green-700 mt-0.5 m-0">
          {isKo
            ? "Foundry 학습을 Arena 실전에서 적용할 시간이에요."
            : "Time to apply your Foundry learning in Arena."}
        </p>
        <div className="flex gap-2 mt-2">
          <Link
            href={`/${locale}/bty-arena`}
            className="inline-block px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs font-semibold hover:bg-green-800 transition-colors"
          >
            {isKo ? "Arena로 돌아가기 →" : "Return to Arena →"}
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-green-700 underline hover:no-underline"
          >
            {isKo ? "나중에" : "Later"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 전체 프로그램 카탈로그 ────────────────────────────────────────────────────
type CatalogRow = {
  program_id: string;
  title: string;
  phase_tags: string[] | null;
  scenario_tags: string[] | null;
};

function AllProgramsSection({ locale, isKo }: { locale: string; isKo: boolean }) {
  const [programs, setPrograms] = React.useState<CatalogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb
          .from("program_catalog")
          .select("program_id, title, phase_tags, scenario_tags")
          .order("program_id");
        if (alive) setPrograms(Array.isArray(data) ? (data as CatalogRow[]) : []);
      } catch {
        if (alive) setPrograms([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!loading && programs.length === 0) return null;

  return (
    <section aria-label={isKo ? "전체 프로그램 카탈로그" : "All programs catalog"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left mb-3"
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-[var(--arena-text)] m-0">
          {isKo ? "전체 프로그램" : "All programs"}
          {!loading && programs.length > 0 && (
            <span className="ml-1.5 text-[10px] font-normal text-[var(--arena-text-soft)]">
              {programs.length}
            </span>
          )}
        </h2>
        <span className="text-xs text-[var(--arena-text-soft)]" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        loading ? (
          <p className="text-xs text-[var(--arena-text-soft)]">
            {isKo ? "불러오는 중…" : "Loading…"}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none p-0 m-0">
            {programs.map((p) => (
              <li key={p.program_id}>
                <Link
                  href={`/${locale}/bty/foundry/program/${encodeURIComponent(p.program_id)}`}
                  className="block rounded-xl border border-[var(--arena-text-soft)]/20 bg-white/80 px-4 py-3 hover:border-[var(--arena-accent)]/40 hover:shadow-sm transition-all"
                  aria-label={p.title}
                >
                  <div className="text-sm font-medium text-[var(--arena-text)]">{p.title}</div>
                  {p.phase_tags && p.phase_tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.phase_tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--arena-accent)]/10 text-[var(--arena-accent)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

// ── Dr. Chi 인라인 채팅 ───────────────────────────────────────────────────────
type QuickMsg = { role: "user" | "assistant"; content: string };

function DrChiQuickChat({ locale, isKo }: { locale: string; isKo: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState<QuickMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: QuickMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          mode: "foundry",
          lang: isKo ? "ko" : "en",
        }),
      });
      const data: { message?: string } = await r.json().catch(() => ({}));
      const reply = data.message ?? (isKo ? "잠시 후 다시 시도해 주세요." : "Try again in a moment.");
      setMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((prev) => [
        ...prev,
        { role: "assistant", content: isKo ? "연결에 실패했어요." : "Connection failed." },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, msgs, sending, isKo]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section
      className="rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/80 px-4 py-4"
      aria-label={isKo ? "Dr. Chi 빠른 대화" : "Dr. Chi quick chat"}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-sm font-semibold text-[var(--arena-text)]">
            💬 {isKo ? "Dr. Chi에게 물어보기" : "Ask Dr. Chi"}
          </div>
          <div className="text-xs text-[var(--arena-text-soft)] mt-0.5">
            {isKo ? "Foundry 실천에 대해 짧게 질문하세요" : "Quick question about your practice"}
          </div>
        </div>
        <span className="text-xs text-[var(--arena-text-soft)]" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div
            ref={listRef}
            className="flex flex-col gap-2 overflow-y-auto mb-3"
            style={{ maxHeight: 260, minHeight: msgs.length > 0 ? 60 : 0 }}
            role="log"
            aria-live="polite"
            aria-label={isKo ? "대화 내역" : "Conversation"}
          >
            {msgs.length === 0 && (
              <p className="text-xs text-[var(--arena-text-soft)] m-0">
                {isKo
                  ? '"오늘 가장 어려웠던 순간을 말해줘"'
                  : '"Tell me what felt hardest today"'}
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded-xl max-w-[88%] ${
                  m.role === "user"
                    ? "self-end bg-[var(--arena-accent)] text-white"
                    : "self-start bg-[var(--arena-text-soft)]/10 text-[var(--arena-text)]"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="self-start text-xs text-[var(--arena-text-soft)] m-0">
                {isKo ? "생각 중…" : "Thinking…"}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={isKo ? "Dr. Chi에게 메시지…" : "Message Dr. Chi…"}
              className="flex-1 rounded-lg border border-[var(--arena-text-soft)]/30 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--arena-accent)]/60"
              aria-label={isKo ? "Dr. Chi에게 메시지" : "Message to Dr. Chi"}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || sending}
              className="px-3 py-2 rounded-lg bg-[var(--arena-accent)] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              aria-label={isKo ? "전송" : "Send"}
            >
              {isKo ? "전송" : "Send"}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link
              href={`/${locale}/bty/mentor`}
              className="text-xs text-[var(--arena-accent)] hover:underline"
            >
              {isKo ? "전체 대화 보기 →" : "Full conversation →"}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

// ── 허브 메인 ─────────────────────────────────────────────────────────────────
export default function FoundryHubClient({
  locale,
  t,
  tLand,
}: {
  locale: string;
  t: BtyMessages;
  tLand: Land;
}) {
  const isKo = locale === "ko";
  const tBty = getMessages((isKo ? "ko" : "en") as Locale).bty;

  const [returnDetail, setReturnDetail] = React.useState<ProgramCompletedDetail | null>(null);

  React.useEffect(() => {
    const onComplete = (ev: Event) => {
      const detail = (ev as CustomEvent<ProgramCompletedDetail>).detail;
      if (detail?.programId) setReturnDetail(detail);
    };
    window.addEventListener(PROGRAM_COMPLETED_EVENT, onComplete);
    return () => window.removeEventListener(PROGRAM_COMPLETED_EVENT, onComplete);
  }, []);

  const features: { icon: string; title: string; desc: string; href: string }[] = [
    {
      icon: "🎯",
      title: isKo ? "Dojo 50문항" : "Dojo 50 Questions",
      desc: isKo ? "오늘의 나를 진단하는 50문항 테스트" : "50-question self-assessment for today",
      href: `/${locale}/bty/dojo`,
    },
    {
      icon: "🪞",
      title: isKo ? "역지사지 연습" : "Integrity Mirror",
      desc: isKo ? "갈등 상황을 상대 입장에서 돌려보기" : "See conflicts from the other side",
      href: `/${locale}/bty/integrity`,
    },
    {
      icon: "💬",
      title: isKo ? "Dr. Chi 전체 대화" : "Dr. Chi (full)",
      desc: isKo ? "AI 멘토와 1:1 심층 성장 대화" : "In-depth 1:1 growth conversation",
      href: `/${locale}/bty/mentor`,
    },
    {
      icon: "📈",
      title: isKo ? "대시보드" : "Dashboard",
      desc: isKo ? "나의 성장 기록과 통계" : "Your growth records and stats",
      href: `/${locale}/bty/dashboard`,
    },
    {
      icon: "🏆",
      title: "Elite",
      desc: isKo ? "Elite 전용 콘텐츠" : "Elite-exclusive content",
      href: `/${locale}/bty/elite`,
    },
  ];

  return (
    <main className="max-w-xl mx-auto px-4 py-8 space-y-6" aria-label={tBty.foundryHubMainLandmarkAria}>
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${locale}/bty`}
          className="text-sm text-[var(--arena-accent)] font-medium"
          aria-label={tBty.foundryBackToBtyHome}
        >
          {tBty.foundryBackToBtyHome}
        </Link>
        <Link
          href={`/${locale}/bty-arena`}
          className="text-sm text-[var(--arena-text-soft)] hover:text-[var(--arena-accent)] font-medium transition-colors"
          aria-label={isKo ? "Arena로 가기" : "Go to Arena"}
        >
          {isKo ? "Arena →" : "Arena →"}
        </Link>
      </div>

      {/* Arena 복귀 배너 */}
      {returnDetail && (
        <ArenaReturnBanner
          locale={locale}
          isKo={isKo}
          programTitle={returnDetail.programId}
          onDismiss={() => setReturnDetail(null)}
        />
      )}

      {/* 헤더 */}
      <header>
        <h1 className="text-2xl font-semibold text-[var(--arena-text)]">{tLand.foundryTitle}</h1>
        <p className="text-[var(--arena-text-soft)] mt-1 text-sm">{tLand.foundryDesc}</p>
      </header>

      {/* 개인화 Top-3 추천 */}
      <ProgramRecommenderWidget locale={locale} />

      {/* 전체 프로그램 카탈로그 */}
      <AllProgramsSection locale={locale} isKo={isKo} />

      {/* Dr. Chi 인라인 채팅 */}
      <DrChiQuickChat locale={locale} isKo={isKo} />

      {/* 도구 카드 */}
      <section aria-label={tBty.foundryFeatureCardsRegionAria}>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0" role="list">
          {features.map((f) => (
            <li key={f.href}>
              <Link
                href={f.href}
                className="flex items-start gap-4 rounded-2xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/80 px-5 py-4 min-h-[100px] shadow-sm hover:shadow-md hover:border-[var(--arena-accent)]/40 transition-all"
                aria-label={`${f.title}. ${f.desc}`}
              >
                <span className="text-3xl shrink-0" aria-hidden>
                  {f.icon}
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--arena-text)]">{f.title}</div>
                  <div className="text-xs text-[var(--arena-text-soft)] mt-1">{f.desc}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="text-center" aria-label={t.leaderboardLabel}>
        <Link href={`/${locale}/bty/leaderboard`} className="text-[var(--arena-accent)] font-medium text-sm">
          {t.leaderboardLabel}
        </Link>
      </nav>
    </main>
  );
}
