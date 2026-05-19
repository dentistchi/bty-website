"use client";

import React from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Action Contract validation screen (MVP-FIX-ACTION-01, Path B / scope A).
 *
 * Canonical: an action is NOT complete at QR commit/submission — it requires
 * execution + validation/approval. This minimal 3-field screen (who / what /
 * result) is the production wiring for `POST /api/bty/action-contract/submit-validation`,
 * which runs Layer 1 + Layer 2 and sets `validation_approved_at`.
 *
 * Field mapping (UI adapter; submit-validation route unchanged):
 *   who    → who
 *   what   → what
 *   result → how
 *   when   → "today" (auto)            raw_text → "who / what / result" (composed)
 *
 * `revise` outcome is mandatory to handle — Layer 1/2 failures are shown and the
 * user re-edits and resubmits. Only `approve` advances to the QR gate.
 */

/** Mirrors Layer1Error in src/lib/bty/validator/types. */
type Layer1Error = { rule: string; signal: string };

type SubmitOutcome = "approve" | "revise" | "reject" | "escalate";

type Banner = { kind: "revise" | "info" | "error"; text: string } | null;

export type ArenaActionValidationFormProps = {
  locale: Locale | string;
  /** `bty_action_contracts.id` — from the blocking contract payload. */
  contractId: string;
  /** Called once submit-validation returns outcome "approve". */
  onApproved: () => void;
};

const COPY = {
  en: {
    title: "Validate your action",
    lead: "An action is not complete at submission. Describe what you actually did — it is checked before the run is verified.",
    whoLabel: "Who",
    whoHint: "One specific person — a name or initials, not a group.",
    whatLabel: "What",
    whatHint: "The situation you acted on — a full sentence.",
    resultLabel: "Result",
    resultHint: "What you actually did or said, and the outcome.",
    submit: "Submit for validation",
    submitting: "Validating…",
    fillAll: "Fill in all three fields before submitting.",
    reviseHeading: "Revise and resubmit:",
    rejectMsg: "This action statement was not accepted. Revise the three fields and submit again.",
    escalateMsg: "This action was sent for review. You can revise and resubmit, or check back later.",
    errorMsg: "Validation could not be completed. Please try again.",
  },
  ko: {
    title: "행동 검증",
    lead: "행동은 제출만으로 완료되지 않습니다. 실제로 한 일을 적어 주세요 — 런이 검증되기 전에 확인됩니다.",
    whoLabel: "대상 (Who)",
    whoHint: "특정 한 사람 — 그룹이 아닌 이름이나 이니셜.",
    whatLabel: "상황 (What)",
    whatHint: "행동한 상황을 한 문장으로.",
    resultLabel: "결과 (Result)",
    resultHint: "실제로 하거나 말한 것과 그 결과.",
    submit: "검증 제출",
    submitting: "검증 중…",
    fillAll: "제출 전에 세 칸을 모두 채워 주세요.",
    reviseHeading: "수정 후 다시 제출해 주세요:",
    rejectMsg: "이 행동 진술은 승인되지 않았습니다. 세 칸을 수정해 다시 제출해 주세요.",
    escalateMsg: "이 행동은 검토로 넘어갔습니다. 수정해 다시 제출하거나 나중에 다시 확인해 주세요.",
    errorMsg: "검증을 완료하지 못했습니다. 다시 시도해 주세요.",
  },
} as const;

