"use client";

import { useState } from "react";
import { ArenaRoom } from "@/components/app-shell/ArenaRoom";
import FieldActionsFocus from "@/components/app-shell/FieldActionsFocus";

/**
 * Practice — landing surface (App Shell + Today Simplification V1, Phase 6).
 *
 * A calm entry surface for the "Practice" tab. It does NOT expose internal runtime-state vocabulary;
 * it offers a small set of doors:
 *   • Arena practice — the existing in-shell Arena runtime (unchanged), opened in place.
 *   • Field Actions — opens the focused in-shell Field Actions surface ({@link FieldActionsFocus}),
 *     the learner's (and authorized reviewer's) full Field Action state. Never redirects to Today.
 *   • Live Experiences — a calm "Coming next" placeholder; no canonical scheduled-event contract
 *     exists in code yet, so nothing is fabricated (directive: adapter/placeholder only).
 *   • Scan QR — shown only when authorized; there is no in-shell scanner in V1, so it stays a gated
 *     "Coming next" placeholder (respects permissions — never a live control the learner can't use).
 *
 * No canonical data, lifecycle, or Arena runtime behavior is changed here — this is IA only.
 */

type Locale = "en" | "ko";

const COPY: Record<Locale, {
  eyebrow: string;
  title: string;
  arena: string;
  arenaSub: string;
  fieldActions: string;
  fieldActionsSub: string;
  live: string;
  liveSub: string;
  comingNext: string;
  qr: string;
  qrSub: string;
  back: string;
}> = {
  en: {
    eyebrow: "Practice",
    title: "Practice it before you need it.",
    arena: "Practice situations",
    arenaSub: "Rehearse a real decision in a safe room.",
    fieldActions: "Action plans",
    fieldActionsSub: "Your action plans for real life.",
    live: "Live sessions",
    liveSub: "Scheduled practice with other people.",
    comingNext: "Coming next",
    qr: "Scan QR",
    qrSub: "Verify a completed action.",
    back: "Back",
  },
  ko: {
    eyebrow: "연습",
    title: "필요해지기 전에 미리 연습하세요.",
    arena: "연습 상황",
    arenaSub: "안전한 방에서 실제 결정을 미리 연습합니다.",
    fieldActions: "행동 계획",
    fieldActionsSub: "실제 삶을 위한 나의 행동 계획.",
    live: "라이브 세션",
    liveSub: "다른 사람들과 함께하는 예정된 연습.",
    comingNext: "곧 제공됩니다",
    qr: "QR 스캔",
    qrSub: "완료한 행동을 확인합니다.",
    back: "뒤로",
  },
};

function DoorRow({
  title,
  sub,
  badge,
  onClick,
  href,
  testId,
  disabled,
}: {
  title: string;
  sub: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
  testId: string;
  disabled?: boolean;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[0.95rem] font-medium text-white/90">{title}</span>
        <span className="truncate text-[0.78rem] text-white/50">{sub}</span>
      </div>
      {badge ? (
        <span className="shrink-0 rounded-md border border-white/12 px-2 py-0.5 text-[0.66rem] text-white/45">{badge}</span>
      ) : (
        <span aria-hidden className="shrink-0 text-white/30">›</span>
      )}
    </div>
  );
  const cls =
    "block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3" +
    (disabled ? " opacity-60" : "");
  if (href) {
    return (
      <a href={href} data-testid={testId} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className={cls + " w-full text-left"}>
      {inner}
    </button>
  );
}

export default function PracticeLanding({
  locale,
  lockedTag,
  lockedBody,
  qrAuthorized = false,
  initialView = "landing",
  initialFieldActionId = null,
  onFieldActionConsumed,
}: {
  locale: string;
  lockedTag: string;
  lockedBody: string;
  /** QR scan is offered only when authorized; V1 has no in-shell scanner, so it stays a placeholder. */
  qrAuthorized?: boolean;
  /** Deep-link entry: open the focused Field Actions surface directly (?tab=practice&fieldAction=). */
  initialView?: "landing" | "fieldActions";
  initialFieldActionId?: string | null;
  /** Cleared once the deep-link focus is consumed so a later Back never re-opens it. */
  onFieldActionConsumed?: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [view, setView] = useState<"landing" | "arena" | "fieldActions">(
    initialView === "fieldActions" || initialFieldActionId ? "fieldActions" : "landing",
  );

  if (view === "arena") {
    return (
      <div className="flex flex-col gap-4" data-testid="practice-arena">
        <button
          type="button"
          data-testid="practice-arena-back"
          onClick={() => setView("landing")}
          className="self-start text-xs font-medium text-white/55 hover:text-white/85"
        >
          ‹ {t.back}
        </button>
        <ArenaRoom locale={locale} lockedTag={lockedTag} lockedBody={lockedBody} />
      </div>
    );
  }

  if (view === "fieldActions") {
    return (
      <FieldActionsFocus
        locale={locale}
        initialFieldActionId={initialFieldActionId}
        onBack={() => {
          setView("landing");
          onFieldActionConsumed?.();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="practice-landing">
      <header className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/80">{t.eyebrow}</span>
        <h1 className="text-[1.4rem] font-semibold leading-tight tracking-tight text-white">{t.title}</h1>
      </header>
      <div className="flex flex-col gap-2">
        <DoorRow testId="practice-arena-entry" title={t.arena} sub={t.arenaSub} onClick={() => setView("arena")} />
        <DoorRow testId="practice-field-actions" title={t.fieldActions} sub={t.fieldActionsSub} onClick={() => setView("fieldActions")} />
        <DoorRow testId="practice-live" title={t.live} sub={t.liveSub} badge={t.comingNext} disabled />
        {qrAuthorized ? (
          <DoorRow testId="practice-qr" title={t.qr} sub={t.qrSub} badge={t.comingNext} disabled />
        ) : null}
      </div>
    </div>
  );
}
