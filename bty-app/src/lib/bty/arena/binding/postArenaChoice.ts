"use client";

import { parseArenaBindingRuntimeSnapshotFromJson } from "@/lib/bty/arena/binding/parseArenaBindingSnapshot";
import type { ArenaBindingRuntimeSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

export type ArenaChoiceRequest = {
  run_id: string;
  json_scenario_id: string;
  db_scenario_id: string;
  json_choice_id: string;
  db_choice_id: string;
  /**
   * `primary` | `tradeoff` (alias `second`) | `action_decision`.
   * Tradeoff = forced second tier; action_decision = third commitment choice (after tradeoff).
   */
  binding_phase?: "primary" | "second" | "tradeoff" | "action_decision";
};

export async function postArenaChoice(payload: ArenaChoiceRequest): Promise<ArenaBindingRuntimeSnapshot> {
  const res = await fetch("/api/arena/choice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok || !data) {
    const err =
      data && typeof data.error === "string"
        ? data.error
        : typeof data?.message === "string"
          ? data.message
          : "arena_choice_failed";
    throw new Error(err);
  }

  const snap = parseArenaBindingRuntimeSnapshotFromJson(data);
  if (!snap) {
    throw new Error("arena_choice_invalid_snapshot");
  }
  return snap;
}
