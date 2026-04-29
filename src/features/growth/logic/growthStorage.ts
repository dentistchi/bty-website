import type { ReflectionSeed } from "./buildReflectionSeed";

export const GROWTH_REFLECTION_SEEDS_KEY = "bty-growth-seeds";

const DEDUPE_SESSION_KEY = "bty-growth-seed-dedupe-keys-v1";

function readDedupeKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(DEDUPE_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeDedupeKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DEDUPE_SESSION_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function isReflectionSeedLike(v: unknown): v is ReflectionSeed {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.source === "arena" &&
    typeof o.scenarioId === "string" &&
    typeof o.primary === "string" &&
    typeof o.reinforcement === "string" &&
    typeof o.focus === "string" &&
    typeof o.promptTitle === "string" &&
    typeof o.promptBody === "string" &&
    typeof o.cue === "string" &&
    typeof o.createdAt === "number"
  );
}

export function loadReflectionSeeds(): ReflectionSeed[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GROWTH_REFLECTION_SEEDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReflectionSeedLike);
  } catch {
    return [];
  }
}

export function pushReflectionSeed(seed: ReflectionSeed) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadReflectionSeeds();
    window.localStorage.setItem(GROWTH_REFLECTION_SEEDS_KEY, JSON.stringify([...prev, seed]));
  } catch {
    // ignore
  }
}

/** Same playthrough as Arena signal — skip duplicate seeds (e.g. Strict Mode). */
export function pushReflectionSeedIfNew(seed: ReflectionSeed, dedupeKey: string): boolean {
  if (typeof window === "undefined") return false;
  const keys = readDedupeKeys();
  if (keys.includes(dedupeKey)) return false;
  pushReflectionSeed(seed);
  writeDedupeKeys([...keys, dedupeKey]);
  return true;
}

export function getLatestReflectionSeed(): ReflectionSeed | null {
  const seeds = loadReflectionSeeds();
  if (!seeds.length) return null;
  return seeds.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
}

/** @alias {@link getLatestReflectionSeed} */
export const loadLatestReflectionSeed = getLatestReflectionSeed;

export function clearReflectionSeeds() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GROWTH_REFLECTION_SEEDS_KEY);
  } catch {
    // ignore
  }
}
