"use client";

import React from "react";
import { isBtyE2eStep6TraceEnabled } from "@/lib/bty/arena/e2eStep6BrowserTrace";
import { runAllLayer1Rules } from "@/lib/bty/validator/layer1Rules";
import { CardSkeleton } from "./CardSkeleton";

export type EliteActionContractStepProps = {
  runId: string | null;
  scenarioId: string;
  primaryChoice: string;
  title: string;
  intro: string;
  labels: {
    who: string;
    whoHint: string;
    what: string;
    whatHint: string;
    when: string;
    whenHint: string;
    how: string;
    howInstruction: string;
    howResponsibilityLead: string;
  };
  placeholders: { who: string; what: string; how: string; when: string };
  submitLabel: string;
  /** Shown on the submit control while PATCH/commit/validation runs */
  submittingLabel: string;
  loadError: string;
  ensureFailed: string;
  /** Shown while POST /api/action-contracts is in flight */
  creatingContractLabel: string;
  /** Short heading when the draft contract could not be created (form hidden) */
  initFailedTitle: string;
  /** POST returned `gated: "pattern_threshold"` — not an error; neutral copy + single continue */
  patternThresholdTitle: string;
  patternThresholdBody: string;
  patternThresholdContinueLabel: string;
  onPatternThresholdContinue: () => void;
  revisionRequired: string;
  /** Structural messages only — from validator `signal` strings */
  onContractValidated: () => void;
};

function buildRawText(who: string, what: string, how: string, when: string): string {
  return [`Who: ${who.trim()}`, `What: ${what.trim()}`, `When: ${when.trim()}`, `How: ${how.trim()}`].join("\n");
}

async function readJsonBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isContractNotFound(data: Record<string, unknown>): boolean {
  return data.error === "contract_not_found";
}

const DEBUG_STEP6 =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_ELITE_STEP6 === "1";

const DEBUG_STEP7_TRANSITION =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_ELITE_STEP7_TRANSITION === "1";

type EnsureDraftResult =
  | { kind: "contract"; contractId: string }
  | { kind: "pattern_threshold" }
  | { kind: "fail"; apiDetail?: string };

/**
 * Step 6 — Action Contract: four fields, format-style placeholders, structural validation only (Layer 1 client + server).
 */
