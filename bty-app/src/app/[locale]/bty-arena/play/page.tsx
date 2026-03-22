"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ArenaPlayScreen from "@/features/arena/play/ArenaPlayScreen";
import { useArenaSession } from "@/features/arena/state/useArenaSession";
import { getMessages } from "@/lib/i18n";

/** Mission scenario play (1+1) — sessionStorage + guards. */
export default function BtyArenaMissionPlayPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const prefix = `/${locale}/bty-arena`;
  const m = getMessages(locale === "ko" ? "ko" : "en");
  const stub = m.uxPhase1Stub;
  const loadingCopy = m.loading;

  const {
    hydrated,
    session,
    scenario,
    canRevealReinforcement,
    canResolve,
    selectPrimary,
    selectReinforcement,
    commitDecision,
  } = useArenaSession();

  useEffect(() => {
    if (!hydrated) return;
    if (!session || !session.scenarioId) {
      router.replace(prefix);
      return;
    }
    if (session.phase === "lobby") {
      router.replace(prefix);
      return;
    }
    if (session.phase === "result") {
      router.replace(`${prefix}/result`);
    }
  }, [hydrated, session, router, prefix]);

  if (!hydrated || !session || !session.scenarioId || session.phase !== "play") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-400"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={stub.arenaMissionPlayLoadingMainRegionAria}
      >
        {loadingCopy.message}
      </main>
    );
  }

  return (
    <main
      data-testid="arena-mission-flow"
      data-arena-flow-phase="play"
      aria-label={stub.arenaMissionPlayMainRegionAria}
    >
      <ArenaPlayScreen
        scenario={scenario}
        topBarAriaLabel={stub.arenaMissionPlayTopBarAria}
        sceneRegionAriaLabel={stub.arenaMissionPlaySceneRegionAria}
        decisionsRegionAriaLabel={stub.arenaMissionPlayDecisionsRegionAria}
        selectedPrimary={session.selectedPrimary}
        selectedReinforcement={session.selectedReinforcement}
        canRevealReinforcement={Boolean(canRevealReinforcement)}
        canResolve={Boolean(canResolve)}
        onSelectPrimary={selectPrimary}
        onSelectReinforcement={selectReinforcement}
        onCommitDecision={() => {
          commitDecision();
          router.push(`${prefix}/result`);
        }}
      />
    </main>
  );
}
