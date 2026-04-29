/**
 * Browser `CustomEvent` names for Arena shell — avoid importing server/engine modules in client components.
 * Server-side emission: {@link ARENA_EJECTED_EVENT} in `arena-center-ejection.ts` (Node listeners).
 */

export const ARENA_EJECTED_WINDOW_EVENT = "arena_ejected" as const;
