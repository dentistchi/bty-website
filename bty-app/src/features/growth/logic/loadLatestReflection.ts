import type { ReflectionEntry } from "./types";
import { loadReflections } from "./reflectionStorage";

export function getLatestReflectionEntry(): ReflectionEntry | null {
  const reflections = loadReflections();
  if (!reflections.length) return null;
  return reflections.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
}

/** @alias {@link getLatestReflectionEntry} */
export const loadLatestReflection = getLatestReflectionEntry;
