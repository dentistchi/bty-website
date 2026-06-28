"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { CardSkeleton, AvatarComposite, UserAvatar } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { supabase } from "@/lib/supabase";
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
  // Real name only — read from the browser session's user_metadata. Null → greeting omits the name
  // (no fake / no email exposure). Companion stays "Dr. Chi"; greeting uses the *user's* name only.
  const [displayName, setDisplayName] = React.useState<string | null>(null);

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted.current) return;
        const meta = data?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
        const n = meta?.full_name ?? meta?.name ?? null;
        setDisplayName(typeof n === "string" && n.trim() !== "" ? n.trim() : null);
      })
      .catch(() => {});
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

  // Avatar — character base only (canonical dashboard/ArenaHeader pattern). No assets → initials.
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

  // AIR magnitude (neutral) — Low/Mid/High → 1/2/3 gold segments. No moral color, no %.
  const airLevel = airBand === "high" ? 3 : airBand === "mid" ? 2 : airBand === "low" ? 1 : 0;
  const airBandLabel =
    airBand === "high"
      ? t.airBandHigh
      : airBand === "mid"
        ? t.airBandMid
        : airBand === "low"
          ? t.airBandLow
          : t.airBandUnknown;

  const greeting = displayName ? t.greetingNamed.replace("{name}", displayName) : t.greetingPlain;
  const beginHref = pending ? `/${locale}/my-page?arena_contract=resolve` : arenaEntry.href;
  const goldCta =
    "inline-flex w-full items-center justify-center rounded-2xl bg-bty-gold px-4 py-3.5 " +
    "text-center text-sm font-semibold text-bty-navy outline-none transition-opacity " +
    "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-bty-gold focus-visible:ring-offset-2";

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={greeting}
      subtitle={t.promiseLine}
      mainAriaLabel={greeting}
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
            {/* 2. Companion — emotional center: avatar + Dr.Chi voice (promise language). XP demoted to Growth. */}
            <InfoCard title={t.companionCardTitle} tone="panel" className="shadow-lg">
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
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{t.companionName}</p>
                  <p className="mt-0.5 text-sm text-white/70">{t.companionLine}</p>
                </div>
              </div>
            </InfoCard>

            {/* 3. Today's Choice — pending action-contract (live) + Begin CTA (gold). */}
            <InfoCard title={t.situationTitle} tone="panel" className="shadow-lg">
              {pending ? (
                <p className="text-sm text-white/90">{pending.action_text}</p>
              ) : (
                <p className="text-sm text-white/70">{t.choiceWaiting}</p>
              )}
              <div className="mt-3">
                <Link href={beginHref} className={goldCta}>
                  {t.beginCta}
                </Link>
              </div>
            </InfoCard>

            {/* 4. Behavior Status — promise marker ○ (waiting). Rendered only when a promise is open. NO ✓ (D5). */}
            {pending ? (
              <InfoCard title={t.behaviorTitle} tone="panel" className="shadow-lg">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-white/40"
                    aria-hidden
                  />
                  <span className="text-sm text-white/90">{t.behaviorWaiting}</span>
                </div>
              </InfoCard>
            ) : null}

            {/* 5. Growth — XP / Core XP / Stage (real values, demoted behind the ritual). */}
            <InfoCard title={t.growthTitle} tone="panel" className="shadow-lg">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">{t.pointsLabel}</span>
                <span className="text-lg font-semibold text-white">+{xpToday.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">{t.coreXpLabel}</span>
                <span className="text-lg font-semibold text-white">{coreXp.toLocaleString()}</span>
              </div>
              {identitySub ? <p className="text-xs text-white/50">{identitySub}</p> : null}
              <div className="mt-1">
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
            </InfoCard>

            {/* 6. AIR — band + neutral magnitude (live, no %, no moral color) + streak (◐). */}
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