export function ArenaActionValidationForm({
  locale,
  contractId,
  onApproved,
}: ArenaActionValidationFormProps) {
  const lang: "ko" | "en" = locale === "ko" ? "ko" : "en";
  const c = COPY[lang];

  const [who, setWho] = React.useState("");
  const [what, setWhat] = React.useState("");
  const [result, setResult] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [layer1Errors, setLayer1Errors] = React.useState<Layer1Error[]>([]);
  const [banner, setBanner] = React.useState<Banner>(null);

  const handleSubmit = React.useCallback(async () => {
    const w = who.trim();
    const x = what.trim();
    const r = result.trim();
    if (!w || !x || !r) {
      setLayer1Errors([]);
      setBanner({ kind: "error", text: c.fillAll });
      return;
    }

    setSubmitting(true);
    setLayer1Errors([]);
    setBanner(null);
    try {
      const res = await fetch("/api/bty/action-contract/submit-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          who: w,
          what: x,
          how: r,
          when: "today",
          raw_text: `${w} / ${x} / ${r}`,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        outcome?: SubmitOutcome;
        layer1_errors?: Layer1Error[];
        error?: string;
      } | null;

      if (!res.ok || !data) {
        setBanner({ kind: "error", text: c.errorMsg });
        return;
      }
      if (data.outcome === "approve") {
        onApproved();
        return;
      }
      if (data.outcome === "revise") {
        setLayer1Errors(Array.isArray(data.layer1_errors) ? data.layer1_errors : []);
        setBanner({ kind: "revise", text: c.reviseHeading });
        return;
      }
      if (data.outcome === "reject") {
        setBanner({ kind: "revise", text: c.rejectMsg });
        return;
      }
      if (data.outcome === "escalate") {
        setBanner({ kind: "info", text: c.escalateMsg });
        return;
      }
      setBanner({ kind: "error", text: c.errorMsg });
    } catch {
      setBanner({ kind: "error", text: c.errorMsg });
    } finally {
      setSubmitting(false);
    }
  }, [who, what, result, contractId, onApproved, c]);

  const bannerClass =
    banner?.kind === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : banner?.kind === "info"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div
      data-testid="arena-action-validation-form"
      role="region"
      aria-label={c.title}
      className="mt-[18px] rounded-2xl border border-bty-border bg-bty-surface/95 p-4 shadow-sm"
    >
      <h2 className="m-0 mb-2 text-lg font-semibold text-bty-navy">{c.title}</h2>
      <p
        className="m-0 mb-4 text-sm leading-relaxed"
        style={{ color: "var(--arena-text-soft, #475569)" }}
      >
        {c.lead}
      </p>

      {banner ? (
        <div
          data-testid="arena-action-validation-banner"
          role="alert"
          className={`m-0 mb-3 rounded-lg border px-3 py-2 text-sm ${bannerClass}`}
        >
          <p className="m-0">{banner.text}</p>
          {layer1Errors.length > 0 ? (
            <ul className="m-0 mt-1 list-disc pl-5">
              {layer1Errors.map((e, i) => (
                <li key={`${e.rule}-${i}`}>{e.signal}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-bty-navy">{c.whoLabel}</span>
          <input
            data-testid="arena-action-validation-who"
            type="text"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-lg border border-bty-border bg-white px-3 py-2 text-sm text-bty-navy disabled:opacity-60"
          />
          <span className="mt-1 block text-xs text-bty-navy/60">{c.whoHint}</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-bty-navy">{c.whatLabel}</span>
          <textarea
            data-testid="arena-action-validation-what"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            disabled={submitting}
            rows={2}
            className="mt-1 w-full rounded-lg border border-bty-border bg-white px-3 py-2 text-sm text-bty-navy disabled:opacity-60"
          />
          <span className="mt-1 block text-xs text-bty-navy/60">{c.whatHint}</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-bty-navy">{c.resultLabel}</span>
          <textarea
            data-testid="arena-action-validation-result"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            disabled={submitting}
            rows={3}
            className="mt-1 w-full rounded-lg border border-bty-border bg-white px-3 py-2 text-sm text-bty-navy disabled:opacity-60"
          />
          <span className="mt-1 block text-xs text-bty-navy/60">{c.resultHint}</span>
        </label>
      </div>

      <div className="mt-4">
        <button
          type="button"
          data-testid="arena-action-validation-submit"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="rounded-xl border border-bty-navy bg-bty-navy px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? c.submitting : c.submit}
        </button>
      </div>
    </div>
  );
}
