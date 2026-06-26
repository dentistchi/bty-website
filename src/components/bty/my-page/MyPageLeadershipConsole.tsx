"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeMetrics, loadSignals } from "@/features/arena/logic";
import { loadReflections } from "@/features/growth/logic/reflectionStorage";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { MyPageStateResponse } from "@/features/my-page/api/getMyPageState";
import { computeLeadershipState, mergeLeadershipReflectionLayer } from "@/features/my-page/logic";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import { MyPageLeadershipScreen } from "@/features/my-page/MyPageLeadershipScreen";
import { ActionContractHub } from "@/components/bty/my-page/ActionContractHub";
import { PatternSignaturePanel } from "@/components/bty/my-page/PatternSignaturePanel";
import { PostCompletionSheet } from "@/components/bty/my-page/PostCompletionSheet";
import ArenaPulsePrompt from "@/components/bty-arena/ArenaPulsePrompt";
import { ActionLoopQrPanel } from "@/components/arena/ActionLoopQrPanel";
import { AwaitingQrList } from "@/components/bty/my-page/AwaitingQrList";
import {
  BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY,
  dispatchArenaEntryResolutionInvalidate,
  dispatchBtyActionContractUpdated,
} from "@/lib/bty/arena/arenaEntryResolutionInvalidate";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/** Server-provided result after action-loop QR commit (My Page query validation). */
export type ActionLoopQrCompletion = {
  success: boolean;
  narrativeState?: string | null;
  /** D2 actor-return: the just-completed contract (for re-show + one-time localStorage guard). */
  contractId?: string;
  contractDescription?: string | null;
};

/** localStorage one-time dismissal key (contract id only — never stores PII / promise text). */
const actorSeenKey = (contractId: string) => `bty_d2_actor_seen_${contractId}`;

type Props = {
  locale: string;
  actionLoopQrCompletion?: ActionLoopQrCompletion | null;
  /** From URL `arena_action_loop` — client validates when `commit` + `aaloParam`. */
  arenaActionLoopParam?: string | null;
  /** From URL `aalo` — signed token for witness / deep link. */
  aaloParam?: string | null;
  /** From URL `arena_contract=resolve` (middleware → bty hub → my-page) — scroll to Action Contract hub. */
  actionContractResolveFocus?: boolean;
};

/**
 * Signed-in: GET /api/bty/my-page/state (auth via cookie). Guests: local signals + domain compute.
 */
