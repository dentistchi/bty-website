"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";
import { buildReflectionEntry } from "@/features/growth/logic/buildReflectionEntry";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";

export type ReflectionWritingScreenProps = {
  locale: string;
  seed: ReflectionSeed | null;
  onSave?: (entry: ReflectionEntry) => void;
  onReturnToArena?: () => void;
  onViewLeadershipState?: () => void;
};

function focusLabel(focus: ReflectionSeed["focus"] | undefined, locale: Locale): string {
  const t = getMessages(locale).uxPhase1Stub;
  if (!focus) return t.growthReflectionFocusReady;
  switch (focus) {
    case "clarity":
      return t.growthReflectionFocusClarity;
    case "trust":
      return t.growthReflectionFocusTrust;
    case "regulation":
      return t.growthReflectionFocusRegulation;
    case "alignment":
    default:
      return t.growthReflectionFocusAlignment;
  }
}

function ReflectionPromptHeader({ locale, focus }: { locale: string; focus?: ReflectionSeed["focus"] }) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <GlassPanel className="p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">
            {t.growthWritingGuidedLabel}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.growthWritingHeadline}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{t.growthWritingSubhead}</p>
        </div>

        <div className="w-full shrink-0 lg:min-w-[180px] lg:max-w-[220px]">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">
              {t.growthReflectionFocusChannel}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{focusLabel(focus, loc)}</p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function PromptContextCard({ locale, seed }: { locale: string; seed: ReflectionSeed | null }) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <GlassPanel data-testid="growth-writing-prompt-card" className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">{t.growthWritingPromptSection}</div>

      {seed ? (
        <div className="mt-4 space-y-4">
          <div>
            <h2
              data-testid="reflection-prompt-title"
              className="text-xl font-semibold leading-tight text-white sm:text-2xl"
            >
              {seed.promptTitle}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{seed.promptBody}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{t.growthWritingCueInline}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{seed.cue}</p>
          </div>
        </div>
      ) : (
        <p data-testid="reflection-no-seed" className="mt-4 text-sm leading-7 text-slate-400">
          {t.growthWritingNoSeed}
        </p>
      )}
    </GlassPanel>
  );
}

function QuestionBlock({
  label,
  question,
  value,
  onChange,
  placeholder,
  textareaTestId,
}: {
  label: string;
  question: string;
  value: string;
  onChange: (v: string) => void;
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
        rows={4}
        className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
        placeholder={placeholder}
      />
    </div>
  );
}

function SystemNoteStrip({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl">
      <p className="text-sm tracking-[0.12em] text-cyan-100/85">{message}</p>
    </div>
  );
}

function WritingActions({
  locale,
  canSave,
  saved,
  onSave,
  onReturnToArena,
  onViewLeadershipState,
}: {
  locale: string;
  canSave: boolean;
  saved: boolean;
  onSave: () => void;
  onReturnToArena?: () => void;
  onViewLeadershipState?: () => void;
}) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="growth-writing-actions">
      <button
        type="button"
        data-testid="save-reflection"
        onClick={onSave}
        disabled={!canSave}
        className={cn(
          "h-12 rounded-2xl px-4 text-sm font-medium transition",
          canSave
            ? "bg-[#1E2A38] text-white hover:bg-[#243446]"
            : "cursor-not-allowed bg-white/[0.05] text-slate-500",
        )}
      >
        {saved ? t.growthWritingSaved : t.growthWritingSave}
      </button>

      <button
        type="button"
        onClick={onReturnToArena}
        className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
      >
        {t.growthWritingReturnArena}
      </button>

      <button
        type="button"
        onClick={onViewLeadershipState}
        className="h-12 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.08]"
      >
        {t.growthWritingViewMyPage}
      </button>
    </div>
  );
}

/** Structured leadership reflection chamber — not a free-form journal. */
export default function ReflectionWritingScreen({
  locale,
  seed,
  onSave,
  onReturnToArena,
  onViewLeadershipState,
}: ReflectionWritingScreenProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");
  const [commitment, setCommitment] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [answer1, answer2, answer3, commitment]);

  const canSave = useMemo(() => {
    if (!seed) return false;
    return (
      answer1.trim().length > 0 &&
      answer2.trim().length > 0 &&
      answer3.trim().length > 0 &&
      commitment.trim().length > 0
    );
  }, [seed, answer1, answer2, answer3, commitment]);

  const handleSave = () => {
    if (!seed || !canSave) return;
    const entry = buildReflectionEntry({
      seed,
      answer1,
      answer2,
      answer3,
      commitment,
    });
    onSave?.(entry);
    setSaved(true);
  };

  return (
    <main
      data-testid="growth-reflection-write-page"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8"
      aria-label={t.growthWritingGuidedLabel}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <ReflectionPromptHeader locale={locale} focus={seed?.focus} />
        <PromptContextCard locale={locale} seed={seed} />

        <GlassPanel className="p-6">
          <div className="space-y-6">
            <QuestionBlock
              label={t.growthWritingQ1Label}
              question={t.growthWritingQ1}
              value={answer1}
              onChange={setAnswer1}
              placeholder={t.growthWritingPlaceholder}
              textareaTestId="reflection-answer-1"
            />

            <QuestionBlock
              label={t.growthWritingQ2Label}
              question={t.growthWritingQ2}
              value={answer2}
              onChange={setAnswer2}
              placeholder={t.growthWritingPlaceholder}
              textareaTestId="reflection-answer-2"
            />

            <QuestionBlock
              label={t.growthWritingQ3Label}
              question={t.growthWritingQ3}
              value={answer3}
              onChange={setAnswer3}
              placeholder={t.growthWritingPlaceholder}
              textareaTestId="reflection-answer-3"
            />

            <div className="space-y-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] px-4 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
                  {t.growthWritingCommitmentLabel}
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-100">{t.growthWritingCommitmentHelper}</p>
              </div>
              <textarea
                data-testid="reflection-commitment"
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
                placeholder={t.growthWritingCommitmentPlaceholder}
              />
            </div>
          </div>
        </GlassPanel>

        <SystemNoteStrip message={t.growthWritingSystemNote} />

        <WritingActions
          locale={locale}
          canSave={canSave}
          saved={saved}
          onSave={handleSave}
          onReturnToArena={onReturnToArena}
          onViewLeadershipState={onViewLeadershipState}
        />
      </div>
    </main>
  );
}
