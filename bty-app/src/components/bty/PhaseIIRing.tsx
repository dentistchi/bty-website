"use client";

/**
 * Phase II ring — subtle signal only (v3 optional_subtle_signal: phase_ring, no_numbers, no_leaderboard).
 * Shown when user has completed Second Awakening. No stats, no numbers.
 */

const RING_COLOR = "var(--foundry-purple, #5B4B8A)";

export function PhaseIIRing() {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full border-2 bg-transparent text-xs font-semibold uppercase tracking-wider text-[var(--foundry-purple-dark,#4a3d6d)]"
      style={{
        width: 56,
        height: 56,
        borderColor: RING_COLOR,
        opacity: 0.9,
      }}
      title="Phase II"
      aria-label="Phase II"
    >
      Phase II
    </div>
  );
}
