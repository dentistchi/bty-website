"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { CardSkeleton } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages, type Locale } from "@/lib/i18n";

// Live read shapes — match the canonical /api/arena/* responses (PHASE 0 measured).
type CoreXpRes = { coreXpTotal: number; tier?: number; codeName?: string; subName?: string };
type TodayXpRes = { xpToday: number };
type AirBand = "low" | "mid" | "high";
type AirRes = { air_7d?: { band?: AirBand; missedWindows?: number; integritySlip?: boolean } };
type PendingContract = { id: string; action_text: string; deadline_at: string | null };
type PendingRes = { contracts?: PendingContract[] };

// Client-local streak (no server engine) — same key the dashboard uses. Labeled stub.
const STREAK_KEY = "btyArenaStreak:v1";
function readLocalStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { streak?: number };
    return typeof parsed.streak === "number" ? parsed.streak : 0;
  } catch {
    return 0;
  }
}

export default function TodayHomeClient() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as string;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).today;
  const { contract: arenaEntry } = useArenaEntryResolution(loc);

  const [loading, setLoading] = React.useState(true);
  const [coreXp, setCoreXp] = React.useState<number>(0);
  const [identity, setIdentity] = React.useState<{ codeName?: string; subName?: string }>({});
  const [xpToday, setXpToday] = React.useState<number>(0);
  const [airBand, setAirBand] = React.useState<AirBand | null>(null);
  const [pending, setPending] = React.useState<PendingContract | null>(null);
  const [streak, setStreak] = React.useState<number>(0);

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setStreak(readLocalStreak());
    const [core, today, air, pend] = await Promise.all([
      arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => ({ coreXpTotal: 0 } as CoreXpRes)),
      arenaFetch<TodayXpRes>("/api/arena/today-xp").catch(() => ({ xpToday: 0 })),
      arenaFetch<AirRes>("/api/arena/leadership-engine/air").catch(() => ({}) as AirRes),
      arenaFetch<PendingRes>("/api/arena/action-contracts/pending").catch(() => ({ contracts: [] })),
    ]);
    if (!mounted.current) return;
    setCoreXp(core?.coreXpTotal ?? 0);
    setIdentity({ codeName: core?.codeName, subName: core?.subName });
    setXpToday(today?.xpToday ?? 0);
    setAirBand(air?.air_7d?.band ?? null);
    setPending((pend?.contracts ?? [])[0] ?? null);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const airBandLabel =
    airBand === "high"
      ? t.airBandHigh
      : airBand === "mid"
        ? t.airBandMid
        : airBand === "low"
          ? t.airBandLow
          : t.airBandUnknown;

  const identitySub = [identity.codeName, identity.subName].filter(Boolean).join(" · ");

  // Begin CTA — gold token, navy ink. Routes to the pending action-contract resolve
  // surface when one is open, else to the resolved Arena entry.
  const beginHref = pending ? `/${locale}/my-page?arena_contract=resolve` : arenaEntry.href;
  const goldCta =
    "inline-flex w-full items-center justify-center rounded-2xl bg-bty-gold px-4 py-3.5 " +
    "text-center text-sm font-semibold text-bty-navy outline-none transition-opacity " +
    "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-bty-gold focus-visible:ring-offset-2";

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={t.title}
      mainAriaLabel={t.title}
      contentClassName="pb-28"
    >
      <div className="space-y-4">
        {loading ? (
          <>
            <CardSkeleton lines={3} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </>
        ) : (
          <>
            {/* ProfileCard — Core XP (live) + Companion (static ◐) + level/archetype (stub ◐) */}
            <InfoCard title={t.profileTitle}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-bty-secondary">{t.coreXpLabel}</span>
                <span className="text-2xl font-semibold text-bty-navy">
                  {coreXp.toLocaleString()}
                </span>
              </div>
              {identitySub ? <p className="text-sm text-bty-secondary">{identitySub}</p> : null}
              <p className="text-xs text-bty-muted">{t.levelStub}</p>
              <p className="mt-2 rounded-xl bg-bty-soft px-3 py-2 text-sm text-bty-text">
                <span className="font-medium text-bty-navy">{t.companionName}</span>
                {" · "}
                {t.companionLine}
              </p>
            </InfoCard>

            {/* 오늘의 상황 — pending action-contract (live) + Begin CTA (gold) */}
            <InfoCard title={t.situationTitle}>
              {pending ? (
                <p className="text-sm text-bty-text">{pending.action_text}</p>
              ) : (
                <p className="text-sm text-bty-secondary">{t.situationEmpty}</p>
              )}
              <div className="mt-3">
                <Link href={beginHref} className={goldCta}>
                  {t.beginCta}
                </Link>
              </div>
            </InfoCard>

            {/* 오늘 포인트 — today-xp (live) */}
            <InfoCard title={t.pointsTitle}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-bty-secondary">{t.pointsLabel}</span>
                <span className="text-2xl font-semibold text-bty-navy">
                  +{xpToday.toLocaleString()}
                </span>
              </div>
            </InfoCard>

            {/* AIR 요약 — band only (live, no %) + streak (◐ client-local) */}
            <InfoCard title={t.airTitle}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-bty-secondary">{t.airLabel}</span>
                <span className="text-base font-semibold text-bty-navy">{airBandLabel}</span>
              </div>
              <p className="text-xs text-bty-muted">{t.streakLabel.replace("{n}", String(streak))}</p>
            </InfoCard>
          </>
        )}
      </div>
    </ScreenShell>
  );
}
