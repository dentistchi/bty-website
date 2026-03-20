"use client";

import { useState } from "react";
import type { RecoveryPrompt } from "@/features/growth/logic/recoveryTypes";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type RecoveryEntryScreenProps = {
  locale: string;
  prompt: RecoveryPrompt | null;
  onSave?: (payload: {
    patternNote: string;
    resetAction: string;
    reentryCommitment: string;
  }) => void;
  onReturnToGrowth?: () => void;
  onReturnToArena?: () => void;
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

function RecoveryHeader({
  reason,
  eyebrow,
  headline,
  lead,
  channelLabel,
  channelLowReg,
  channelFriction,
  channelPressure,
  channelReady,
}: {
  reason?: RecoveryPrompt["reason"];
  eyebrow: string;
  headline: string;
  lead: string;
  channelLabel: string;
  channelLowReg: string;
  channelFriction: string;
  channelPressure: string;
  channelReady: string;
}) {
  const reasonLabel =
    reason === "low-regulation"
      ? channelLowReg
      : reason === "repeated-friction"
        ? channelFriction
        : reason === "pressure-accumulation"
          ? channelPressure
          : channelReady;

  return (
    <GlassPanel className="p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">{eyebrow}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{headline}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{lead}</p>
        </div>

        <div className="min-w-[180px] shrink-0 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">{channelLabel}</div>
          <p className="mt-2 text-sm leading-6 text-slate-200">{reasonLabel}</p>
        </div>
      </div>
    </GlassPanel>
  );
}

function RecoverySignalCard({
  prompt,
  signalTitle,
  cueLabel,
  noPrompt,
}: {
  prompt: RecoveryPrompt | null;
  signalTitle: string;
  cueLabel: string;
  noPrompt: string;
}) {
  return (
    <GlassPanel className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{signalTitle}</div>

      {prompt ? (
        <div className="mt-4 space-y-4">
          <div>
            <h2 data-testid="recovery-prompt-title" className="text-2xl font-semibold leading-tight text-white">
              {prompt.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{prompt.body}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{cueLabel}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{prompt.cue}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-slate-400">{noPrompt}</p>
      )}
    </GlassPanel>
  );
}

function QuestionBlock({
  label,
  question,
  value,
  onChange,
  rows = 4,
  placeholder,
  textareaTestId,
}: {
  label: string;
  question: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder: string;
  textareaTestId?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{label}</div>
        <p className="mt-2 text-sm font-medium leading-6 text-white">{question}</p>
      </div>

      <textarea
        data-testid={textareaTestId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
        placeholder={placeholder}
      />
    </div>
  );
}

function RecoverySystemStrip({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl">
      <p className="text-sm tracking-[0.12em] text-cyan-100/85">{message}</p>
    </div>
  );
}

function RecoveryActions({
  canSave,
  onSave,
  saveLabel,
  growthLabel,
  arenaLabel,
  onReturnToGrowth,
  onReturnToArena,
}: {
  canSave: boolean;
  onSave: () => void;
  saveLabel: string;
  growthLabel: string;
  arenaLabel: string;
  onReturnToGrowth?: () => void;
  onReturnToArena?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <button
        type="button"
        data-testid="save-recovery"
        onClick={onSave}
        disabled={!canSave}
        className={[
          "h-12 rounded-2xl px-4 text-sm font-medium transition",
          canSave
            ? "bg-[#1E2A38] text-white hover:bg-[#243446]"
            : "cursor-not-allowed bg-white/[0.05] text-slate-500",
        ].join(" ")}
      >
        {saveLabel}
      </button>

      <button
        type="button"
        onClick={onReturnToGrowth}
        className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
      >
        {growthLabel}
      </button>

      <button
        type="button"
        onClick={onReturnToArena}
        className="h-12 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.08]"
      >
        {arenaLabel}
      </button>
    </div>
  );
}

/**
 * Re-entry gate — protects the next decision cycle. Not failure, not warning.
 */
export default function RecoveryEntryScreen({
  locale,
  prompt,
  onSave,
  onReturnToGrowth,
  onReturnToArena,
}: RecoveryEntryScreenProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  const [patternNote, setPatternNote] = useState("");
  const [resetAction, setResetAction] = useState("");
  const [reentryCommitment, setReentryCommitment] = useState("");

  const canSave =
    !!prompt &&
    patternNote.trim().length > 0 &&
    resetAction.trim().length > 0 &&
    reentryCommitment.trim().length > 0;

  return (
    <main
      data-testid="recovery-entry-screen"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-5 text-white sm:px-6"
      aria-label={t.recoveryEntryRegionAria}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <RecoveryHeader
          reason={prompt?.reason}
          eyebrow={t.recoveryEntryEyebrow}
          headline={t.recoveryEntryHeadline}
          lead={t.recoveryEntryLead}
          channelLabel={t.recoveryEntryChannelLabel}
          channelLowReg={t.recoveryChannelLowRegulation}
          channelFriction={t.recoveryChannelRepeatedFriction}
          channelPressure={t.recoveryChannelPressureAccumulation}
          channelReady={t.recoveryChannelReady}
        />

        <RecoverySignalCard
          prompt={prompt}
          signalTitle={t.recoveryEntrySignalTitle}
          cueLabel={t.recoveryEntryCueLabel}
          noPrompt={t.recoveryEntryNoPrompt}
        />

        <GlassPanel className="p-6">
          <div className="space-y-6">
            <QuestionBlock
              label={t.recoveryEntryQ1Label}
              question={t.recoveryEntryQ1}
              value={patternNote}
              onChange={setPatternNote}
              placeholder={t.recoveryEntryPlaceholder}
              textareaTestId="recovery-pattern-note"
            />

            <QuestionBlock
              label={t.recoveryEntryQ2Label}
              question={t.recoveryEntryQ2}
              value={resetAction}
              onChange={setResetAction}
              placeholder={t.recoveryEntryPlaceholder}
              textareaTestId="recovery-reset-action"
            />

            <QuestionBlock
              label={t.recoveryEntryQ3Label}
              question={t.recoveryEntryQ3}
              value={reentryCommitment}
              onChange={setReentryCommitment}
              rows={3}
              placeholder={t.recoveryEntryPlaceholder}
              textareaTestId="recovery-reentry-commitment"
            />
          </div>
        </GlassPanel>

        <RecoverySystemStrip message={t.recoveryEntrySystemStrip} />

        <RecoveryActions
          canSave={canSave}
          onSave={() =>
            onSave?.({
              patternNote,
              resetAction,
              reentryCommitment,
            })
          }
          saveLabel={t.recoveryEntrySave}
          growthLabel={t.recoveryEntryReturnGrowth}
          arenaLabel={t.recoveryEntryReturnArena}
          onReturnToGrowth={onReturnToGrowth}
          onReturnToArena={onReturnToArena}
        />
      </div>
    </main>
  );
}
