"use client";

/**
 * Today — BTY Daily OS surface (Slice 3). Ritual-first, not dashboard/score-first.
 *
 * Consumes the server layer as authority: GET /api/me/daily (gate) + GET /api/me/pulse
 * (relationship pulse). No local step progression, no client-side evidence interpretation.
 * Both fetches fail quiet — a degraded gate falls back to OPEN_DAY, a degraded pulse to
 * all-quiet — so the daily entry never blocks. Composition lives in CriticalGateCheckHost.
 *
 * /start remains the (data-free) Threshold ritual; this surface is where the Daily OS
 * snapshots are fetched (Scope Lock §4).
 */
import React from "react";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { CardSkeleton } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getMessages, type Locale } from "@/lib/i18n";
import { CriticalGateCheckHost } from "@/components/bty/today/CriticalGateCheckHost";
import type { DailyGateSnapshot } from "@/lib/bty/daily/dailyGateCheck";
import type { RelationshipPulse } from "@/lib/bty/daily/relationshipPulse";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";

const FALLBACK_GATE: DailyGateSnapshot = { gate: "OPEN_DAY", destination: { kind: "today" } };
// Today Intelligence fail-soft default — a clean open with no relationship claim.
const FALLBACK_INTEL: TodayIntelligence = {
  userState: "safe_fallback",
  relationshipFocus: "CleanStart",
  confidence: "none",
  reasonCodes: ["READ_ERROR"],
  fallbackMode: "read_error",
};
const FALLBACK_PULSE: RelationshipPulse = {
  overall: "quiet",
  domains: {
    self: { band: "quiet", copyKey: "today.pulse.self.quiet" },
    others: { band: "quiet", copyKey: "today.pulse.others.quiet" },
    ground: { band: "quiet", copyKey: "today.pulse.ground.quiet" },
  },
  hasAnyEvidence: false,
};

export default function TodayHomeClient() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as string;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const m = getMessages(loc);

  const [loading, setLoading] = React.useState(true);
  const [gate, setGate] = React.useState<DailyGateSnapshot>(FALLBACK_GATE);
  const [pulse, setPulse] = React.useState<RelationshipPulse>(FALLBACK_PULSE);
  const [intel, setIntel] = React.useState<TodayIntelligence>(FALLBACK_INTEL);

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [g, p, i] = await Promise.all([
      arenaFetch<DailyGateSnapshot>("/api/me/daily").catch(() => FALLBACK_GATE),
      arenaFetch<RelationshipPulse>("/api/me/pulse").catch(() => FALLBACK_PULSE),
      arenaFetch<TodayIntelligence>("/api/me/today-intelligence").catch(() => FALLBACK_INTEL),
    ]);
    if (!mounted.current) return;
    setGate(g ?? FALLBACK_GATE);
    setPulse(p ?? FALLBACK_PULSE);
    setIntel(i ?? FALLBACK_INTEL);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // STEP 1C / D1 — on entering Today, resolve + persist the canonical userDayKey and idempotently
  // create/reuse today's server-authoritative row. Best-effort (fire-and-forget): sends the device
  // IANA tz for capture; UTC fallback + idempotency are handled server-side. No UI dependency yet
  // (new-day vs already-began, streak/comeback derive from this foundation later).
  React.useEffect(() => {
    let tz: string | null = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      tz = null;
    }
    void fetch("/api/me/day/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tz }),
    }).catch(() => {});
  }, []);

  return (
    <ScreenShell
      locale={locale}
      eyebrow={m.today.eyebrow}
      mainAriaLabel={m.today.eyebrow}
      contentClassName="pb-28"
      surface="navy"
      safeAreaTop
    >
      {loading ? (
        <div className="space-y-4" aria-label={m.today.dailyOs.loadingLabel}>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
      ) : (
        <CriticalGateCheckHost snapshot={gate} pulse={pulse} intel={intel} locale={loc} />
      )}
    </ScreenShell>
  );
}
