"use client";

import { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { saveArenaSignal } from "@/features/arena/api/saveArenaSignal";
import ArenaResolveScreen from "@/features/arena/resolve/ArenaResolveScreen";
import { buildArenaSignal, pushSignalIfNew } from "@/features/arena/logic";
import { buildReflectionSeed, pushReflectionSeedIfNew } from "@/features/growth/logic";
import { useArenaSession } from "@/features/arena/state/useArenaSession";
import { getMessages } from "@/lib/i18n";

/** Mission resolve chamber — persists sealed decision via API (guests fall back to local storage). */
export default function BtyArenaMissionResultPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const prefix = `/${locale}/bty-arena`;
  const m = getMessages(locale);
  const stub = m.uxPhase1Stub;

  const {
    hydrated,
    session,
    scenario,
    outcome,
    continueArena,
    returnToLobby,
    reviewReflection,
  } = useArenaSession();

  const signalSavedRef = useRef(false);

  const signalDedupeKey = useMemo(() => {
    if (!session?.selectedPrimary || !session.selectedReinforcement) return null;
    return `${session.scenarioId}:${session.selectedPrimary}:${session.selectedReinforcement}:${session.updatedAt}`;
  }, [session]);

  useEffect(() => {
    if (!hydrated || !scenario || !outcome || !signalDedupeKey) return;
    if (!session?.selectedPrimary || !session.selectedReinforcement) return;
    if (signalSavedRef.current) return;

    const signal = buildArenaSignal({
      scenario,
      selectedPrimary: session.selectedPrimary,
      selectedReinforcement: session.selectedReinforcement,
    });
    if (!signal) return;

    const traits = Object.fromEntries(
      Object.entries(signal.traits ?? {}).filter(([, v]) => typeof v === "number"),
    ) as Record<string, number>;

    signalSavedRef.current = true;

    void saveArenaSignal({
      scenarioId: signal.scenarioId,
      primaryChoice: signal.primary,
      reinforcementChoice: signal.reinforcement,
      traits,
      meta: signal.meta,
    })
      .then(() => {})
      .catch(() => {
        signalSavedRef.current = false;
        if (pushSignalIfNew(signal, signalDedupeKey)) {
          const seed = buildReflectionSeed(signal);
          pushReflectionSeedIfNew(seed, signalDedupeKey);
          signalSavedRef.current = true;
        }
      });
  }, [hydrated, scenario, outcome, session, signalDedupeKey]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace(prefix);
      return;
    }
    if (!session.selectedPrimary || !session.selectedReinforcement) {
      router.replace(`${prefix}/play`);
      return;
    }
    if (session.phase !== "result") {
      router.replace(`${prefix}/play`);
    }
  }, [hydrated, session, router, prefix]);

  if (!hydrated || !session?.selectedPrimary || !session?.selectedReinforcement || session.phase !== "result") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-400"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={stub.arenaMissionResultLoadingMainRegionAria}
      >
        {m.loading.message}
      </main>
    );
  }

  return (
    <main
      data-testid="arena-mission-flow"
      data-arena-flow-phase="result"
      aria-label={stub.arenaMissionResultMainRegionAria}
    >
      <ArenaResolveScreen
        scenario={scenario}
        selectedPrimary={session.selectedPrimary}
        selectedReinforcement={session.selectedReinforcement}
        outcome={outcome}
        onContinueArena={() => {
          continueArena();
          router.push(`${prefix}/play`);
        }}
        onReviewReflection={reviewReflection}
        onReturnToArena={() => {
          returnToLobby();
          router.push(prefix);
        }}
      />
    </main>
  );
}
