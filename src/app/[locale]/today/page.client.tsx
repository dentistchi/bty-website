"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { CardSkeleton, AvatarComposite, UserAvatar } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages, type Locale } from "@/lib/i18n";

// Live read shapes — match the canonical /api/arena/* responses (PHASE 0 measured).
type CoreXpRes = {
  coreXpTotal: number;
  tier?: number;
  codeName?: string;
  subName?: string;
  avatarUrl?: string | null;
  avatarCharacterId?: string | null;
  avatarCharacterImageUrl?: string | null;
};
type TodayXpRes = { xpToday: number };
type AirBand = "low" | "mid" | "high";
type AirRes = { air_7d?: { band?: AirBand; missedWindows?: number; integritySlip?: boolean } };
type PendingContract = { id: string; action_text: string; deadline_at: string | null };
type PendingRes = { contracts?: PendingContract[] };
// Leadership stage progress — server-computed `progressPercent` (never derived from XP in UI).
type StageSummaryRes = { currentStage?: number; stageName?: string; progressPercent?: number };

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
  const [core, setCore] = React.useState<CoreXpRes | null>(null);
  const [stage, setStage] = React.useState<StageSummaryRes | null>(null);
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
    const [coreRes, today, air, pend, stageRes] = await Promise.all([
      arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => ({ coreXpTotal: 0 }) as CoreXpRes),
      arenaFetch<TodayXpRes>("/api/arena/today-xp").catch(() => ({ xpToday: 0 })),
      arenaFetch<AirRes>("/api/arena/leadership-engine/air").catch(() => ({}) as AirRes),
      arenaFetch<PendingRes>("/api/arena/action-contracts/pending").catch(() => ({ contracts: [] })),
      arenaFetch<StageSummaryRes>("/api/arena/leadership-engine/stage-summary").catch(
        () => ({}) as StageSummaryRes,
      ),
    ]);
    if (!mounted.current) return;
    setCore(coreRes ?? null);
    setStage(stageRes ?? null);
    setXpToday(today?.xpToday ?? 0);
    setAirBand(air?.air_7d?.band ?? null);
    setPending((pend?.contracts ?? [])[0] ?? null);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Avatar — character base only (canonical dashboard/ArenaHeader pattern: outfitUrl=undefined,
  // accessoryUrls=[]). The full-body outfit PNG misaligns in a small round crop. No assets →
  // UserAvatar initials, no fake image.
  const displayAvatarUrl =
    core?.avatarUrl ?? getAvatarCharacter(core?.avatarCharacterId)?.imageUrl ?? null;
  const characterUrl = React.useMemo(() => {
    const c = core?.avatarCharacterImageUrl;
    return typeof c === "string" && c.trim() !== "" ? c.trim() : null;
  }, [core]);

  const coreXp = core?.coreXpTotal ?? 0;
  const identitySub = [core?.codeName, core?.subName].filter(Boolean).join(" · ");

  // Stage progress — render server `progressPercent` only; clamp is a render guard, not computation.
  const stageBarPct =
    typeof stage?.progressPercent === "number" ? Math.max(0, Math.min(100, stage.progressPercent)) : 0;

  // AIR magnitude (neutral) — Low/Mid/High → 1/2/3 gold segments. No moral (green/red) color, no %.
  const airLevel = airBand === "high" ? 3 : airBand === "mid" ? 2 : airBand === "low" ? 1 : 0;
  const airBandLabel =
    airBand === "high"
      ? t.airBandHigh
      : airBand === "mid"
        ? t.airBandMid
        : airBand === "low"
          ? t.airBandLow
          : t.airBandUnknown;

  const beginHref = pending ? `/${locale}/my-page?arena_contract=resolve` : arenaEntry.href;
  // Gold CTA — gold bg with navy ink (readable on gold; the one navy text kept on dark surface).
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
      surface="navy"
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
            {/* ProfileCard — avatar (live) + Core XP (live) + Stage progress (live) + Companion (◐). Dark panel. */}
            <InfoCard title={t.profileTitle} tone="panel" className="shadow-lg">
              <div className="flex items-center gap-4">
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/15"
                  aria-hidden
                >
                  {characterUrl ? (
                    <AvatarComposite
                      size={64}
                      characterUrl={characterUrl}
                      outfitUrl={undefined}
                      accessoryUrls={[]}
                      alt=""
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <UserAvatar
                        avatarUrl={displayAvatarUrl}
                        initials={core?.codeName?.slice(0, 2)}
                        alt=""
                        size="lg"
                      />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-white/60">{t.coreXpLabel}</span>
                    <span className="text-2xl font-semibold text-white">
                      {coreXp.toLocaleString()}
                    </span>
                  </div>
                  {identitySub ? <p className="text-sm text-white/60">{identitySub}</p> : null}
                </div>
              </div>

              {/* Stage progress (live) — label when stage present, else honest level stub. Bar = server progressPercent. */}
              <div className="mt-3">
                {stage?.stageName ? (
                  <p className="text-xs text-white/60">
                    {t.stageLabel
                      .replace("{n}", String(stage.currentStage ?? ""))
                      .replace("{name}", stage.stageName)}
                  </p>
                ) : (
                  <p className="text-xs text-white/40">{t.levelStub}</p>
                )}
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-bty-gold"
                    style={{ width: `${stageBarPct}%` }}
                  />
                </div>
              </div>

              {/* Companion (static ◐) */}
              <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/90">
                <span className="font-medium text-white">{t.companionName}</span>
                {" · "}
                {t.companionLine}
              </p>
            </InfoCard>

            {/* 오늘의 선택 — pending action-contract (live) + Begin CTA (gold). Dark panel. */}
            <InfoCard title={t.situationTitle} tone="panel" className="shadow-lg">
              {pending ? (
                <p className="text-sm text-white/90">{pending.action_text}</p>
              ) : (
                <p className="text-sm text-white/60">{t.situationEmpty}</p>
              )}
              <div className="mt-3">
                <Link href={beginHref} className={goldCta}>
                  {t.beginCta}
                </Link>
              </div>
            </InfoCard>

            {/* 오늘의 포인트 — today-xp (live). Dark panel. */}
            <InfoCard title={t.pointsTitle} tone="panel" className="shadow-lg">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">{t.pointsLabel}</span>
                <span className="text-2xl font-semibold text-white">+{xpToday.toLocaleString()}</span>
              </div>
            </InfoCard>

            {/* AIR 요약 — band + neutral magnitude (live, no %, no moral color) + streak (◐). Dark panel. */}
            <InfoCard title={t.airTitle} tone="panel" className="shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">{t.airLabel}</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white">{airBandLabel}</span>
                  <span className="flex gap-1" aria-hidden>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-5 rounded-full ${i <= airLevel ? "bg-bty-gold" : "bg-white/10"}`}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <p className="text-xs text-white/40">{t.streakLabel.replace("{n}", String(streak))}</p>
            </InfoCard>
          </>
        )}
      </div>
    </ScreenShell>
  );
}
