export type SaveRecoveryEntryInput = {
  source: "growth" | "arena";
  reason: "low-regulation" | "repeated-friction" | "pressure-accumulation";
  promptTitle: string;
  promptBody: string;
  cue: string;
  patternNote: string;
  resetAction: string;
  reentryCommitment: string;
};

export type SaveRecoveryEntryResult = {
  ok: true;
  recoveryId: string;
  id: string;
};

export async function saveRecoveryEntry(input: SaveRecoveryEntryInput): Promise<SaveRecoveryEntryResult> {
  const res = await fetch("/api/bty/growth/recovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? "Failed to save recovery entry");
  }

  return res.json() as Promise<SaveRecoveryEntryResult>;
}
