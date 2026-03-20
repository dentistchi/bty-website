export type ArenaMissionPhase = "lobby" | "play" | "result";

/** Persisted mission flow (sessionStorage) — replace with API later. */
export type ArenaMissionSession = {
  scenarioId: string;
  selectedPrimary: string | null;
  selectedReinforcement: string | null;
  phase: ArenaMissionPhase;
  updatedAt: number;
};
