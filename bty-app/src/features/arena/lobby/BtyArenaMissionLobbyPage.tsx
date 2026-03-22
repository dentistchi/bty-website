"use client";

import { useParams, useRouter } from "next/navigation";
import ArenaLobbyScreen from "./ArenaLobbyScreen";
import { useArenaSession } from "@/features/arena/state/useArenaSession";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type BtyArenaMissionLobbyPageProps = {
  /** `/bty-arena` vs `/bty-arena/lobby` — distinct `<main aria-label>` */
  mainLandmark: "mission" | "lobbyRoute";
};

/**
 * Mission lobby — `/bty-arena` and `/bty-arena/lobby` share UI; aria labels differ per route.
 */
export default function BtyArenaMissionLobbyPage({ mainLandmark }: BtyArenaMissionLobbyPageProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const loc = locale as Locale;
  const tStub = getMessages(loc).uxPhase1Stub;
  const prefix = `/${locale}/bty-arena`;

  const mainAria =
    mainLandmark === "lobbyRoute" ? tStub.lobbyLandmarkAria : tStub.arenaMissionLobbyMainRegionAria;
  const loadingAria =
    mainLandmark === "lobbyRoute"
      ? tStub.lobbyLoadingMainRegionAria
      : tStub.arenaMissionLobbyLoadingMainRegionAria;

  const { hydrated, scenario, enterArena, resumeScenario } = useArenaSession();

  if (!hydrated) {
    return (
      <main
        aria-label={loadingAria}
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-400"
      >
        <p role="status">{tStub.arenaHubEntryLoading}</p>
      </main>
    );
  }

  return (
    <main aria-label={mainAria} className="min-h-screen">
      <div data-testid="arena-mission-flow" data-arena-flow-phase="lobby">
        <ArenaLobbyScreen
          scenario={scenario}
          onEnterArena={() => {
            enterArena();
            router.push(`${prefix}/play`);
          }}
          onResumeScenario={() => {
            resumeScenario();
            router.push(`${prefix}/play`);
          }}
        />
      </div>
    </main>
  );
}
