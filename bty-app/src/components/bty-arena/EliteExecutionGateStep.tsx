"use client";

import { QRCodeSVG } from "qrcode.react";
import React from "react";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { CardSkeleton } from "./CardSkeleton";

export type ExecutionGateContract = {
  id: string;
  status: string;
  who?: string | null;
  what?: string | null;
  how?: string | null;
  step_when?: string | null;
  raw_text?: string | null;
  verified_at?: string | null;
  validation_approved_at?: string | null;
  submitted_at?: string | null;
  escalated_at?: string | null;
};

export type EliteExecutionGateStepProps = {
  runId: string | null;
  locale: "ko" | "en";
  /** Step 6 continued with `gated: "pattern_threshold"` — next scenario allowed without verification on file */
  deferGateVerification?: boolean;
  /** Status line when `deferGateVerification` and no contract row yet */
  patternThresholdDeferLine?: string;
  title: string;
  intro: string;
  contractRecordHeading: string;
  verificationRecorded: string;
  awaitingVerificationOutcome: string;
  verificationNotRecorded: string;
  underReview: string;
  additionalConfirmation: string;
  executionAbandonedLead: string;
  resumeVerificationHint: string;
  rawTextFallback: string;
  nextScenarioLabel: string;
  nextScenarioBlocked: string;
  loadError: string;
  onContinueNextScenario: () => void;
  continueLoading?: boolean;
};

