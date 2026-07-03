"use client";

import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type BtyMessages = {
  dashboardLabel: string;
  leaderboardLabel: string;
};
type Land = {
  foundryTitle: string;
  foundryDesc: string;
};

/**
 * Foundry v0.1 — the relationship-with-the-world list room (Daily OS).
 *
 * Relationship model: Center = self · Arena = others · Foundry = world / ground / craft /
 * calling. This first landing is DELIBERATELY list-only: no recommended/locked programs, no
 * Dr. Chi mentor card, no Dashboard/Elite/Leaderboard, no feature grid. Those routes still
 * exist and are reachable from their own surfaces — they are simply not the Foundry door.
 *
 * The list presents the six ways a person relates to the world. v0.1 has no per-item
 * destination yet, so the items are calm presence cards (not links, no fake unlock / XP /
 * "coming soon" noise). Built on the Daily OS navy surface (`bg-bty-navy`) for door→room
 * continuity with /today.
 *
 * Note: this route inherits the shared `ArenaLayoutShell` via `[locale]/bty/layout.tsx`.
 * On mobile/native that shell now hides the web top nav and shows the app BottomNav floor;
 * giving Foundry its own full-bleed navy shell (no cream inset) remains a later layout step.
 */

type WorldRelation = { key: string; title: string; ko: string; en: string };

const WORLD_RELATIONS: WorldRelation[] = [
  { key: "work", title: "Work", ko: "맡은 일을 끝내기", en: "Finish the work entrusted to you" },
  { key: "craft", title: "Craft", ko: "기술을 연습하기", en: "Practice your craft" },
  { key: "stewardship", title: "Stewardship", ko: "돈·시간·자원을 돌보기", en: "Steward money, time, and resources" },
  { key: "creation", title: "Creation", ko: "무언가 만들기", en: "Create something real" },
  { key: "service", title: "Service", ko: "누군가에게 유익 남기기", en: "Leave something useful for someone" },
  { key: "ground", title: "Ground", ko: "몸·공간·환경 정돈하기", en: "Tend your body, space, and ground" },
];

export default function FoundryHubClient({
  locale,
  tLand,
}: {
  locale: string;
  t: BtyMessages;
  tLand: Land;
}) {
  const isKo = locale === "ko";
  const tBty = getMessages((isKo ? "ko" : "en") as Locale).bty;

  return (
    <main className="min-h-screen bg-bty-navy text-white" aria-label={tBty.foundryHubMainLandmarkAria}>
      <div className="mx-auto max-w-xl px-5 pt-8 pb-16">
        {/* Room header — title · relationship subtitle · today's prompt. */}
        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-white">{tLand.foundryTitle}</h1>
          <p className="mt-2 text-sm text-white/60">
            {isKo
              ? "세상과의 관계를 연습하는 방."
              : "A room for practicing your relationship with the world."}
          </p>
          <p className="mt-6 text-lg font-medium leading-relaxed text-white">
            {isKo ? "오늘 나는 무엇을 세상에 남길 것인가?" : "What will I leave in the world today?"}
          </p>
        </header>

        {/* The six ways of relating to the world — calm presence cards (v0.1: not yet navigable). */}
        <ul className="grid grid-cols-1 gap-2.5 list-none p-0 m-0" role="list">
          {WORLD_RELATIONS.map((r, i) => (
            <li
              key={r.key}
              className="flex items-baseline gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4"
            >
              <span className="shrink-0 text-xs font-medium tabular-nums text-white/35" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">{r.title}</div>
                <div className="mt-0.5 text-sm text-white/55">{isKo ? r.ko : r.en}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
