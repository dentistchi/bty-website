import BtyArenaMissionLobbyPage from "@/features/arena/lobby/BtyArenaMissionLobbyPage";

/** Prototype lobby path — same mission lobby as `/bty-arena` with `lobbyLandmarkAria` on `<main>`. */
export default function ArenaLobbyAliasPage() {
  return <BtyArenaMissionLobbyPage mainLandmark="lobbyRoute" />;
}
