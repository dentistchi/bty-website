"use client";

import React from "react";
import type { ArenaRuntimeStateId } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

export type ArenaRuntimeStateBannerProps = {
  /** When set in development builds, exposes `data-testid="arena-runtime-state"` for E2E / debugging. */
  devTestId?: boolean;
  runtimeState: ArenaRuntimeStateId | string | null | undefined;
  /** Short human reason: contract / re-exposure / reset / next / aligning / play */
  gateLabel: string;
};

/**
 * Subtle top strip so users (and support) can see *why* the Arena is in a non-play state.
 * Render-only — labels come from parent / i18n.
 */
export function ArenaRuntimeStateBanner({ devTestId, runtimeState, gateLabel }: ArenaRuntimeStateBannerProps) {
  if (runtimeState == null || runtimeState === "") return null;
  return (
    <div
      className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] leading-snug text-white/55"
      role="status"
      {...(devTestId ? { "data-testid": "arena-runtime-state" as const } : {})}
    >
      <span className="font-mono text-cyan-200/80">{runtimeState}</span>
      <span className="mx-2 text-white/25">·</span>
      <span className="text-white/60">{gateLabel}</span>
    </div>
  );
}