export function EliteActionContractStep({
  runId,
  scenarioId,
  primaryChoice,
  title,
  intro,
  labels,
  placeholders,
  submitLabel,
  submittingLabel,
  loadError,
  ensureFailed,
  creatingContractLabel,
  initFailedTitle,
  patternThresholdTitle,
  patternThresholdBody,
  patternThresholdContinueLabel,
  onPatternThresholdContinue,
  revisionRequired,
  onContractValidated,
}: EliteActionContractStepProps) {
  const [contractId, setContractId] = React.useState<string | null>(null);
  const [patternThresholdGate, setPatternThresholdGate] = React.useState(false);
  const [who, setWho] = React.useState("");
  const [what, setWhat] = React.useState("");
  const [how, setHow] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);
  const [outcomeMessage, setOutcomeMessage] = React.useState<string | null>(null);
  const [ensuring, setEnsuring] = React.useState(true);
  /** PATCH → commit → submit-validation only — not Step 7 / execution-gate polling. */
  const [isSubmittingContract, setIsSubmittingContract] = React.useState(false);
  /** Prevents overlapping submits before `isSubmittingContract` re-renders (double-click). */
  const submitInFlightRef = React.useRef(false);
  /** Parent passes a new function each `useArenaSession` render; do not put it in `onSubmit` deps. */
  const onValidatedRef = React.useRef(onContractValidated);
  React.useEffect(() => {
    onValidatedRef.current = onContractValidated;
  }, [onContractValidated]);

  const setContractBusy = React.useCallback((next: boolean, reason: string) => {
    if (DEBUG_STEP6) {
      console.log("[EliteActionContractStep] setIsSubmittingContract", {
        next,
        reason,
        runId,
        contractId,
      });
    }
    setIsSubmittingContract(next);
  }, [runId, contractId]);

  const submitButtonRef = React.useRef<HTMLButtonElement | null>(null);
  React.useLayoutEffect(() => {
    if (!DEBUG_STEP6) return;
    const el = submitButtonRef.current;
    if (!el) return;
    console.log("[EliteActionContractStep] submit button DOM (after commit)", {
      reason: "useLayoutEffect",
      isSubmittingContract,
      ariaBusy: el.getAttribute("aria-busy"),
      disabled: el.disabled,
      runId,
      contractId,
    });
  }, [isSubmittingContract, runId, contractId]);

  const createContract = React.useCallback(async (): Promise<EnsureDraftResult> => {
    if (!runId || !scenarioId || !primaryChoice) return { kind: "fail" };
    const res = await fetch("/api/action-contracts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, scenarioId, primaryChoice }),
    });
    const data = await readJsonBody(res);
    const buildFailDetail = (): string | undefined => {
      const code = typeof data.error === "string" ? data.error : "unknown_error";
      let line = `HTTP ${res.status} · ${code}`;
      const dbg = data.debug;
      if (dbg && typeof dbg === "object") {
        const d = dbg as Record<string, unknown>;
        const msg = d.supabaseMessage;
        if (typeof msg === "string" && msg.trim() !== "") {
          line += ` · ${msg.trim()}`;
        } else {
          const step = d.failedStep;
          if (typeof step === "string" && step.trim() !== "") line += ` · step:${step}`;
        }
      }
      return line;
    };

    if (!res.ok) {
      return { kind: "fail", apiDetail: buildFailDetail() };
    }
    if (data.gated === "pattern_threshold" && data.created === false && data.contractId == null) {
      return { kind: "pattern_threshold" };
    }
    if (typeof data.contractId === "string") {
      return { kind: "contract", contractId: data.contractId };
    }
    return { kind: "fail", apiDetail: buildFailDetail() };
  }, [runId, scenarioId, primaryChoice]);

  React.useEffect(() => {
    if (!runId || !scenarioId || !primaryChoice) {
      setEnsuring(false);
      setContractId(null);
      setOutcomeMessage(ensureFailed);
      return;
    }
    let alive = true;
    setEnsuring(true);
    setContractId(null);
    setOutcomeMessage(null);
    setPatternThresholdGate(false);
    void createContract().then((result) => {
      if (!alive) return;
      if (result.kind === "contract") {
        setContractId(result.contractId);
        setPatternThresholdGate(false);
      } else if (result.kind === "pattern_threshold") {
        setContractId(null);
        setPatternThresholdGate(true);
      } else {
        setOutcomeMessage(
          result.apiDetail ? `${ensureFailed} — ${result.apiDetail}` : ensureFailed,
        );
        setPatternThresholdGate(false);
      }
      setEnsuring(false);
    });
    return () => {
      alive = false;
    };
  }, [runId, scenarioId, primaryChoice, ensureFailed, createContract]);

  const onSubmit = React.useCallback(async () => {
    // Guard uses ref only — `isSubmittingContract` must NOT be in this callback's deps (avoids identity churn while true).
    if (!contractId || submitInFlightRef.current) return;
    setOutcomeMessage(null);
    const rawText = buildRawText(who, what, how, when);
    const l1 = runAllLayer1Rules({ who, what, how, when, rawText });
    if (l1.length > 0) {
      setFieldErrors(l1.map((e) => e.signal));
      return;
    }
    setFieldErrors([]);
    submitInFlightRef.current = true;
    setContractBusy(true, "onSubmit:start PATCH→commit→submit-validation");
    try {
      const trimmed = {
        who: who.trim(),
        what: what.trim(),
        how: how.trim(),
        when: when.trim(),
        raw_text: rawText.trim(),
      };

      type ValidationPayload = {
        outcome?: string;
        layer1_errors?: { rule: string; signal: string }[];
        error?: string;
      };

      const runPipeline = async (activeId: string): Promise<
        | { kind: "recreate" }
        | { kind: "fail"; message: string }
        | { kind: "ok"; data: ValidationPayload }
      > => {
        const patchRes = await fetch(`/api/action-contracts/${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            who: trimmed.who,
            what: trimmed.what,
            how: trimmed.how,
            when: trimmed.when,
          }),
        });
        const patchData = await readJsonBody(patchRes);
        if (patchRes.status === 404 && isContractNotFound(patchData)) {
          return { kind: "recreate" };
        }
        if (!patchRes.ok) {
          return {
            kind: "fail",
            message: typeof patchData.error === "string" ? patchData.error : loadError,
          };
        }

        const commitRes = await fetch(`/api/action-contracts/${encodeURIComponent(activeId)}/commit`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const commitData = await readJsonBody(commitRes);
        if (commitRes.status === 404 && isContractNotFound(commitData)) {
          return { kind: "recreate" };
        }
        if (!commitRes.ok) {
          return {
            kind: "fail",
            message: typeof commitData.error === "string" ? commitData.error : loadError,
          };
        }

        const valRes = await fetch("/api/bty/action-contract/submit-validation", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId: activeId,
            who: trimmed.who,
            what: trimmed.what,
            how: trimmed.how,
            when: trimmed.when,
            raw_text: trimmed.raw_text,
          }),
        });
        const valData = (await readJsonBody(valRes)) as ValidationPayload;
        if (valRes.status === 404 && isContractNotFound(valData as Record<string, unknown>)) {
          return { kind: "recreate" };
        }
        if (!valRes.ok) {
          return {
            kind: "fail",
            message: typeof valData.error === "string" ? valData.error : loadError,
          };
        }
        return { kind: "ok", data: valData };
      };

      let cid = contractId;
      for (let attempt = 0; attempt < 2; attempt++) {
        const phase = await runPipeline(cid);
        if (phase.kind === "recreate") {
          if (attempt >= 1) {
            setOutcomeMessage(ensureFailed);
            return;
          }
          const ensured = await createContract();
          if (ensured.kind !== "contract") {
            setOutcomeMessage(ensureFailed);
            return;
          }
          setContractId(ensured.contractId);
          cid = ensured.contractId;
          continue;
        }
        if (phase.kind === "fail") {
          setOutcomeMessage(phase.message);
          return;
        }

        const data = phase.data;
        const trace = isBtyE2eStep6TraceEnabled();
        if (trace) {
          console.log(
            "[BTY_E2E_STEP6] submit-validation response body (client)",
            JSON.stringify({
              outcome: data.outcome,
              layer1_errors: data.layer1_errors,
              error: data.error,
            }),
          );
        }
        if (DEBUG_STEP7_TRANSITION || DEBUG_STEP6) {
          console.log("[EliteActionContractStep] submit-validation result", {
            outcome: data.outcome,
            runId,
            contractId: cid,
          });
        }
        if (data.outcome === "revise") {
          if (trace) {
            console.log("[BTY_E2E_STEP6] not advancing: outcome=revise (no onContractValidated)");
          }
          const errs = Array.isArray(data.layer1_errors) ? data.layer1_errors.map((e) => e.signal) : [];
          setFieldErrors(errs.length > 0 ? errs : [revisionRequired]);
          return;
        }
        if (data.outcome === "reject") {
          if (trace) {
            console.log("[BTY_E2E_STEP6] not advancing: outcome=reject (no onContractValidated)");
          }
          setOutcomeMessage(revisionRequired);
          return;
        }
        if (data.outcome === "approve" || data.outcome === "escalate") {
          // Clear contract submit busy *before* parent advances to Step 7 (execution-gate polling).
          submitInFlightRef.current = false;
          setContractBusy(false, `validation outcome=${String(data.outcome)} (before onContractValidated microtask)`);
          queueMicrotask(() => {
            if (trace) {
              console.log("[BTY_E2E_STEP6] microtask: calling onContractValidated()", {
                runId,
                contractId: cid,
                outcome: data.outcome,
              });
            }
            if (DEBUG_STEP6 || DEBUG_STEP7_TRANSITION) {
              console.log("[EliteActionContractStep] onContractValidated (microtask)", { runId, contractId: cid });
            }
            try {
              onValidatedRef.current();
            } finally {
              if (trace) {
                console.log("[BTY_E2E_STEP6] onContractValidated() returned (sync)");
              }
            }
          });
          return;
        }
        if (trace) {
          console.log(
            "[BTY_E2E_STEP6] not advancing: unknown outcome (no onContractValidated)",
            String(data.outcome),
          );
        }
        setOutcomeMessage(loadError);
        return;
      }
    } catch {
      setOutcomeMessage(loadError);
    } finally {
      submitInFlightRef.current = false;
      setContractBusy(false, "onSubmit:finally");
    }
  }, [
    contractId,
    who,
    what,
    how,
    when,
    loadError,
    revisionRequired,
    ensureFailed,
    createContract,
    setContractBusy,
  ]);

  if (ensuring) {
    return (
      <div
        data-testid="elite-action-contract-loading"
        className="mt-4 space-y-3"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-sm text-bty-navy/85">{creatingContractLabel}</p>
        <CardSkeleton showLabel={false} lines={3} style={{ padding: "16px 20px" }} />
      </div>
    );
  }

  if (patternThresholdGate) {
    return (
      <div
        data-testid="elite-action-contract-pattern-threshold-continue"
        className="mt-4 space-y-3 rounded-xl border border-bty-border/80 bg-bty-soft/20 px-4 py-3"
        role="region"
        aria-labelledby="elite-action-contract-pattern-threshold-heading"
      >
        <h3 id="elite-action-contract-pattern-threshold-heading" className="text-base font-semibold text-bty-navy">
          {patternThresholdTitle}
        </h3>
        <p className="text-sm leading-relaxed text-bty-navy/90">{patternThresholdBody}</p>
        <button
          type="button"
          data-testid="elite-action-contract-pattern-threshold-continue-button"
          onClick={() => onPatternThresholdContinue()}
          className="rounded-xl border border-bty-navy bg-bty-navy px-4 py-2.5 text-sm font-medium text-white"
        >
          {patternThresholdContinueLabel}
        </button>
      </div>
    );
  }

  if (!contractId) {
    const failureMessage = outcomeMessage ?? loadError;
    return (
      <div
        data-testid="elite-action-contract-init-error"
        className="mt-4 rounded-xl border border-bty-border/80 bg-bty-soft/30 px-4 py-3"
        role="alert"
        aria-labelledby="elite-action-contract-init-error-heading"
      >
        <h3 id="elite-action-contract-init-error-heading" className="text-base font-semibold text-bty-navy">
          {initFailedTitle}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-bty-navy/90">{failureMessage}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="elite-action-contract"
      className="mt-4 space-y-4 border-t border-bty-border/60 pt-4"
      role="region"
      aria-label={title}
    >
      <h3 className="text-base font-semibold text-bty-navy">{title}</h3>
      <p className="text-sm leading-relaxed opacity-90">{intro}</p>

      <div className="space-y-3">
        <label className="block text-xs font-medium opacity-85">
          {labels.who}
          <p className="mt-1 text-xs font-normal leading-snug opacity-80">{labels.whoHint}</p>
          <textarea
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder={placeholders.who}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-bty-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium opacity-85">
          {labels.what}
          <p className="mt-1 text-xs font-normal leading-snug opacity-80">{labels.whatHint}</p>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder={placeholders.what}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-bty-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium opacity-85">
          {labels.when}
          <p className="mt-1 text-xs font-normal leading-snug opacity-80">{labels.whenHint}</p>
          <textarea
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder={placeholders.when}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-bty-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium opacity-85">
          {labels.how}
          <p className="mt-1 text-xs font-normal leading-snug opacity-80">{labels.howInstruction}</p>
          <p className="mt-1 text-xs font-normal leading-snug opacity-80">{labels.howResponsibilityLead}</p>
          <textarea
            value={how}
            onChange={(e) => setHow(e.target.value)}
            placeholder={placeholders.how}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-bty-border px-3 py-2 text-sm"
          />
        </label>
      </div>

      {fieldErrors.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-bty-navy/90" role="alert">
          {fieldErrors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : null}

      {outcomeMessage ? (
        <p className="text-sm text-bty-navy/90" role="status">
          {outcomeMessage}
        </p>
      ) : null}

      <button
        ref={submitButtonRef}
        type="button"
        data-testid="elite-action-contract-submit"
        onClick={() => void onSubmit()}
        disabled={!contractId || isSubmittingContract}
        aria-busy={isSubmittingContract ? "true" : "false"}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-bty-navy bg-bty-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmittingContract ? (
          <>
            <span
              className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden
            />
            <span>{submittingLabel}</span>
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
