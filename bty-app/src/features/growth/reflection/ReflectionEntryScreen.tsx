"use client";

import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { DevelopmentCueCard } from "./DevelopmentCueCard";
import { OptionalRecoveryPromptCard } from "./OptionalRecoveryPromptCard";
import { PromptSeedCard } from "./PromptSeedCard";
import { ReflectionActions } from "./ReflectionActions";
import { ReflectionHeader } from "./ReflectionHeader";

export type ReflectionEntryScreenProps = {
  locale: string;
  seed: ReflectionSeed | null;
  recoveryTriggered: boolean;
  onOpenReflection: () => void;
  onOpenRecovery: () => void;
  onReturnToArena: () => void;
};

/**
 * Arena → Growth airlock: interpreted question entry (not the journaling surface).
 */
export default function ReflectionEntryScreen({
  locale,
  seed,
  recoveryTriggered,
  onOpenReflection,
  onOpenRecovery,
  onReturnToArena,
}: ReflectionEntryScreenProps) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <main
      data-testid="growth-reflection-page"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8"
      aria-label={t.growthReflectionRegionAria}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <ReflectionHeader locale={locale} focus={seed?.focus ?? null} />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <PromptSeedCard locale={locale} seed={seed} />
          </div>

          <div className="flex flex-col gap-6 lg:col-span-5">
            <DevelopmentCueCard locale={locale} cue={seed?.cue} />
            <OptionalRecoveryPromptCard
              locale={locale}
              visible={recoveryTriggered}
              onOpenRecovery={onOpenRecovery}
            />
          </div>
        </section>

        <ReflectionActions
          locale={locale}
          hasSeed={!!seed}
          onOpenReflection={onOpenReflection}
          onReturnToArena={onReturnToArena}
        />
      </div>
    </main>
  );
}
