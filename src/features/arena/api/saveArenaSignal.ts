export type SaveArenaSignalInput = {
  scenarioId: string;
  primaryChoice: string;
  reinforcementChoice: string;
  traits: Record<string, number>;
  meta: {
    relationalBias: number;
    operationalBias: number;
    emotionalRegulation: number;
  };
};

export type SaveArenaSignalResult = {
  ok: true;
  signalId: string;
  seedId: string;
};

export async function saveArenaSignal(input: SaveArenaSignalInput): Promise<SaveArenaSignalResult> {
  const res = await fetch("/api/bty/arena/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    const e = new Error(error?.error ?? "Failed to save arena signal") as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  return res.json() as Promise<SaveArenaSignalResult>;
}
