"use client";

import { getArenaPipelineDefaultForClient, getArenaSessionRouterPath } from "@/lib/bty/arena/arenaPipelineConfig";
import {
  arenaEntryHrefForDestination,
  arenaRuntimeDestinationFromSnapshot,
  type ArenaRuntimeDestination,
} from "@/lib/bty/arena/arenaRuntimeDestination";
import { parseArenaSessionRouterSnapshotFromJson } from "@/lib/bty/arena/arenaSessionRouterClient";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

export type ArenaEntryResolution = {
  destination: ArenaRuntimeDestination;
  href: string;
  snapshot: ArenaSessionRouterSnapshot | null;
};

/**
 * Single client entry: GET session router (`/api/arena/n/session` or legacy `session/next`) → snapshot → destination.
 * @see `productArenaEntryGuard.ts` — product CTAs must use this (or the hook), not ad-hoc `/${locale}/bty-arena`.
 */
export async function fetchArenaEntryResolutionClient(locale: "ko" | "en"): Promise<ArenaEntryResolution> {
  const path = `${getArenaSessionRouterPath(getArenaPipelineDefaultForClient())}?locale=${locale}`;
  const res = await fetch(path, { credentials: "include", cache: "no-store" });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const body = data !== null && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const snapshot = body ? parseArenaSessionRouterSnapshotFromJson(body) : null;
  const destination = arenaRuntimeDestinationFromSnapshot(snapshot);
  return {
    destination,
    href: arenaEntryHrefForDestination(locale, destination),
    snapshot,
  };
}
