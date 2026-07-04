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

const FALLBACK_GATE: DailyGateSnapshot = { gate: "OPEN_DAY", destination: { kind: "today" } };
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
  // STEP 5 — when arrived via the Orb door (?enter=orb), a warm light "echo" of the Orb
  // settles over Today's top and fades, so Today reads as opened BY the Orb (not a page load).
  // SSR-safe: starts false → detected/flipped in a client effect (no hydration mismatch).
  const [orbEcho, setOrbEcho] = React.useState(false);
  const [echoOut, setEchoOut] = React.useState(false);

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [g, p] = await Promise.all([
      arenaFetch<DailyGateSnapshot>("/api/me/daily").catch(() => FALLBACK_GATE),
      arenaFetch<RelationshipPulse>("/api/me/pulse").catch(() => FALLBACK_PULSE),
    ]);
    if (!mounted.current) return;
    setGate(g ?? FALLBACK_GATE);
    setPulse(p ?? FALLBACK_PULSE);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // STEP 5 — Orb → Today light echo. Detect the transient ?enter=orb flag, strip it (so a
  // later refresh does not replay), then mount the echo and fade it out. Reduced-motion skips it.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enter") !== "orb") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("enter");
    window.history.replaceState({}, "", url.pathname + url.search);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setOrbEcho(true);
    const raf = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => setEchoOut(true))
    );
    const t = window.setTimeout(() => setOrbEcho(false), 900);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
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
      <div style={{ position: "relative" }}>
        {/* STEP 5 — warm light echo of the Orb, settling over Today's top then fading.
            Decorative only (aria-hidden, non-interactive); no content/copy change. */}
        {orbEcho ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -72,
              left: "50%",
              width: "min(560px, 128vw)",
              height: 300,
              transform: "translateX(-50%)",
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 0,
              filter: "blur(6px)",
              background:
                "radial-gradient(closest-side, rgba(227,162,90,0.5), rgba(227,162,90,0.16) 46%, rgba(227,162,90,0) 74%)",
              opacity: echoOut ? 0 : 1,
              transition: "opacity 720ms ease-out",
            }}
          />
        ) : null}
        <div style={{ position: "relative", zIndex: 1 }}>
          {loading ? (
            <div className="space-y-4" aria-label={m.today.dailyOs.loadingLabel}>
              <CardSkeleton lines={2} />
              <CardSkeleton lines={3} />
              <CardSkeleton lines={2} />
            </div>
          ) : (
            <CriticalGateCheckHost snapshot={gate} pulse={pulse} locale={loc} />
          )}
        </div>
      </div>
    </ScreenShell>
  );
}
