"use client";

import { useState } from "react";
import AppTabBar, { type AppTabKey } from "@/components/app-shell/AppTabBar";
import OrbLiving from "@/components/orb/OrbLiving";

/**
 * New BTY Daily App Shell — v0 skeleton.
 *
 * Mobile-first, full-height, app-native (no desktop top nav, no legacy
 * HubTopNav / ArenaLayoutShell / CenterLayoutShell / ScreenShell). Five tabs
 * switch locally (in-component state) — no navigation to legacy routes, no
 * iframes. Relationship model: Today (the day's door) · Center=Self · Arena=
 * Others · Foundry=World · Me=identity.
 *
 * Layout is a flex column so the tab bar and companion dock are real children,
 * never floating — content can never be occluded. Safe-area insets are handled
 * top (status bar) and bottom (home indicator).
 */

type Locale = "en" | "ko";

type Copy = {
  appAria: string;
  today: { title: string; sub: string; cards: { t: string; d: string; tab: AppTabKey }[] };
  center: { title: string; tag: string; body: string };
  arena: { title: string; tag: string; body: string };
  foundry: { title: string; tag: string; body: string };
  me: { title: string; tag: string; body: string };
  companion: string;
  soonTag: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    appAria: "BTY Daily app",
    today: {
      title: "Good morning.",
      sub: "Choose the relationship you will live today.",
      cards: [
        { t: "Self", d: "Return to yourself.", tab: "center" },
        { t: "Others", d: "Enter the Arena with care.", tab: "arena" },
        { t: "World", d: "Build what you are here to steward.", tab: "foundry" },
      ],
    },
    center: { title: "You have entered Center.", tag: "Relationship with Self", body: "Return to yourself before you move." },
    arena: { title: "You have entered Arena.", tag: "Relationship with Others", body: "Carry this relationship with care." },
    foundry: { title: "You have entered Foundry.", tag: "Relationship with the World", body: "Build what you are here to steward." },
    me: { title: "Your journey.", tag: "Identity", body: "Streak and progress." },
    companion: "Dr. Chi — your companion.",
    soonTag: "Soon",
  },
  ko: {
    appAria: "BTY Daily 앱",
    today: {
      title: "좋은 아침입니다.",
      sub: "오늘 어떤 관계를 살아내시겠습니까?",
      cards: [
        { t: "나와의 관계", d: "나에게 돌아옵니다.", tab: "center" },
        { t: "타인과의 관계", d: "조심스럽게 Arena로 들어갑니다.", tab: "arena" },
        { t: "세상과의 관계", d: "오늘 맡겨진 것을 빚어갑니다.", tab: "foundry" },
      ],
    },
    center: { title: "Center에 들어왔습니다.", tag: "나와의 관계", body: "움직이기 전에 나에게 돌아옵니다." },
    arena: { title: "Arena에 들어왔습니다.", tag: "타인과의 관계", body: "이 관계를 조심스럽게 감당합니다." },
    foundry: { title: "Foundry에 들어왔습니다.", tag: "세계와의 관계", body: "오늘 맡겨진 것을 빚어갑니다." },
    me: { title: "당신의 여정.", tag: "정체성", body: "연속과 성장." },
    companion: "닥터 치 — 당신의 동반자.",
    soonTag: "곧",
  },
};

function SurfaceHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-7 space-y-2">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">{title}</h1>
      {sub ? <p className="text-[0.95rem] leading-6 text-white/60">{sub}</p> : null}
    </header>
  );
}

function PlaceholderCard({ tag, body, soon }: { tag: string; body: string; soon: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{tag}</span>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-white/50">{soon}</span>
      </div>
      <p className="text-[0.95rem] leading-6 text-white/70">{body}</p>
    </div>
  );
}

