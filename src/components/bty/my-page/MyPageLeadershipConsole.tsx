"use client";

import Link from "next/link";
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

// Client session guards (module-scoped → survive component remounts within one page
// session; Private-mode-proof, independent of localStorage). Reset on full reload only.
const SESSION_WORKED_CONTRACT_IDS = new Set<string>();
const SESSION_SHEET_SHOWN_IDS = new Set<string>();

/**
 * Whether to show the actor completion sheet. Pure (unit-tested). The sheet fires
 * ONLY for a completion of a contract worked THIS session (never a past latest-ever
 * completion), once per session (Private-mode-proof), honoring a persisted
 * localStorage "seen" flag when available.
 */
export function shouldShowCompletionSheet(args: {
  actorCompletedId: string | null;
  workedThisSession: boolean;
  alreadyShownThisSession: boolean;
  seenPersisted: boolean;
}): boolean {
  if (!args.actorCompletedId) return false;
  if (!args.workedThisSession) return false;
  if (args.alreadyShownThisSession) return false;
  if (args.seenPersisted) return false;
  return true;
}

/** Test-only: seed/reset the module session guards (they persist across remounts). */
export const __completionSheetTestHooks = {
  reset: () => {
    SESSION_WORKED_CONTRACT_IDS.clear();
    SESSION_SHEET_SHOWN_IDS.clear();
  },
  markWorked: (contractId: string) => SESSION_WORKED_CONTRACT_IDS.add(contractId),
};

/**
 * Decide whether the actor's open QR panel should close. Pure (unit-tested).
 * A residual completion prop (the actor's latest-ever verified contract) must
 * only close the panel when it matches the CURRENTLY-shown contract — otherwise
 * a prior completion would flicker-close every newly-opened panel. The
 * serverPack "nothing awaiting" transition is the verify fallback.
 */
