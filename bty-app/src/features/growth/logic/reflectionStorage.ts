import type { ReflectionEntry } from "./types";

/** Persisted under `localStorage` — structured Arena-linked reflections. */
export const REFLECTION_STORAGE_KEY = "bty-reflections";
const LEGACY_REFLECTION_ENTRIES_KEY = "bty-reflection-entries";

function isReflectionEntryLike(v: unknown): v is ReflectionEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.source === "arena" &&
    typeof o.scenarioId === "string" &&
    typeof o.focus === "string" &&
    typeof o.promptTitle === "string" &&
    typeof o.promptBody === "string" &&
    typeof o.cue === "string" &&
    typeof o.answer1 === "string" &&
    typeof o.answer2 === "string" &&
    typeof o.answer3 === "string" &&
    typeof o.commitment === "string" &&
    typeof o.createdAt === "number"
  );
}

function migrateLegacyOnce(): void {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(REFLECTION_STORAGE_KEY);
    if (current) {
      try {
        const parsed = JSON.parse(current) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) return;
      } catch {
        // fall through — try legacy
      }
    }
    const raw = window.localStorage.getItem(LEGACY_REFLECTION_ENTRIES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    const valid = parsed.filter(isReflectionEntryLike);
    if (valid.length) {
      window.localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(valid));
    }
  } catch {
    // ignore
  }
}

export function loadReflections(): ReflectionEntry[] {
  if (typeof window === "undefined") return [];
  migrateLegacyOnce();
  try {
    const raw = window.localStorage.getItem(REFLECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReflectionEntryLike);
  } catch {
    return [];
  }
}

/** @deprecated Use {@link loadReflections} */
export function loadReflectionEntries(): ReflectionEntry[] {
  return loadReflections();
}

export function pushReflection(entry: ReflectionEntry) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadReflections();
    window.localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify([...prev, entry]));
  } catch {
    // ignore
  }
}

/** @deprecated Use {@link pushReflection} */
export function pushReflectionEntry(entry: ReflectionEntry) {
  pushReflection(entry);
}

export function clearReflections() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFLECTION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
