import type { ArenaSignal } from "@/features/my-page/logic/types";

export const ARENA_SIGNALS_STORAGE_KEY = "bty-signals";

/** sessionStorage: one push per committed decision (deduped by playthrough). */
export const ARENA_SIGNAL_DEDUPE_SESSION_KEY = "bty-arena-signal-dedupe-keys-v1";

function readDedupeKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(ARENA_SIGNAL_DEDUPE_SESSION_KEY);
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
    window.sessionStorage.setItem(ARENA_SIGNAL_DEDUPE_SESSION_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function isArenaSignalLike(v: unknown): v is ArenaSignal {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.scenarioId === "string" &&
    typeof o.primary === "string" &&
    typeof o.reinforcement === "string" &&
    typeof o.meta === "object" &&
    o.meta !== null &&
    typeof o.timestamp === "number"
  );
}

/** Load persisted Arena signals (client-only). */
export function loadSignals(): ArenaSignal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ARENA_SIGNALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isArenaSignalLike);
  } catch {
    return [];
  }
}

/** @deprecated Use {@link loadSignals} — alias for searchability. */
export function readSignals(): ArenaSignal[] {
  return loadSignals();
}

export function pushSignal(signal: ArenaSignal) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadSignals();
    const next = [...prev, signal];
    window.localStorage.setItem(ARENA_SIGNALS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / privacy mode
  }
}

export function clearSignals() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ARENA_SIGNALS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Append to localStorage once per `dedupeKey` (e.g. scenario + choices + session updatedAt).
 * Survives React Strict Mode double-mount: second call skips.
 */
export function pushSignalIfNew(signal: ArenaSignal, dedupeKey: string): boolean {
  if (typeof window === "undefined") return false;
  const keys = readDedupeKeys();
  if (keys.includes(dedupeKey)) return false;
  pushSignal(signal);
  writeDedupeKeys([...keys, dedupeKey]);
  return true;
}
