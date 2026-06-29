"use client";

/**
 * /[locale]/dev/orb — P0 Orb Sensory Test (dev-only · frontend-only · auth-free).
 *
 * Screen = Orb only. NO captions, labels, hex, or colour names rendered
 * (Never explain emotion — the point is to touch, not to read). Zero features:
 * no scenario, no record, no nav, no DB. Two touchable Orbs, nothing else.
 *
 * Rendered as a fixed full-screen overlay so it covers the global locale header
 * without editing that shared component. Not mounted in the ritual home (G3).
 */

import React from "react";
import { Orb } from "@/components/orb/Orb";

export default function DevOrbSensoryPage(): React.ReactElement {
  return (
    <div
      data-testid="dev-orb-sensory-v1"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0E1116",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14vh",
        overscrollBehavior: "none",
      }}
    >
      <Orb mode="morning" enableHaptic />
      <Orb mode="evening" enableHaptic />
    </div>
  );
}
