import { Suspense } from "react";
import { PageLoadingFallback } from "@/components/bty-arena";
import TodayHomeClient from "./page.client";

// D3-1 — BTY Daily OS "Today" home surface.
// Live tiles via /api/arena/* : Core XP (core-xp), today's points (today-xp),
// today's situation (action-contracts/pending), AIR band (leadership-engine/air).
// Labeled stubs (no engine wiring): Companion voice, level/archetype, streak.
// Replaces the D3-0 Slice 1 static stub. showBottomNav defaults true (5-tab nav).
export const dynamic = "force-dynamic";

export default function TodayPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <PageLoadingFallback />
        </div>
      }
    >
      <TodayHomeClient />
    </Suspense>
  );
}
