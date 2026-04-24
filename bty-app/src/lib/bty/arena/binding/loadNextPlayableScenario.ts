"use client";

import type { ArenaBindingRuntimeSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

/**
 * Next scenario loader branches on binding snapshot (not local step).
 * Re-exposure uses a dedicated path when the server emits `REEXPOSURE_DUE` + `re_exposure.scenario_id`.
 */
export async function loadNextPlayableScenario(
  snapshot: ArenaBindingRuntimeSnapshot,
  locale: "ko" | "en",
): Promise<unknown> {
  if (snapshot.runtime_state === "REEXPOSURE_DUE" && snapshot.re_exposure?.due && snapshot.re_exposure.scenario_id) {
    const id = encodeURIComponent(snapshot.re_exposure.scenario_id);
    const res = await fetch(`/api/arena/re-exposure/${id}`, {
      credentials: "include",
      cache: "no-store",
    });
    return res.json();
  }

  const res = await fetch(`/api/arena/n/session?locale=${locale}`, {
    credentials: "include",
    cache: "no-store",
  });
  return res.json();
}
