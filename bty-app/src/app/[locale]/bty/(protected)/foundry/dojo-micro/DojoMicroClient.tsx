"use client";

import { useSearchParams } from "next/navigation";
import { DojoAssessmentShell } from "@/components/foundry/DojoAssessmentShell";
import type { DojoSkillArea } from "@/engine/foundry/dojo-assessment.service";

const SKILLS = [
  "communication",
  "decision",
  "resilience",
  "integrity",
  "leadership",
  "empathy",
] as const;

export default function DojoMicroClient({
  locale,
  routeLocale,
}: {
  locale: "ko" | "en";
  routeLocale: string;
}) {
  const sp = useSearchParams();
  const raw = sp.get("skill_area");
  const skillArea =
    raw && (SKILLS as readonly string[]).includes(raw) ? (raw as DojoSkillArea) : undefined;

  return (
    <main className="max-w-xl mx-auto px-4 py-8" aria-label="Foundry Dojo micro">
      <DojoAssessmentShell locale={locale} routeLocale={routeLocale} skillArea={skillArea} />
    </main>
  );
}
