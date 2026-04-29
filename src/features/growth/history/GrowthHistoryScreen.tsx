"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type GrowthHistoryScreenProps = {
  locale: string;
  reflections: ReflectionEntry[];
  /** Arena low regulation and/or repeated regulation reflections (`shouldShowCompoundRecovery`). */
  recoveryTriggered: boolean;
  onOpenLatestReflection?: () => void;
  onOpenRecovery?: () => void;
  onReturnToArena?: () => void;
  onBackToGrowth?: () => void;
};

function GlassPanel({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={[
        "rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-2xl backdrop-blur-xl",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </section>
  );
}

function formatDate(timestamp: number, locale: Locale) {
  return new Date(timestamp).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    year: locale === "ko" ? undefined : "numeric",
  });
}

function computeFocusCounts(reflections: ReflectionEntry[]) {
  const chronological = [...reflections].sort((a, b) => a.createdAt - b.createdAt);
  const recent = chronological.slice(-5);
  return {
    clarity: recent.filter((r) => r.focus === "clarity").length,
    trust: recent.filter((r) => r.focus === "trust").length,
    regulation: recent.filter((r) => r.focus === "regulation").length,
    alignment: recent.filter((r) => r.focus === "alignment").length,
  };
}

function GrowthHistoryHeader({
  total,
  eyebrow,
  headline,
  lead,
  countLabel,
}: {
  total: number;
  eyebrow: string;
  headline: string;
  lead: string;
  countLabel: string;
}) {
  return (
    <GlassPanel className="p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{eyebrow}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{headline}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{lead}</p>
        </div>

        <div className="min-w-[180px] shrink-0 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{countLabel}</div>
          <p className="mt-2 text-2xl font-semibold text-white tabular-nums">{total}</p>
        </div>
      </div>
    </GlassPanel>
  );
}

function SummaryCapsule({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium tabular-nums text-white">{value}</div>
    </GlassPanel>
  );
}

function getFocusPillLabel(focus: ReflectionEntry["focus"], t: ReturnType<typeof getMessages>["uxPhase1Stub"]) {
  switch (focus) {
    case "clarity":
      return t.growthHistoryCapsuleClarity;
    case "trust":
      return t.growthHistoryCapsuleTrust;
    case "regulation":
      return t.growthHistoryCapsuleRegulation;
    case "alignment":
    default:
      return t.growthHistoryCapsuleAlignment;
  }
}

function ReflectionHistoryCard({
  entry,
  locale,
  commitmentLabel,
  arenaBadge,
}: {
  entry: ReflectionEntry;
  locale: Locale;
  commitmentLabel: string;
  arenaBadge: string;
}) {
  const t = getMessages(locale).uxPhase1Stub;
  return (
    <GlassPanel className="p-5" data-testid="reflection-history-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100">
            {getFocusPillLabel(entry.focus, t)}
          </span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {formatDate(entry.createdAt, locale)}
          </span>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
          {arenaBadge}
        </span>
      </div>

      <div>
        <h2 className="text-xl font-semibold leading-tight text-white">{entry.promptTitle}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">{entry.promptBody}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{commitmentLabel}</div>
        <p className="mt-2 text-sm leading-7 text-slate-200">{entry.commitment}</p>
      </div>
    </GlassPanel>
  );
}