async function fetchContract(runId: string): Promise<ExecutionGateContract | null> {
  const r = await fetch(
    `/api/bty/action-contract/by-session?sessionId=${encodeURIComponent(runId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const j = (await r.json().catch(() => ({}))) as { contract?: ExecutionGateContract | null };
  if (!r.ok) return null;
  return j.contract ?? null;
}

async function fetchRunCompletionState(runId: string): Promise<string | null> {
  const r = await fetch(`/api/arena/run/${encodeURIComponent(runId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { run?: { completion_state?: string | null } };
  if (!r.ok) return null;
  const cs = j.run?.completion_state;
  return typeof cs === "string" ? cs : null;
}

const DEBUG_STEP6 =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_ELITE_STEP6 === "1";

function verbatimRawText(c: ExecutionGateContract): string {
  const rt = typeof c.raw_text === "string" ? c.raw_text.trim() : "";
  if (rt.length > 0) return c.raw_text as string;
  const parts = [
    typeof c.who === "string" && c.who.trim() ? `Who: ${c.who.trim()}` : "",
    typeof c.what === "string" && c.what.trim() ? `What: ${c.what.trim()}` : "",
    typeof c.how === "string" && c.how.trim() ? `How: ${c.how.trim()}` : "",
    typeof c.step_when === "string" && c.step_when.trim() ? `When: ${c.step_when.trim()}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Step 7 — Execution Gate: verbatim contract text, QR when eligible, factual lock copy (UX_FLOW_LOCK_V1 §2 Step 7, §3).
 */
export function EliteExecutionGateStep({
  runId,
  locale,
  deferGateVerification = false,
  patternThresholdDeferLine = "",
  title,
  intro,
  contractRecordHeading,
  verificationRecorded,
  awaitingVerificationOutcome,
  verificationNotRecorded,
  underReview,
  additionalConfirmation,
  executionAbandonedLead,
  resumeVerificationHint,
  rawTextFallback,
  nextScenarioLabel,
  nextScenarioBlocked,
  loadError,
  onContinueNextScenario,
  continueLoading = false,
}: EliteExecutionGateStepProps) {
  const [contract, setContract] = React.useState<ExecutionGateContract | null>(null);
  const [completionState, setCompletionState] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [qrUrl, setQrUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!DEBUG_STEP6) return;
    console.log("[EliteExecutionGateStep] mount", { runId, deferGateVerification });
    return () => {
      console.log("[EliteExecutionGateStep] unmount", { runId });
    };
  }, [runId, deferGateVerification]);

  const load = React.useCallback(async () => {
    if (!runId) {
      setLoading(false);
      setContract(null);
      setCompletionState(null);
      return;
    }
    setLoading(true);
    try {
      const [snap, cs] = await Promise.all([fetchContract(runId), fetchRunCompletionState(runId)]);
      setContract(snap);
      setCompletionState(cs);
    } catch {
      setContract(null);
      setCompletionState(null);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const verificationOnFile =
    Boolean(contract?.verified_at != null && String(contract.verified_at).trim() !== "") ||
    completionState === "complete_verified";

  /** Threshold-skip path: no draft yet, but user may finish the run / go to next scenario */
  const allowNextScenario = deferGateVerification || verificationOnFile;

  /** Stop 8s polling once verification is on file or pattern-threshold defer has no row to watch. */
  const contractAbsent = contract == null;
  const shouldPollContract = React.useMemo(() => {
    if (!runId) return false;
    if (verificationOnFile) return false;
    if (deferGateVerification && contractAbsent) return false;
    return true;
  }, [runId, verificationOnFile, deferGateVerification, contractAbsent]);

  React.useEffect(() => {
    if (!shouldPollContract) return;
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [shouldPollContract, load]);

  /** Stable primitive deps so polling (new object identity) does not re-mint QR every 8s. */
  const qrMintEligibleKey = React.useMemo(() => {
    if (!runId || !contract?.id) return null;
    const st = String(contract.status ?? "");
    const approvedAwaitingVerify =
      st === "approved" &&
      (contract.verified_at == null || String(contract.verified_at).trim() === "") &&
      contract.validation_approved_at != null;
    if (!approvedAwaitingVerify) return null;
    return `${runId}:${contract.id}`;
  }, [
    runId,
    contract?.id,
    contract?.status,
    contract?.verified_at,
    contract?.validation_approved_at,
  ]);

  React.useEffect(() => {
    if (!qrMintEligibleKey || !runId) {
      setQrUrl(null);
      return;
    }
    let alive = true;
    arenaFetch<{ url?: string }>("/api/arena/leadership-engine/qr/action-loop-token", {
      json: { runId },
    })
      .then((res) => {
        if (!alive) return;
        setQrUrl(typeof res.url === "string" ? res.url : null);
      })
      .catch(() => {
        if (!alive) return;
        setQrUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [runId, qrMintEligibleKey]);

  const lockLine = React.useMemo(() => {
    if (completionState === "locked_step7_abandoned") {
      return executionAbandonedLead;
    }
    if (deferGateVerification && !contract && patternThresholdDeferLine.trim()) {
      return patternThresholdDeferLine.trim();
    }
    if (verificationOnFile) {
      return verificationRecorded;
    }
    if (!contract) {
      return verificationNotRecorded;
    }
    const st = String(contract.status ?? "");
    if (st === "submitted") {
      return underReview;
    }
    if (st === "escalated") {
      return additionalConfirmation;
    }
    if (st === "approved" && (contract.verified_at == null || String(contract.verified_at).trim() === "")) {
      return contract.validation_approved_at ? awaitingVerificationOutcome : underReview;
    }
    if (st === "rejected") {
      return verificationNotRecorded;
    }
    if (st === "pending") {
      return verificationNotRecorded;
    }
    return awaitingVerificationOutcome;
  }, [
    contract,
    completionState,
    verificationOnFile,
    deferGateVerification,
    patternThresholdDeferLine,
    executionAbandonedLead,
    verificationRecorded,
    verificationNotRecorded,
    underReview,
    additionalConfirmation,
    awaitingVerificationOutcome,
  ]);

  const rawDisplay =
    contract && verbatimRawText(contract).trim().length > 0 ? verbatimRawText(contract) : rawTextFallback;

  if (loading) {
    return (
      <div className="mt-4" aria-busy="true">
        <CardSkeleton showLabel={false} lines={3} style={{ padding: "16px 20px" }} />
      </div>
    );
  }

  return (
    <div
      data-testid="elite-execution-gate"
      className="mt-4 space-y-4 border-t border-bty-border/60 pt-4"
      role="region"
      aria-label={title}
    >
      <h3 className="text-base font-semibold text-bty-navy">{title}</h3>
      <p className="text-sm leading-relaxed opacity-90">{intro}</p>

      <p className="text-sm font-medium text-bty-navy/90" role="status">
        {lockLine}
      </p>

      {completionState === "locked_step7_abandoned" ? (
        <p className="text-xs leading-relaxed opacity-80">{resumeVerificationHint}</p>
      ) : null}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-75">{contractRecordHeading}</h4>
        <pre
          className="whitespace-pre-wrap rounded-xl border border-bty-border/80 bg-bty-soft/25 px-4 py-3 text-sm leading-relaxed"
          style={{ fontFamily: "inherit" }}
        >
          {rawDisplay}
        </pre>
      </div>

      {qrUrl ? (
        <div className="flex flex-col items-start gap-2">
          <div className="rounded-xl border border-bty-border bg-white p-3">
            <QRCodeSVG value={qrUrl} size={160} level="M" />
          </div>
          <p className="max-w-md break-all text-xs opacity-75">{qrUrl}</p>
        </div>
      ) : null}

      {!qrUrl && contract?.status === "approved" && contract.validation_approved_at && !verificationOnFile ? (
        <p className="text-xs opacity-70" role="status">
          {locale === "ko"
            ? "QR을 불러오지 못했습니다. 잠시 후 다시 시도하거나 My Page에서 확인하세요."
            : "QR could not be loaded. Retry shortly or check My Page."}
        </p>
      ) : null}

      {!runId ? <p className="text-sm text-red-800">{loadError}</p> : null}

      <button
        type="button"
        onClick={onContinueNextScenario}
        disabled={continueLoading || !allowNextScenario}
        aria-busy={continueLoading}
        className="w-full max-w-sm rounded-xl border border-bty-navy bg-bty-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {nextScenarioLabel}
      </button>
      {!allowNextScenario && runId ? (
        <p className="text-xs opacity-75">{nextScenarioBlocked}</p>
      ) : null}

      {continueLoading ? (
        <div aria-busy="true">
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      ) : null}
    </div>
  );
}
