/** Shared Growth layer types (reflections, history). */

export type ReflectionEntry = {
  id: string;
  source: "arena";
  scenarioId: string;
  focus: "clarity" | "trust" | "regulation" | "alignment";
  promptTitle: string;
  promptBody: string;
  cue: string;
  answer1: string;
  answer2: string;
  answer3: string;
  commitment: string;
  createdAt: number;
};