function RecoverySignalStrip({
  visible,
  title,
  body,
  cta,
  onOpenRecovery,
}: {
  visible: boolean;
  title: string;
  body: string;
  cta: string;
  onOpenRecovery?: () => void;
}) {
  if (!visible) return null;

  return (
    <GlassPanel
      className="border-cyan-300/15 bg-cyan-400/[0.05] p-5"
      data-testid="recovery-signal-strip"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{title}</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{body}</p>
        </div>

        {onOpenRecovery ? (
          <button
            type="button"
            data-testid="open-recovery"
            onClick={onOpenRecovery}
            className="h-11 shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.08] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.12]"
          >
            {cta}
          </button>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function EmptyHistoryState({
  eyebrow,
  title,
  subtext,
  cta,
  onReturnToArena,
}: {
  eyebrow: string;
  title: string;
  subtext: string;
  cta: string;
  onReturnToArena?: () => void;
}) {
  return (
    <GlassPanel className="p-8">
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{eyebrow}</div>
        <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">{subtext}</p>

        {onReturnToArena ? (
          <button
            type="button"
            onClick={onReturnToArena}
            className="mt-6 h-12 rounded-2xl bg-[#1E2A38] px-5 text-sm font-medium text-white transition hover:bg-[#243446]"
          >
            {cta}
          </button>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function GrowthHistoryActions({
  hasReflections,
  openLatestLabel,
  returnArenaLabel,
  onOpenLatestReflection,
  onReturnToArena,
}: {
  hasReflections: boolean;
  openLatestLabel: string;
  returnArenaLabel: string;
  onOpenLatestReflection?: () => void;
  onReturnToArena?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <button
        type="button"
        data-testid="open-latest-reflection"
        onClick={onOpenLatestReflection}
        disabled={!hasReflections}
        className={[
          "h-12 rounded-2xl px-4 text-sm font-medium transition",
          hasReflections
            ? "bg-[#1E2A38] text-white hover:bg-[#243446]"
            : "cursor-not-allowed bg-white/[0.05] text-slate-500",
        ].join(" ")}
      >
        {openLatestLabel}
      </button>

      <button
        type="button"
        onClick={onReturnToArena}
        className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
      >
        {returnArenaLabel}
      </button>
    </div>
  );
}

/**
 * Leadership growth record board — Arena judgment → translated reflection → quiet pattern signal.
 * Not a journaling feed, mood log, or noisy dashboard.
 */
export default function GrowthHistoryScreen({
  locale,
  reflections,
  recoveryTriggered,
  onOpenLatestReflection,
  onOpenRecovery,
  onReturnToArena,
  onBackToGrowth,
}: GrowthHistoryScreenProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  const hasReflections = reflections.length > 0;
  const latestFirst = [...reflections].sort((a, b) => b.createdAt - a.createdAt);
  const focusCounts = computeFocusCounts(reflections);

  return (
    <main
      data-testid="growth-history-screen"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-5 text-white sm:px-6"
      aria-label={t.growthHistoryRegionAria}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <GrowthHistoryHeader
          total={reflections.length}
          eyebrow={t.growthHistoryEyebrow}
          headline={t.growthHistoryHeadline}
          lead={t.growthHistoryLead}
          countLabel={t.growthHistoryReflectionCountLabel}
        />

        <section
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
          aria-label={t.growthHistoryRegionAria}
        >
          <SummaryCapsule label={t.growthHistoryCapsuleClarity} value={`${focusCounts.clarity}`} />
          <SummaryCapsule label={t.growthHistoryCapsuleTrust} value={`${focusCounts.trust}`} />
          <SummaryCapsule label={t.growthHistoryCapsuleRegulation} value={`${focusCounts.regulation}`} />
          <SummaryCapsule label={t.growthHistoryCapsuleAlignment} value={`${focusCounts.alignment}`} />
        </section>

        <RecoverySignalStrip
          visible={recoveryTriggered}
          title={t.growthHistoryRecoveryTitle}
          body={t.growthHistoryRecoveryStrip}
          cta={t.growthHistoryOpenRecoveryCta}
          onOpenRecovery={onOpenRecovery}
        />

        {hasReflections ? (
          <section data-testid="growth-history-list" className="space-y-5">
            {latestFirst.map((entry) => (
              <ReflectionHistoryCard
                key={entry.id}
                entry={entry}
                locale={loc}
                commitmentLabel={t.growthHistoryCommitmentLabel}
                arenaBadge={t.growthHistoryArenaReflectionBadge}
              />
            ))}
          </section>
        ) : (
          <EmptyHistoryState
            eyebrow={t.growthHistoryEmptyEyebrow}
            title={t.growthHistoryEmptyTitle}
            subtext={t.growthHistoryEmptySubtext}
            cta={t.growthHistoryCtaReturnArena}
            onReturnToArena={onReturnToArena}
          />
        )}

        <GrowthHistoryActions
          hasReflections={hasReflections}
          openLatestLabel={t.growthHistoryCtaOpenLatest}
          returnArenaLabel={t.growthHistoryCtaReturnArena}
          onOpenLatestReflection={onOpenLatestReflection}
          onReturnToArena={onReturnToArena}
        />

        {onBackToGrowth ? (
          <div className="pb-6 pt-2 text-center">
            <button
              type="button"
              onClick={onBackToGrowth}
              className="text-sm font-medium text-cyan-200/80 underline-offset-4 transition hover:text-cyan-100 hover:underline"
            >
              {t.growthHistoryBackGrowth}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
