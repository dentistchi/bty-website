import type { ReflectionEntry } from "./types";

export function computeGrowthHistory(reflections: ReflectionEntry[]) {
  const total = reflections.length;
  const sorted = [...reflections].sort((a, b) => a.createdAt - b.createdAt);
  const recent = sorted.slice(-5);

  const clarityCount = recent.filter((r) => r.focus === "clarity").length;
  const trustCount = recent.filter((r) => r.focus === "trust").length;
  const regulationCount = recent.filter((r) => r.focus === "regulation").length;
  const alignmentCount = recent.filter((r) => r.focus === "alignment").length;

  return {
    total,
    recent,
    focusCounts: {
      clarity: clarityCount,
      trust: trustCount,
      regulation: regulationCount,
      alignment: alignmentCount,
    },
  };
}