export function shouldCloseQrPanel(args: {
  qrPanelOpen: boolean;
  completionSuccess: boolean;
  completionContractId: string | null;
  qrContractId: string | null;
  hasAwaitingVerification: boolean;
  serverPackLoaded: boolean;
  openActionContractPresent: boolean;
}): boolean {
  if (!args.qrPanelOpen) return false;
  const confirmed =
    args.completionSuccess &&
    args.completionContractId != null &&
    args.completionContractId === args.qrContractId;
  const nothingAwaiting =
    args.serverPackLoaded && !args.hasAwaitingVerification && !args.openActionContractPresent;
  return confirmed || nothingAwaiting;
}

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
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  // Which contract the open QR panel is for — so a residual completion prop from a
  // *prior* contract can't close a newly-opened panel (flicker regression fix).
  const [qrContractId, setQrContractId] = useState<string | null>(null);
  const [showPostCompletion, setShowPostCompletion] = useState(false);
  const [completionNarrativeState, setCompletionNarrativeState] = useState<string | null>(null);
  const [actorCompletedContractId, setActorCompletedContractId] = useState<string | null>(null);
  const [actorCompletedDescription, setActorCompletedDescription] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<
    "verified" | "already" | "failed" | "self_blocked" | "validation_required" | null
  >(null);
  // Actor-side notice when a QR is requested before action validation is approved.
  const [qrGateNotice, setQrGateNotice] = useState<string | null>(null);
  // MVE-D2 Phase 2 (Ruling 3): witness pre-confirm — load the promised action, then a human confirms.
  const [witnessDescription, setWitnessDescription] = useState<string | null>(null);
  const [witnessLoadFailed, setWitnessLoadFailed] = useState(false);
  const [witnessConfirming, setWitnessConfirming] = useState(false);
  const [pendingPulseRunId, setPendingPulseRunId] = useState<string | null>(null);
  const [pulseDismissed, setPulseDismissed] = useState(false);
  const lastSyncAtRef = useRef(0);
  const prevAwaitingCountRef = useRef(0);
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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    // Silent = background revalidation (polling / focus / visibility): never touch
    // isLoading or clear serverPack, so the page doesn't strobe the skeleton every
    // refetch (the "Show QR" button + panels stay mounted across polls).
    const silent = opts?.silent === true;
    if (!silent) {
      setLoadError(false);
      setIsLoading(true);
    }
    // P2 #1: raw XP card exposure suppressed — the `/api/arena/core-xp` client fetch that
    // fed the Core/Weekly XP numeric cards is removed. The API route is unchanged.
    try {
      const locParam = locale === "ko" ? "ko" : "en";
      const url = `/api/bty/my-page/state?locale=${encodeURIComponent(locParam)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });

      if (res.status === 401) {
        console.warn("[MyPageLeadershipConsole] 401 on state fetch — " + "session not ready, retrying");
        await new Promise((r) => setTimeout(r, 800));
        const retry = await fetch(url, { method: "GET", cache: "no-store" });
        if (!retry.ok) {
          // Background failure must not wipe the screen — keep the prior serverPack.
          if (!silent) {
            setServerPack(null);
            setLoadError(true);
            setIsLoading(false);
          }
          setMounted(true);
          return;
        }
        const retryData = (await retry.json()) as MyPageStateResponse;
        setServerPack(retryData);
        if (!silent) setIsLoading(false);
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
      // Background failure keeps the last good serverPack (no blank flash).
      if (!silent) {
        setServerPack(null);
        setLoadError(true);
      }
    } finally {
      if (!silent) setIsLoading(false);
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

  // Actor awaits a cross-device witness scan when a QR is being shown, or when a
  // contract is listed awaiting verification. A scan on another device fires no
  // focus/visibility/storage event here, so we poll only while this is true.
  const hasAwaitingVerification =
    (serverPack?.awaiting_verification_contracts?.length ?? 0) > 0;
  const awaitingWitnessVerification = (qrPanelOpen && !!qrUrl) || hasAwaitingVerification;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncCooldownMs = 1500;
    const syncNow = (source: "focus" | "visibility" | "storage" | "poll") => {
      const now = Date.now();
      if (now - lastSyncAtRef.current < syncCooldownMs) return;
      lastSyncAtRef.current = now;
      console.info("[BTY SYNC] visibility/focus refetch", { source });
      // #3: no unconditional routerRefresh here — a per-poll RSC refresh jumps
      // scroll every 4s. load() updates serverPack; the effect below refreshes the
      // RSC only when a contract actually leaves the awaiting set (verified).
      // All syncNow sources (poll / focus / visibility / storage) are background
      // revalidations of already-rendered content → silent (no skeleton strobe).
      void load({ silent: true }).then(() => {
        console.info("[BTY SYNC] session refetch complete", { source });
        dispatchArenaEntryResolutionInvalidate();
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
    // Conditional polling (Step 6): a cross-device witness scan fires no local
    // event, so while awaiting verification poll every 4s — the verified state
    // (contract resolved, QR panel closed below) then reflects without manual
    // navigation. The interval exists ONLY while awaiting → normal My Page
    // browsing polls zero; deps include the condition so it stops when it clears.
    const pollId = awaitingWitnessVerification
      ? setInterval(() => syncNow("poll"), 4000)
      : null;
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      if (pollId != null) clearInterval(pollId);
    };
  }, [load, awaitingWitnessVerification]);

  // #3: refresh the RSC (completion prop/sheet) ONLY when a contract leaves the
  // awaiting set (verified transition) — not on every 4s poll — so the scroll
  // position doesn't jump each cycle. Preserves the completion refresh at verify.
  useEffect(() => {
    const awaiting = serverPack?.awaiting_verification_contracts ?? [];
    // Mark contracts the actor has worked this session (were awaiting here) so their
    // completion — and only theirs — can fire the sheet.
    for (const ct of awaiting) SESSION_WORKED_CONTRACT_IDS.add(ct.id);
    const count = awaiting.length;
    if (count < prevAwaitingCountRef.current) {
      routerRefresh();
    }
    prevAwaitingCountRef.current = count;
  }, [serverPack, routerRefresh]);

  // Opening a QR for a contract also marks it as worked this session (covers the
  // path where the actor never saw it in the awaiting list on this device).
  useEffect(() => {
    if (qrContractId) SESSION_WORKED_CONTRACT_IDS.add(qrContractId);
  }, [qrContractId]);

  // Actor device: close the QR panel on the SAME signal that renders the confirmed
  // sheet — the server-detected completion prop `actionLoopQrCompletion` (delivered
  // via the poll's routerRefresh). The serverPack "nothing awaiting" check is a
  // fallback for close paths that don't set the completion prop. Closing flips the
  // gating false so polling stops and the completion surface takes over.
  useEffect(() => {
    if (
      shouldCloseQrPanel({
        qrPanelOpen,
        completionSuccess: actionLoopQrCompletion?.success === true,
        completionContractId: actionLoopQrCompletion?.contractId ?? null,
        qrContractId,
        hasAwaitingVerification,
        serverPackLoaded: serverPack != null,
        openActionContractPresent: serverPack?.open_action_contract != null,
      })
    ) {
      setQrPanelOpen(false);
      setQrUrl(null);
      setQrContractId(null);
    }
  }, [
    qrPanelOpen,
    actionLoopQrCompletion?.success,
    actionLoopQrCompletion?.contractId,
    qrContractId,
    serverPack,
    hasAwaitingVerification,
  ]);

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
    let seenPersisted = false;
    if (typeof window !== "undefined") {
      try {
        seenPersisted = window.localStorage.getItem(actorSeenKey(actorCompletedId)) != null;
      } catch {
        // localStorage unavailable (Private mode) — the session ref below guards this.
      }
    }
    if (
      !shouldShowCompletionSheet({
        actorCompletedId,
        workedThisSession: SESSION_WORKED_CONTRACT_IDS.has(actorCompletedId),
        alreadyShownThisSession: SESSION_SHEET_SHOWN_IDS.has(actorCompletedId),
        seenPersisted,
      })
    ) {
      return;
    }
    // Record "seen" at SHOW time (not only on close) + a module-scoped session set,
    // so navigating away without closing — or a remount — cannot re-fire the sheet
    // (session set survives remounts and Private-mode localStorage failure).
    SESSION_SHEET_SHOWN_IDS.add(actorCompletedId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(actorSeenKey(actorCompletedId), "1");
      } catch {
        // best-effort; the session set is the Private-mode guarantee.
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
            : errData?.error === "action_validation_required"
              ? "validation_required"
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
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        // QR requested before action validation is approved: do not open a
        // (doomed) QR — show the actor a specific "submit validation first" notice.
        if (errData?.error === "action_validation_required") {
          setQrGateNotice(tAction.qrValidationRequired);
        }
        return;
      }
      setQrGateNotice(null);
      setQrContractId(contractId || null);
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
  }, [serverPack, locale, tAction]);

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
        setQrContractId(contractId);
        setQrPanelOpen(true);
      }
    } catch {
      // silent — user can retry
    }
  }, []);

  const metrics = useMemo(() => {
    if (serverPack) {
      // Authed payload ships only signalCount (raw metric numerics are no longer serialized).
      // The identity screen consumes only signalCount; the remaining LeadershipMetrics fields
      // are inert placeholders kept solely to satisfy the downstream prop contract.
      return {
        xp: 0,
        AIR: 0,
        TII: 0,
        relationalBias: 0,
        operationalBias: 0,
        emotionalRegulation: 0,
        signalCount: serverPack.metrics.signalCount,
      } satisfies LeadershipMetrics;
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
        ) : scanResult === "validation_required" ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-[#D6CFC0] bg-[#FAF8F3] p-6 text-center text-sm leading-relaxed text-[#5A4A2F] dark:border-amber-300/20 dark:bg-amber-500/[0.06] dark:text-amber-100"
          >
            {tAction.scanValidationRequired}
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

      {/* P2 #1: raw XP summary cards (Core XP / Weekly XP) removed — internal XP totals
          were exposed verbatim to the user. Suppression is unconditional (all My Page
          entry paths). The ACTION_REQUIRED resolution path below is unaffected. */}

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

      {qrGateNotice && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-[#D6CFC0] bg-[#FAF8F3] p-4 text-center text-sm leading-relaxed text-[#5A4A2F]"
        >
          <p>{qrGateNotice}</p>
          {/* Close the navigation trap: link straight to the validation form
              (matches middleware `arenaResolvePath` = /[locale]/bty-arena/play/resolve). */}
          <Link
            href={`/${loc}/bty-arena/play/resolve`}
            className="inline-flex items-center justify-center rounded-full bg-[#1E2A38] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2A3A4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40"
          >
            {tAction.goToValidationCta}
          </Link>
        </div>
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
