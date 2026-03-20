"use client";

import { useParams, useRouter } from "next/navigation";
import ArenaLobbyScreen from "@/features/arena/lobby/ArenaLobbyScreen";
import { useArenaSession } from "@/features/arena/state/useArenaSession";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/**
 * Arena mission lobby — `/bty-arena/play` · `/bty-arena/result` 와 분리.
 * API 기반 시뮬 본편: `/bty-arena/run`. 허브 카드 UI: `/bty-arena/hub`.
 */
export default function BtyArenaMissionLobbyPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const loc = locale as Locale;
  const tStub = getMessages(loc).uxPhase1Stub;
  const prefix = `/${locale}/bty-arena`;

  const { hydrated, scenario, enterArena, resumeScenario } = useArenaSession();

  if (!hydrated) {
    return (
      <main
        aria-label={tStub.arenaMissionLobbyLoadingMainRegionAria}
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-400"
      >
        <p role="status">{tStub.arenaHubEntryLoading}</p>
      </main>
    );
  }

  return (
    <main aria-label={tStub.arenaMissionLobbyMainRegionAria} className="min-h-screen">
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
