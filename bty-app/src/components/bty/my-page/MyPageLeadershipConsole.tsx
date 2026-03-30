"use client";

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeMetrics, loadSignals } from "@/features/arena/logic";
import { loadReflections } from "@/features/growth/logic/reflectionStorage";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { MyPageStateResponse } from "@/features/my-page/api/getMyPageState";
import { computeLeadershipState, mergeLeadershipReflectionLayer } from "@/features/my-page/logic";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import { MyPageLeadershipScreen } from "@/features/my-page/MyPageLeadershipScreen";
import { ActionContractHub } from "@/components/bty/my-page/ActionContractHub";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: string };

/**
 * Signed-in: GET /api/bty/my-page/state (auth via cookie). Guests: local signals + domain compute.
 */
export function MyPageLeadershipConsole({ locale }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).myPageStub;
  const tAction = getMessages(loc).actionContract;

  const [localSignals, setLocalSignals] = useState<ArenaSignal[]>([]);
  const [localReflections, setLocalReflections] = useState<ReflectionEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [serverPack, setServerPack] = useState<MyPageStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secureLinkUrl, setSecureLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    setLocalSignals(loadSignals());
    setLocalReflections(loadReflections());
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    setIsLoading(true);
    try {
      const locParam = locale === "ko" ? "ko" : "en";
      const url = `/api/bty/my-page/state?locale=${encodeURIComponent(locParam)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });

      if (res.status === 401) {
        console.warn("[MyPageLeadershipConsole] 401 on state fetch — " + "session not ready, retrying");
        await new Promise((r) => setTimeout(r, 800));
        const retry = await fetch(url, { method: "GET", cache: "no-store" });
        if (!retry.ok) {
          setServerPack(null);
          setLoadError(true);
          setIsLoading(false);
          setMounted(true);
          return;
        }
        const retryData = (await retry.json()) as MyPageStateResponse;
        setServerPack(retryData);
        setIsLoading(false);
        setMounted(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`state fetch failed: ${res.status}`);
      }

      const data = (await res.json()) as MyPageStateResponse;
      setServerPack(data);
    } catch (err: unknown) {
      console.error(
        "[MyPageLeadershipConsole] " + "getMyPageState failed",
        {
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        },
      );
      setServerPack(null);
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setMounted(true);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [locale, load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = sessionStorage.getItem("bty_mypage_refetch_required");
    if (flag === "1") {
      sessionStorage.removeItem("bty_mypage_refetch_required");
      void load();
    }
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const handleRequestQr = useCallback(async () => {
    const contract = serverPack?.open_action_contract;
    const runId = contract?.session_id?.trim();
    if (!contract || !runId) return;
    try {
      const res = await fetch("/api/arena/leadership-engine/qr/action-loop-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { token?: string };
      const token = data.token;
      if (!token || typeof window === "undefined") return;
      const locSeg = locale === "ko" ? "ko" : "en";
      const path = `/${locSeg}/my-page?arena_action_loop=commit&aalo=${encodeURIComponent(token)}`;
      setQrUrl(`${window.location.origin}${path}`);
      setQrPanelOpen(true);
    } catch {
      // silent — user can retry
    }
  }, [serverPack, locale]);

  const handleRequestSecureLink = useCallback(async () => {
    const contract = serverPack?.open_action_contract;
    if (!contract) return;
    try {
      const res = await fetch("/api/arena/action-contract/secure-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(contract.session_id ? { run_id: contract.session_id } : {}),
          locale: locale === "ko" ? "ko" : "en",
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { url?: string };
      const rel = data.url;
      if (!rel) {
        setSecureLinkUrl(null);
        return;
      }
      if (rel.startsWith("/") && typeof window !== "undefined") {
        setSecureLinkUrl(`${window.location.origin}${rel}`);
      } else {
        setSecureLinkUrl(rel);
      }
    } catch {
      // silent
    }
  }, [serverPack, locale]);

  const metrics = useMemo(() => {
    if (serverPack) {
      const m = serverPack.metrics;
      const air = typeof m.AIR === "number" && Number.isFinite(m.AIR) ? m.AIR : 0;
      return { ...m, AIR: air } satisfies LeadershipMetrics;
    }
    return computeMetrics(localSignals);
  }, [serverPack, localSignals]);

  const state = useMemo(() => {
    if (serverPack) return serverPack.leadershipState;
    return mergeLeadershipReflectionLayer(
      computeLeadershipState(metrics, loc, localReflections),
      metrics,
      localSignals,
      loc,
      localReflections,
    );
  }, [serverPack, metrics, loc, localSignals, localReflections]);

  const reflectionsForUi = serverPack?.reflections ?? localReflections;

  return (
    <section
      data-testid="my-page-overview"
      role="region"
      aria-label={t.leadershipRegionAria}
      className="space-y-4"
      data-loading={isLoading ? "true" : "false"}
      data-load-error={loadError ? "true" : "false"}
    >
      {/* Action Contract Hub */}
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-white/5" />
      ) : (
        <ActionContractHub
          contract={serverPack?.open_action_contract ?? null}
          locale={locale}
          onRequestQr={handleRequestQr}
          onRequestSecureLink={handleRequestSecureLink}
        />
      )}

      {secureLinkUrl && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-xs text-white/50">{tAction.completeByQrLink}</p>
          <p className="select-all break-all text-xs text-cyan-300/70">{secureLinkUrl}</p>
        </div>
      )}

      {qrPanelOpen && qrUrl && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.05] p-6">
          <QRCodeSVG value={qrUrl} size={180} bgColor="transparent" fgColor="#ffffff" />
          <button
            type="button"
            onClick={() => setQrPanelOpen(false)}
            className="text-xs text-white/40 hover:text-white/70"
          >
            {tAction.dismiss}
          </button>
        </div>
      )}

      <MyPageLeadershipScreen
        locale={locale}
        metrics={metrics}
        state={state}
        mounted={mounted}
        reflections={reflectionsForUi}
      />
    </section>
  );
}
