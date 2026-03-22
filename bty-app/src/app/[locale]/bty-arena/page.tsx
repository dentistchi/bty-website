import BtyArenaMissionLobbyPage from "@/features/arena/lobby/BtyArenaMissionLobbyPage";

/**
 * Arena mission lobby — `/bty-arena/play` · `/bty-arena/result` 와 분리.
 * API 기반 시뮬 본편: `/bty-arena/run`. 허브 카드 UI: `/bty-arena/hub`.
 * `/bty-arena/lobby` 는 동일 UI에 `lobbyLandmarkAria` 랜드마크.
 */
export default function BtyArenaMissionLobbyPageRoute() {
  return <BtyArenaMissionLobbyPage mainLandmark="mission" />;
}
