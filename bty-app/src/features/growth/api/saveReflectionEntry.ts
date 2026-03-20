export type SaveReflectionEntryInput = {
  seedId?: string | null;
  scenarioId: string;
  focus: "clarity" | "trust" | "regulation" | "alignment";
  promptTitle: string;
  promptBody: string;
  cue: string;
  answer1: string;
  answer2: string;
  answer3: string;
  commitment: string;
};

export type SaveReflectionEntryResult = {
  ok: true;
  reflectionId: string;
  id: string;
};

export async function saveReflectionEntry(input: SaveReflectionEntryInput): Promise<SaveReflectionEntryResult> {
  const res = await fetch("/api/bty/growth/reflections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? "Failed to save reflection entry");
  }

  return res.json() as Promise<SaveReflectionEntryResult>;
}