function TodaySurface({
  copy,
  onChoose,
}: {
  copy: Copy["today"];
  /** Relationship cards are navigation (not commitment): tapping sets the tab. */
  onChoose: (tab: AppTabKey) => void;
}) {
  return (
    <>
      <SurfaceHeader title={copy.title} sub={copy.sub} />
      {/* Canonical BTY Orb — the living daily doorway (OrbLiving, the production /start
          Threshold Door + /dev/orb presence). Restored here to replace the temporary CSS
          Orb Lite. Rendered as pure living presence (no onCommit/holdMs — Today is already
          inside the app, so it is the day's anchor, not a navigation gate). Its sole
          isNative-gated haptic Touch Language is preserved as-is (canonical, not new). */}
      <div className="mb-7 flex justify-center">
        <OrbLiving size={180} />
      </div>
      <div className="space-y-3">
        {copy.cards.map((c) => (
          <button
            key={c.t}
            type="button"
            onClick={() => onChoose(c.tab)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition duration-200 hover:border-[#C9A66B]/25 hover:bg-white/[0.07] active:scale-[0.985] active:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40"
          >
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#C9A66B]/15 text-lg font-semibold text-[#C9A66B] ring-1 ring-[#C9A66B]/20 transition group-hover:bg-[#C9A66B]/25">
              {c.t.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-white">{c.t}</span>
              <span className="block text-sm text-white/55">{c.d}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function BtyDailyAppShell({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<AppTabKey>("today");
  const t = COPY[locale];

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased">
      {/* Companion-dock keyframe — the canonical Orb (OrbLiving) owns its own canvas
          animation, so only the companion "alive" pulse lives here. prefers-reduced-motion
          stills it. (OrbLiving is independently reduced-motion-safe.) */}
      <style>{`
        @keyframes btyPulse{0%,100%{opacity:.35}50%{opacity:.9}}
        @media (prefers-reduced-motion: reduce){.btyOrbAnim{animation:none!important}}
      `}</style>
      {/* iOS status-bar safe area — reserved so app content never underlaps the notch/clock. */}
      <div style={{ height: "env(safe-area-inset-top)" }} aria-hidden />

      <main className="flex-1 overflow-y-auto px-5 pb-4 pt-8" aria-label={t.appAria}>
        {tab === "today" && <TodaySurface copy={t.today} onChoose={setTab} />}
        {tab === "center" && (
          <>
            <SurfaceHeader title={t.center.title} />
            <PlaceholderCard tag={t.center.tag} body={t.center.body} soon={t.soonTag} />
          </>
        )}
        {tab === "arena" && (
          <>
            <SurfaceHeader title={t.arena.title} />
            <PlaceholderCard tag={t.arena.tag} body={t.arena.body} soon={t.soonTag} />
          </>
        )}
        {tab === "foundry" && (
          <>
            <SurfaceHeader title={t.foundry.title} />
            <PlaceholderCard tag={t.foundry.tag} body={t.foundry.body} soon={t.soonTag} />
          </>
        )}
        {tab === "me" && (
          <>
            <SurfaceHeader title={t.me.title} />
            <PlaceholderCard tag={t.me.tag} body={t.me.body} soon={t.soonTag} />
          </>
        )}
      </main>

      {/* Companion dock (v0): reserved, non-floating zone. Avatar disabled — it can
          never cover cards/buttons/nav because it is a flex child, not fixed. A faint
          gold pulse signals a living companion without adding functionality. */}
      <div className="shrink-0 px-5 pb-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.03] px-4 py-2.5 backdrop-blur-sm">
          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#C9A66B]/20 text-sm font-semibold text-[#C9A66B] ring-1 ring-[#C9A66B]/25">
            치
          </span>
          <span className="truncate text-xs text-white/60">{t.companion}</span>
          <span
            aria-hidden
            className="btyOrbAnim ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A66B]"
            style={{ animation: "btyPulse 3.2s ease-in-out infinite" }}
          />
        </div>
      </div>

      <AppTabBar active={tab} onSelect={setTab} />
    </div>
  );
}
