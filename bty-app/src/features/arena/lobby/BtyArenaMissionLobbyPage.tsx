"use client";

import { useParams, useRouter } from "next/navigation";
import ArenaLobbyScreen from "./ArenaLobbyScreen";
import { getScenarioById, patientComplaintScenario } from "@/domain/arena/scenarios";
import type { ArenaScenario } from "@/domain/arena/scenarios";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type BtyArenaMissionLobbyPageProps = {
  /** `/bty-arena` vs `/bty-arena/lobby` — distinct `<main aria-label>` */
  mainLandmark: "mission" | "lobbyRoute";
};

/**
 * Arena entry shell — `/bty-arena` and `/bty-arena/lobby` share UI; aria labels differ per route.
 * Primary actions route to `/bty-arena` (API session + run flow), not the legacy mission/play routes.
 */
export default function BtyArenaMissionLobbyPage({ mainLandmark }: BtyArenaMissionLobbyPageProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const loc = locale as Locale;
  const tStub = getMessages(loc).uxPhase1Stub;
  const prefix = `/${locale}/bty-arena`;
  const contentLocale = locale === "ko" ? "ko" : "en";
  const scenario: ArenaScenario =
    getScenarioById(patientComplaintScenario.id, contentLocale) ??
    getScenarioById(patientComplaintScenario.id, "en")!;

  const mainAria =
    mainLandmark === "lobbyRoute" ? tStub.lobbyLandmarkAria : tStub.arenaMissionLobbyMainRegionAria;

  const goRun = () => {
    router.push(prefix);
  };

  return (
    <main aria-label={mainAria} className="min-h-screen">
      <div data-testid="arena-mission-flow" data-arena-flow-phase="lobby">
        <ArenaLobbyScreen scenario={scenario} onEnterArena={goRun} onResumeScenario={goRun} />
      </div>
    </main>
  );
}
