"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { leadershipCoreTraceLabel } from "@/features/my-page/logic";
import type { LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type PremiumMyPageIdentityScreenProps = {
  locale: string;
  metrics: LeadershipMetrics;
  state: LeadershipState;
  mounted: boolean;
  reflections: ReflectionEntry[];
};

function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-2xl backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{children}</div>
  );
}

function crestLetters(codeName: string): string {
  const parts = codeName.split(/[\s_:-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[1][0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  return codeName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "BT";
}

function MiniCrest({ codeName }: { codeName: string }) {
  const letters = crestLetters(codeName);
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/[0.05] ring-1 ring-white/5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-semibold tracking-[0.25em] text-cyan-100/90">
        {letters}
      </div>
    </div>
  );
}

function IdentityHero({
  codeName,
  stage,
  headline,
  systemNote,
  systemNoteTitle,
  coreTraceCaption,
  coreTraceLabel,
  identityEyebrow,
}: {
  codeName: string;
  stage: string;
  headline: string;
  systemNote: string;
  systemNoteTitle: string;
  coreTraceCaption: string;
  coreTraceLabel: string;
  identityEyebrow: string;
}) {
  return (
    <GlassPanel className="p-6 sm:p-8" data-testid="identity-hero">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <SectionLabel>{identityEyebrow}</SectionLabel>
          <h1
            data-testid="my-page-code-name"
            className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-5xl"
          >
            {codeName}
          </h1>
          <p data-testid="my-page-stage" className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
            {stage}
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{headline}</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {coreTraceCaption}{" "}
            <span className="font-medium text-slate-400">{coreTraceLabel}</span>
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-6 lg:col-span-4 lg:items-end">
          <div className="flex w-full justify-end">
            <MiniCrest codeName={codeName} />
          </div>
          <div className="w-full rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{systemNoteTitle}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{systemNote}</p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function StateCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="p-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-3 text-base font-semibold leading-7 text-white sm:text-lg">{value}</div>
    </GlassPanel>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function PatternField({
  title,
  relationalLabel,
  operationalLabel,
  emotionalLabel,
  labelRelational,
  labelOperational,
  labelEmotional,
}: {
  title: string;
  relationalLabel: string;
  operationalLabel: string;
  emotionalLabel: string;
  labelRelational: string;
  labelOperational: string;
  labelEmotional: string;
}) {
  return (
    <GlassPanel className="p-5 sm:p-6" data-testid="pattern-field">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-4 space-y-3">
        <FieldRow label={labelRelational} value={relationalLabel} />
        <FieldRow label={labelOperational} value={operationalLabel} />
        <FieldRow label={labelEmotional} value={emotionalLabel} />
      </div>
    </GlassPanel>
  );
}

function ReflectionDepthPanel({
  title,
  reflectionDepth,
  recentFocus,
  integrationSignal,
  labelDepth,
  labelRecent,
  labelIntegration,
}: {
  title: string;
  reflectionDepth: string;
  recentFocus: string;
  integrationSignal: string;
  labelDepth: string;
  labelRecent: string;
  labelIntegration: string;
}) {
  return (
    <GlassPanel className="p-5 sm:p-6" data-testid="reflection-depth-panel">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-4 space-y-3">
        <FieldRow label={labelDepth} value={reflectionDepth} />
        <FieldRow label={labelRecent} value={recentFocus} />
        <FieldRow label={labelIntegration} value={integrationSignal} />
      </div>
    </GlassPanel>
  );
}

function InfluenceField({
  title,
  teamSignal,
  influencePattern,
  alignmentTrend,
  labelTeam,
  labelInfluence,
  labelAlignment,
}: {
  title: string;
  teamSignal: string;
  influencePattern: string;
  alignmentTrend: string;
  labelTeam: string;
  labelInfluence: string;
  labelAlignment: string;
}) {
  return (
    <GlassPanel className="p-5 sm:p-6" data-testid="my-page-influence-field">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-4 space-y-3">
        <FieldRow label={labelTeam} value={teamSignal} />
        <FieldRow label={labelInfluence} value={influencePattern} />
        <FieldRow label={labelAlignment} value={alignmentTrend} />
      </div>
    </GlassPanel>
  );
}

function RecoveryAwarenessPanel({
  title,
  recoveryAwareness,
  recoveryNote,
  supportLabel,
  awarenessRowLabel,
}: {
  title: string;
  recoveryAwareness: string;
  recoveryNote: string;
  supportLabel: string;
  awarenessRowLabel: string;
}) {
  return (
    <GlassPanel className="p-5 sm:p-6" data-testid="recovery-awareness-panel">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-4 space-y-4">
        <FieldRow label={awarenessRowLabel} value={recoveryAwareness} />
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{supportLabel}</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{recoveryNote}</p>
        </div>
      </div>
    </GlassPanel>
  );
}

function NextFocusCommand({
  nextFocus,
  nextCue,
  suggestedRoute,
  labelNext,
  labelCue,
  labelRoute,
}: {
  nextFocus: string;
  nextCue: string;
  suggestedRoute: string;
  labelNext: string;
  labelCue: string;
  labelRoute: string;
}) {
  return (
    <GlassPanel className="p-6 sm:p-7" data-testid="next-focus-command">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <SectionLabel>{labelNext}</SectionLabel>
          <h2 className="mt-3 text-xl font-semibold leading-tight text-white sm:text-2xl">{nextFocus}</h2>
          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{labelCue}</div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{nextCue}</p>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{labelRoute}</div>
            <div className="mt-2 text-sm font-medium leading-7 text-white">{suggestedRoute}</div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

/**
 * Premium identity console — single-file layout, consumes interpreted `LeadershipState` + reflections.
 * Not a KPI dashboard; no raw AIR/TII dumps.
 */
export function PremiumMyPageIdentityScreen({
  locale,
  metrics,
  state,
  mounted,
  reflections,
}: PremiumMyPageIdentityScreenProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).myPageStub;

  const systemNote = useMemo(() => {
    const hasSignals = metrics.signalCount > 0;
    return hasSignals ? t.leadershipSystemNoteBodyActive : t.leadershipSystemNoteBodyDormant;
  }, [metrics.signalCount, t]);

  const coreTrace = leadershipCoreTraceLabel(metrics.signalCount, loc);

  const recoveryDetected =
    state.recoveryAwarenessLabel === t.leadershipRecoveryAwarenessDetected;

  const suggestedRoute = recoveryDetected
    ? t.leadershipSuggestedRouteRecovery
    : t.leadershipSuggestedRouteDefault;

  const recoveryNote = recoveryDetected
    ? t.leadershipRecoverySupportNote
    : t.leadershipRecoveryStableNote;

  const recoveryDisplay = state.recoveryAwarenessLabel ?? t.leadershipRecoveryAwarenessStable;

  const depthDisplay = state.reflectionDepthLabel ?? "—";
  const recentDisplay = state.recentFocusLabel ?? "—";
  const integrationDisplay = state.reflectionIntegrationLabel ?? "—";

  if (!mounted) {
    return (
      <div
        data-testid="my-page-leadership-loading"
        className="overflow-hidden rounded-[28px] border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-16 text-center text-sm text-slate-500 sm:px-6"
      >
        …
      </div>
    );
  }

  return (
    <div
      data-testid="my-page-leadership-console"
      role="region"
      aria-label={t.leadershipRegionAria}
      className="overflow-hidden rounded-[28px] border border-slate-800/80 bg-gradient-to-br from-slate-950 via-[#0c1220] to-slate-950 px-4 py-6 text-white shadow-2xl ring-1 ring-cyan-950/25 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <IdentityHero
          codeName={state.codeName}
          stage={state.stage}
          headline={state.headline}
          systemNote={systemNote}
          systemNoteTitle={t.leadershipSystemNoteTitle}
          coreTraceCaption={t.leadershipCoreTrace}
          coreTraceLabel={coreTrace}
          identityEyebrow={t.leadershipIdentityEyebrow}
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="leadership-state-row">
          <StateCard label={t.leadershipAbbrevAir} value={state.airLabel} />
          <StateCard label={t.leadershipAbbrevTii} value={state.tiiLabel} />
          <StateCard label={t.leadershipAbbrevRhythm} value={state.rhythmLabel} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-6">
            <PatternField
              title={t.leadershipFieldPatternTitle}
              relationalLabel={state.relationalLabel}
              operationalLabel={state.operationalLabel}
              emotionalLabel={state.emotionalLabel}
              labelRelational={t.leadershipLabelRelationalBias}
              labelOperational={t.leadershipLabelOperationalBias}
              labelEmotional={t.leadershipLabelEmotionalRegulation}
            />
            <ReflectionDepthPanel
              title={t.leadershipReflectionPanelTitle}
              reflectionDepth={depthDisplay}
              recentFocus={recentDisplay}
              integrationSignal={integrationDisplay}
              labelDepth={t.leadershipReflectionDepthColumn}
              labelRecent={t.leadershipRowRecentFocus}
              labelIntegration={t.leadershipRowIntegration}
            />
          </div>
          <div className="flex flex-col gap-6 xl:col-span-6">
            <InfluenceField
              title={t.leadershipFieldInfluenceTitle}
              teamSignal={state.teamSignal}
              influencePattern={state.influencePattern}
              alignmentTrend={state.alignmentTrend}
              labelTeam={t.leadershipLabelTeamSignal}
              labelInfluence={t.leadershipLabelInfluencePattern}
              labelAlignment={t.leadershipLabelAlignmentTrend}
            />
            <RecoveryAwarenessPanel
              title={t.leadershipRecoveryAwarenessColumn}
              recoveryAwareness={recoveryDisplay}
              recoveryNote={recoveryNote}
              supportLabel={t.leadershipSupportNoteLabel}
              awarenessRowLabel={t.leadershipRecoveryStatusLabel}
            />
          </div>
        </section>

        <NextFocusCommand
          nextFocus={state.nextFocus}
          nextCue={state.nextCue}
          suggestedRoute={suggestedRoute}
          labelNext={t.leadershipNextFocusHeading}
          labelCue={t.leadershipDevelopmentCueHeading}
          labelRoute={t.leadershipSuggestedRouteHeading}
        />

        <p className="text-center text-[11px] text-slate-500">{t.leadershipSuggestedModuleLine}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
          <Link
            href={`/${locale}/bty-arena`}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-cyan-100/90 transition-colors hover:border-cyan-400/20"
          >
            {t.leadershipLinkArena}
          </Link>
          <Link
            href={`/${locale}/growth`}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-cyan-100/90 transition-colors hover:border-cyan-400/20"
          >
            {t.leadershipLinkGrowth}
          </Link>
        </div>
      </div>
    </div>
  );
}
