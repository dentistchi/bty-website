/** Dispatched when session-router authority for Arena entry may have changed (e.g. action contract QR verified). */
export const ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT = "bty:arena-entry-resolution-invalidate" as const;

export function dispatchArenaEntryResolutionInvalidate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT));
}
