"use client";

/**
 * /[locale]/dev/orb — Orb Living Presence · review + comparison surface
 * (dev-only · frontend-only · auth-free).
 *
 * Renders the DEV-ONLY `OrbLiving` (Canvas 2D — Phase A of
 * docs/ORB_LIVING_PRESENCE_SPEC.md, canon a9b51b8). It does NOT render the
 * production `Orb.tsx`, and does NOT touch `/start` (production stays bodyShading OFF).
 *
 * STEP 3A — comparison mode: a lightweight dev-only selector switches ONE OrbLiving
 * instance between Golden Master (`bodyShading` OFF, identical to production) and the
 * Body Shading Candidate (`bodyShading` ON). Exactly one OrbLiving is ever mounted — the
 * shading prop is toggled in place (live, no remount) so there are never two body-mounted
 * field canvases / entry overlays fighting, and the reviewer can tap A/B on the same orb.
 *
 * The mode selector is an intentional dev review affordance; the Orb itself still carries
 * no emotional caption (the selector labels the render VARIANT, not what to feel).
 */

import React from "react";
import OrbLiving from "@/components/orb/OrbLiving";

type OrbDevMode = "gm" | "a3" | "ab1";

const MODES: ReadonlyArray<{ key: OrbDevMode; label: string }> = [
  { key: "gm", label: "Golden Master" },
  { key: "a3", label: "A-3 Edge-Only Body Cue" },
  { key: "ab1", label: "AB-1 Contrast Frame" },
];

const MODE_LABEL: Record<OrbDevMode, string> = {
  gm: "Golden Master",
  a3: "A-3 Edge-Only Body Cue",
  ab1: "AB-1 Contrast Frame",
};

export default function DevOrbSensoryPage(): React.ReactElement {
  const [mode, setMode] = React.useState<OrbDevMode>("gm");
  // Two orthogonal lab flags compose the three modes (both default OFF = Golden Master):
  //   gm  → bodyShading off, contrastFrame off
  //   a3  → bodyShading on,  contrastFrame off
  //   ab1 → bodyShading on,  contrastFrame on  (A-3 edge cue + contrast frame)
  const bodyShading = mode !== "gm";
  const contrastFrame = mode === "ab1";

  return (
    <div
      data-testid="dev-orb-living-a"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0E1116",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overscrollBehavior: "none",
      }}
    >
      {/* Dev-only mode selector — sits above the orb; tapping switches the shading prop live
          (no remount) and never triggers the orb's own touch/hold (separate element). */}
      <div
        data-testid="dev-orb-mode-bar"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top) + 12px)",
          left: 0,
          right: 0,
          zIndex: 10000,
          display: "flex",
          gap: 8,
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              aria-pressed={active}
              style={{
                pointerEvents: "auto",
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.2,
                border: active
                  ? "1px solid rgba(201,166,107,0.7)"
                  : "1px solid rgba(255,255,255,0.18)",
                background: active ? "rgba(201,166,107,0.18)" : "rgba(255,255,255,0.06)",
                color: active ? "#E7CFA1" : "rgba(255,255,255,0.6)",
                WebkitBackdropFilter: "blur(6px)",
                backdropFilter: "blur(6px)",
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Single OrbLiving — GM = both flags OFF (identical to production <OrbLiving/>); A-3 =
          bodyShading ON; AB-1 = bodyShading + contrastFrame ON. Exactly one instance; flags
          toggled by local state (both optional, default OFF). */}
      <OrbLiving bodyShading={bodyShading} contrastFrame={contrastFrame} />

      {/* Unambiguous active-mode caption (dev-only). */}
      <div
        data-testid="dev-orb-mode-label"
        aria-hidden
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 14px)",
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 10000,
          fontSize: 12,
          letterSpacing: 0.4,
          color: "rgba(255,255,255,0.4)",
          pointerEvents: "none",
        }}
      >
        {MODE_LABEL[mode]}
      </div>
    </div>
  );
}
