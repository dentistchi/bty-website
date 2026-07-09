"use client";

/**
 * /[locale]/dev/orb — Orb Living Presence · Phase A review surface
 * (dev-only · frontend-only · auth-free).
 *
 * Renders the DEV-ONLY `OrbLiving` (idle living presence, Canvas 2D — Phase A of
 * docs/ORB_LIVING_PRESENCE_SPEC.md, canon a9b51b8). It does NOT render the
 * production `Orb.tsx` (shared by /start and /today), which stays untouched.
 *
 * Screen = Orb only. NO captions, labels, hex, or colour names (never explain
 * emotion — the point is to feel it, not to read it). Fixed full-screen overlay
 * so it covers the global locale header without editing that shared component.
 */

import React from "react";
import OrbLiving from "@/components/orb/OrbLiving";

export default function DevOrbSensoryPage(): React.ReactElement {
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
      {/* Lab-only volumetric body-shading candidate ON here (STEP 2). Production /start
          renders <OrbLiving/> without this flag → body shading stays OFF in production. */}
      <OrbLiving bodyShading />
    </div>
  );
}
