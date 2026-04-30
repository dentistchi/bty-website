/** Dispatched when session-router authority for Arena entry may have changed (e.g. action contract QR verified). */
export const ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT = "bty:arena-entry-resolution-invalidate" as const;
/** Cross-tab pulse key for QR/action-contract completion sync. */
export const BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY = "bty-action-contract-updated" as const;

export function dispatchArenaEntryResolutionInvalidate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT));
}

/** Broadcasts action-contract completion updates to same-tab + other tabs. */
export function dispatchBtyActionContractUpdated(): void {
  if (typeof window === "undefined") return;
  dispatchArenaEntryResolutionInvalidate();
  try {
    const pulse = String(Date.now());
    window.localStorage.setItem(BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY, pulse);
    window.localStorage.removeItem(BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY);
  } catch {
    // Ignore storage errors (private mode/quota); same-tab custom event already fired.
  }
}
