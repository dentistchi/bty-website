import {
  arenaEntryHrefForDestination,
  arenaRuntimeDestinationFromSnapshot,
  type ArenaRuntimeDestination,
} from "@/lib/bty/arena/arenaRuntimeDestination";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

/** Stable ids for Arena entry CTAs — aligned with {@link ArenaRuntimeDestination}. */
export type ArenaEntryDestinationId = ArenaRuntimeDestination;

/**
 * Unified contract for any surface that links into Arena, My Page (action contract), or Center (forced reset only).
 * Input authority: GET session-router snapshot (see {@link fetchArenaEntryResolutionClient}).
 * @see `arenaProductVsInfrastructure.ts` — product entry vs infrastructure routing.
 */
export type ArenaEntryContract = {
  destinationId: ArenaEntryDestinationId;
  href: string;
  /** Stable machine label for intent / analytics (not localized copy). */
  uiIntentLabel: ArenaEntryDestinationId;
};

/** Conservative first paint; must stay aligned with {@link useArenaEntryResolution}. @see `productArenaEntryGuard.ts` */
export function defaultArenaEntryContract(locale: string): ArenaEntryContract {
  const l = locale === "ko" || locale === "en" ? locale : "en";
  return {
    destinationId: "arena_play",
    href: `/${l}/bty-arena`,
    uiIntentLabel: "arena_play",
  };
}

export function arenaEntryContractFromResolutionPayload(payload: {
  destination: ArenaRuntimeDestination;
  href: string;
  snapshot: ArenaSessionRouterSnapshot | null;
}): ArenaEntryContract {
  return {
    destinationId: payload.destination,
    href: payload.href,
    uiIntentLabel: payload.destination,
  };
}

/** Pure helper when only snapshot is available (e.g. tests). */
export function arenaEntryContractFromSnapshot(
  locale: string,
  snapshot: ArenaSessionRouterSnapshot | null | undefined,
): ArenaEntryContract {
  const l = locale === "ko" || locale === "en" ? locale : "en";
  const dest = arenaRuntimeDestinationFromSnapshot(snapshot);
  return {
    destinationId: dest,
    href: arenaEntryHrefForDestination(l, dest),
    uiIntentLabel: dest,
  };
}