export function MyPageLeadershipConsole({
  locale,
  actionLoopQrCompletion = null,
  arenaActionLoopParam = null,
  aaloParam = null,
  actionContractResolveFocus = false,
}: Props) {
  const { refresh: routerRefresh } = useRouter();
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).myPageStub;
  const tAction = getMessages(loc).actionContract;

  const [localSignals, setLocalSignals] = useState<ArenaSignal[]>([]);
  const [localReflections, setLocalReflections] = useState<ReflectionEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [serverPack, setServerPack] = useState<MyPageStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [coreXp, setCoreXp] = useState<number | null>(null);
  const [weeklyXp, setWeeklyXp] = useState<number | null>(null);
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showPostCompletion, setShowPostCompletion] = useState(false);
  const [completionNarrativeState, setCompletionNarrativeState] = useState<string | null>(null);
  const [actorCompletedContractId, setActorCompletedContractId] = useState<string | null>(null);
  const [actorCompletedDescription, setActorCompletedDescription] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<
    "verified" | "already" | "failed" | "self_blocked" | null
  >(null);
  // MVE-D2 Phase 2 (Ruling 3): witness pre-confirm — load the promised action, then a human confirms.
  const [witnessDescription, setWitnessDescription] = useState<string | null>(null);
  const [witnessLoadFailed, setWitnessLoadFailed] = useState(false);
  const [witnessConfirming, setWitnessConfirming] = useState(false);
  const [pendingPulseRunId, setPendingPulseRunId] = useState<string | null>(null);
  const [pulseDismissed, setPulseDismissed] = useState(false);
  const lastSyncAtRef = useRef(0);
  const qrPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrPanelOpen) return;
    qrPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [qrPanelOpen]);

  useEffect(() => {
    setLocalSignals(loadSignals());
    setLocalReflections(loadReflections());
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/arena/pulse/pending")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setPendingPulseRunId(d.pendingPulseRunId ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    setIsLoading(true);
    void fetch("/api/arena/core-xp", { method: "GET", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ coreXpTotal?: number; seasonalXpTotal?: number }>) : null))
      .then((d) => {
        if (d != null) {
          setCoreXp(d.coreXpTotal ?? 0);
          setWeeklyXp(d.seasonalXpTotal ?? 0);
        }
      })
      .catch(() => { /* silent */ });
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

  /** `arena_contract=resolve` — focus the contract hub (`ENGINE_ARCHITECTURE_V1.md` §6.3). */
  useEffect(() => {
    if (!actionContractResolveFocus || typeof window === "undefined") return;
    if (isLoading) return;

    const run = () => {
      const el = document.getElementById("bty-action-contract-hub");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.focus();
      }
      const url = new URL(window.location.href);
      if (url.searchParams.get("arena_contract") === "resolve") {
        url.searchParams.delete("arena_contract");
        const next =
          url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
        window.history.replaceState({}, "", next);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [actionContractResolveFocus, isLoading, serverPack]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = sessionStorage.getItem("bty_mypage_refetch_required");
    if (flag === "1") {
      sessionStorage.removeItem("bty_mypage_refetch_required");
      void load().then(() => {
        dispatchArenaEntryResolutionInvalidate();
        routerRefresh();
      });
    }
  }, [load, routerRefresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncCooldownMs = 1500;
    const syncNow = (source: "focus" | "visibility" | "storage") => {
      const now = Date.now();
      if (now - lastSyncAtRef.current < syncCooldownMs) return;
      lastSyncAtRef.current = now;
      console.info("[BTY SYNC] visibility/focus refetch", { source });
      void load().then(() => {
        console.info("[BTY SYNC] session refetch complete", { source });
        dispatchArenaEntryResolutionInvalidate();
        routerRefresh();
      });
    };
    const onFocus = () => syncNow("focus");
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncNow("visibility");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY) return;
      syncNow("storage");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [load, routerRefresh]);

  // D2 actor-return: server detects the latest completed contract and passes it here.
  // Show the completion sheet ONCE per contract (localStorage guard, contract id only).
  // No load()/routerRefresh() here — the server page already rendered fresh, and refreshing
  // on a per-render prop object would loop. Witness mode never reaches this (server passes
  // null in witness mode AND the witness branch early-returns before this surface mounts).
  const actorCompletedId = actionLoopQrCompletion?.success
    ? actionLoopQrCompletion.contractId ?? null
    : null;
  useEffect(() => {
    if (!actorCompletedId) return;
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(actorSeenKey(actorCompletedId))) return;
      } catch {
        // localStorage unavailable — fail open (show once this session).
      }
    }
    setActorCompletedContractId(actorCompletedId);
    setActorCompletedDescription(actionLoopQrCompletion?.contractDescription ?? null);
    setCompletionNarrativeState(actionLoopQrCompletion?.narrativeState ?? null);
    setShowPostCompletion(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorCompletedId]);

  const handleActorSheetClose = useCallback(() => {
    if (actorCompletedContractId && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(actorSeenKey(actorCompletedContractId), "1");
      } catch {
        // ignore — best-effort one-time guard
      }
    }
    setShowPostCompletion(false);
  }, [actorCompletedContractId]);

  useEffect(() => {
    if (!actionLoopQrCompletion?.success) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("arena_action_loop");
    url.searchParams.delete("aalo");
    window.history.replaceState({}, "", url.toString());
  }, [actionLoopQrCompletion]);

  // Ruling 3: do NOT auto-validate. Load the promised action so the witness can
  // see it, then a human presses Confirm (handleWitnessConfirm) to validate.
  useEffect(() => {
    if (arenaActionLoopParam !== "commit" || !aaloParam) return;
    if (scanResult) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/arena/action-contract/by-token?aalo=${encodeURIComponent(aaloParam)}`,
        );
        if (!res.ok) {
          if (active) setWitnessLoadFailed(true);
          return;
        }
        const data = (await res.json()) as { ok?: boolean; contractDescription?: string };
        if (!active) return;
        if (data.ok) setWitnessDescription(data.contractDescription ?? "");
        else setWitnessLoadFailed(true);
      } catch {
        if (active) setWitnessLoadFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [arenaActionLoopParam, aaloParam, scanResult]);

  const handleWitnessConfirm = useCallback(async () => {
    if (!aaloParam || witnessConfirming) return;
    setWitnessConfirming(true);
    try {
      const res = await fetch("/api/arena/leadership-engine/qr/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arenaActionLoopToken: aaloParam,
          clientScanAtIso: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
          verified_at?: string | null;
        };
        console.error("[QR validate] failed", res.status, errData?.error ?? "");
        // self_witness_blocked is an intentional integrity rule, NOT a failure —
        // show neutral guidance to find another witness, never "try again".
        setScanResult(
          errData?.error === "self_witness_blocked"
            ? "self_blocked"
            : errData?.error === "contract_not_pending" || errData?.verified_at != null
              ? "already"
              : "failed",
        );
        return;
      }

      const data = (await res.json()) as {
        ok?: boolean;
        success?: boolean;
        narrativeState?: string | null;
      };

      if (data.ok || data.success) {
        setScanResult("verified");
        dispatchBtyActionContractUpdated();
        setShowPostCompletion(true);
        if (data.narrativeState) {
          setCompletionNarrativeState(data.narrativeState);
        }
        setQrPanelOpen(false);
        void load().then(() => {
          dispatchArenaEntryResolutionInvalidate();
          routerRefresh();
        });
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("arena_action_loop");
          url.searchParams.delete("aalo");
          window.history.replaceState({}, "", url.toString());
        }
      }
    } catch (err) {
      console.error("[QR validate] error", err);
      setScanResult("failed");
    } finally {
      setWitnessConfirming(false);
    }
  }, [aaloParam, witnessConfirming, load, routerRefresh]);

  const handleRequestQr = useCallback(async () => {
    const contract = serverPack?.open_action_contract;
    if (!contract) {
      console.warn("[handleRequestQr] no contract", { contract: null });
      return;
    }
    const runId = contract?.session_id?.trim();
    const contractId = typeof contract.id === "string" ? contract.id.trim() : "";
    if (!runId && !contractId) {
      console.warn("[handleRequestQr] no contract identifiers", { contract });
      return;
    }
    setQrPanelOpen(false);
    setQrUrl(null);
    try {
      const res = await fetch("/api/arena/leadership-engine/qr/action-loop-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(runId ? { runId } : {}),
          ...(contractId ? { contractId } : {}),
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { token?: string; qrUrl?: string; url?: string };
      const returnedQrUrl =
        (typeof data.qrUrl === "string" && data.qrUrl.trim() !== "" ? data.qrUrl.trim() : "") ||
        (typeof data.url === "string" && data.url.trim() !== "" ? data.url.trim() : "");
      if (returnedQrUrl) {
        setQrUrl(returnedQrUrl);
        setQrPanelOpen(true);
        return;
      }
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

  const handleRequestQrForContract = useCallback(async (contractId: string) => {
    if (!contractId) return;
    setQrPanelOpen(false);
    setQrUrl(null);
    try {
      const res = await fetch("/api/arena/leadership-engine/qr/action-loop-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { token?: string; qrUrl?: string; url?: string };
      const returnedQrUrl =
        (typeof data.qrUrl === "string" && data.qrUrl.trim() !== "" ? data.qrUrl.trim() : "") ||
        (typeof data.url === "string" && data.url.trim() !== "" ? data.url.trim() : "");
      if (returnedQrUrl) {
        setQrUrl(returnedQrUrl);
        setQrPanelOpen(true);
      }
    } catch {
      // silent — user can retry
    }
  }, []);

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

  // MVE-D2 Phase 2 (Ruling 3) — Witness pre-confirm screen.
  // Order: 1) 오늘의 약속  2) 행동  3) 사람의 확인 [확인하기]. No system-first headline;
  // a person confirms the actor's real action before it counts.
  const isWitnessMode = arenaActionLoopParam === "commit" && !!aaloParam;
  if (isWitnessMode) {
    return (
      <section
        data-testid="witness-confirm"
        role="region"
        aria-label={tAction.witnessPromiseTitle}
        className="mx-auto max-w-md space-y-4"
      >
        {scanResult === "verified" ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-green-300 bg-green-50 p-6 text-center text-sm text-green-800 dark:border-green-300/20 dark:bg-green-500/[0.08] dark:text-green-100"
          >
            {tAction.witnessConfirmSuccess}
          </div>
        ) : scanResult === "already" ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-800 dark:border-amber-300/20 dark:bg-amber-500/[0.08] dark:text-amber-100"
          >
            {tAction.scanAlready}
          </div>
        ) : scanResult === "self_blocked" ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-[#D6CFC0] bg-[#FAF8F3] p-6 text-center text-sm leading-relaxed text-[#5A4A2F] dark:border-amber-300/20 dark:bg-amber-500/[0.06] dark:text-amber-100"
          >
            {tAction.witnessSelfBlocked}
          </div>
        ) : scanResult === "failed" ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-center text-sm text-rose-800 dark:border-rose-300/20 dark:bg-rose-500/[0.08] dark:text-rose-100"
          >
            {tAction.scanFailed}
          </div>
        ) : witnessLoadFailed ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-center text-sm text-rose-800 dark:border-rose-300/20 dark:bg-rose-500/[0.08] dark:text-rose-100"
          >
            {tAction.witnessLoadFailed}
          </div>
        ) : (
          <div className="space-y-5 rounded-2xl border border-[#E8E3D8] bg-white p-6 text-center shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#667085]">
              {tAction.witnessPromiseTitle}
            </p>
            <p className="text-lg font-semibold leading-relaxed text-[#1E2A38]">
              {witnessDescription ?? "…"}
            </p>
            <p className="text-sm text-[#475467]">{tAction.witnessConfirmQuestion}</p>
            <button
              type="button"
              onClick={handleWitnessConfirm}
              disabled={witnessConfirming || witnessDescription === null}
              className="w-full rounded-xl bg-[#1E2A38] px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {witnessConfirming ? tAction.witnessConfirming : tAction.witnessConfirmCta}
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="my-page-overview"
      role="region"
      aria-label={t.leadershipRegionAria}
      className="space-y-4"
      data-loading={isLoading ? "true" : "false"}
      data-load-error={loadError ? "true" : "false"}
    >
      {scanResult && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm ${
            scanResult === "verified"
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-300/20 dark:bg-green-500/[0.08] dark:text-green-100"
              : scanResult === "already"
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-500/[0.08] dark:text-amber-100"
                : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-500/[0.08] dark:text-rose-100"
          }`}
        >
          {scanResult === "verified"
            ? tAction.scanVerified
            : scanResult === "already"
              ? tAction.scanAlready
              : tAction.scanFailed}
        </div>
      )}

      {/* XP Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#E8E3D8] bg-white px-4 py-4 shadow-sm text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#667085] mb-1">
            {loc === "ko" ? "코어 XP" : "Core XP"}
          </p>
          {coreXp == null || !mounted ? (
            <div className="mx-auto h-8 w-16 animate-pulse rounded-lg bg-[#E8E3D8]" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-[#1E2A38]">
              {coreXp}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#E8E3D8] bg-white px-4 py-4 shadow-sm text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#667085] mb-1">
            {loc === "ko" ? "주간 XP" : "Weekly XP"}
          </p>
          {weeklyXp == null || !mounted ? (
            <div className="mx-auto h-8 w-16 animate-pulse rounded-lg bg-[#E8E3D8]" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-[#1E2A38]">
              {weeklyXp}
            </p>
          )}
        </div>
      </div>

      {/* Action Contract Hub */}
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-white/5" />
      ) : (
        <ActionContractHub
          contract={serverPack?.open_action_contract ?? null}
          locale={locale}
          onRequestQr={handleRequestQr}
        />
      )}

      {pendingPulseRunId && !pulseDismissed && (
        <ArenaPulsePrompt
          locale={locale}
          submitted={false}
          onSubmit={(v) => {
            setPulseDismissed(true);
            void fetch("/api/arena/pulse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pulse_value: v, session_id: pendingPulseRunId }),
            });
          }}
          onSkip={() => setPulseDismissed(true)}
        />
      )}

      {qrPanelOpen && qrUrl && (
        <div ref={qrPanelRef}>
          <ActionLoopQrPanel
            url={qrUrl}
            onDismiss={() => setQrPanelOpen(false)}
            locale={loc}
          />
        </div>
      )}

      {!isLoading && serverPack?.awaiting_verification_contracts && (
        <AwaitingQrList
          contracts={serverPack.awaiting_verification_contracts.filter(
            (c) => c.id !== serverPack.open_action_contract?.id,
          )}
          locale={locale}
          onShowQr={handleRequestQrForContract}
        />
      )}

      {!isLoading && (
        <PatternSignaturePanel
          locale={locale}
          rows={serverPack?.pattern_signatures}
          title={t.patternSignatureConsoleTitle}
          lead={t.patternSignatureConsoleLead}
          empty={t.patternSignatureConsoleEmpty}
          regionAria={t.patternSignatureConsoleAria}
        />
      )}

      <PostCompletionSheet
        open={showPostCompletion}
        onClose={handleActorSheetClose}
        locale={locale}
        contractDescription={actorCompletedDescription}
        narrative={completionNarrativeState}
      />

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
