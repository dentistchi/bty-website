import type { RecoveryEntry } from "./recoveryTypes";

export const RECOVERY_STORAGE_KEY = "bty-recovery-entries";

function isRecoveryEntryLike(v: unknown): v is RecoveryEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.promptReason === "string" &&
    (o.promptSource === "growth" || o.promptSource === "arena") &&
    typeof o.patternNote === "string" &&
    typeof o.resetAction === "string" &&
    typeof o.reentryCommitment === "string" &&
    typeof o.createdAt === "number"
  );
}

export function loadRecoveryEntries(): RecoveryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecoveryEntryLike);
  } catch {
    return [];
  }
}

export function pushRecoveryEntry(entry: RecoveryEntry) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadRecoveryEntries();
    window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify([...prev, entry]));
  } catch {
    // ignore
  }
}

export function clearRecoveryEntries() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
