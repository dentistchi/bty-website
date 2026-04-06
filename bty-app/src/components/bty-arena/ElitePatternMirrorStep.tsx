"use client";

import React from "react";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { CardSkeleton } from "./CardSkeleton";

export type ElitePatternMirrorStepProps = {
  locale: "ko" | "en";
  runId: string | null;
  /** UX_FLOW_LOCK_V1 Step 5 — permitted control label */
  title: string;
  lead: string;
  emptyMirror: string;
  continueLabel: string;
  loadError: string;
  onAcknowledged: () => void;
};

/**
 * Step 5 — Pattern Mirror: display-only prior-run signals; single Continue; no auto-advance.
 */
export function ElitePatternMirrorStep({
  locale,
  runId,
  title,
  lead,
  emptyMirror,
  continueLabel,
  loadError,
  onAcknowledged,
}: ElitePatternMirrorStepProps) {
  const [narrative, setNarrative] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const url = runId
      ? `/api/arena/run/pattern-mirror-narrative?runId=${encodeURIComponent(runId)}`
      : null;
    if (!url) {
      setNarrative("");
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    fetch(url, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          patternNarrative?: string;
          error?: string;
        };
        if (!alive) return;
        if (!r.ok || !j.ok) {
          setError(j.error ?? loadError);
          setNarrative("");
          return;
        }
        setNarrative(typeof j.patternNarrative === "string" ? j.patternNarrative : "");
      })
      .catch(() => {
        if (!alive) return;
        setError(loadError);
        setNarrative("");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadError, runId]);

  const onContinue = React.useCallback(async () => {
    if (!runId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await arenaFetch<{ ok?: boolean; error?: string }>("/api/arena/run/step5-acknowledge", {
        json: { runId },
      });
      onAcknowledged();
    } catch (e) {
      setError(e instanceof Error ? e.message : loadError);
    } finally {
      setSubmitting(false);
    }
  }, [runId, submitting, onAcknowledged, loadError]);

  return (
    <div
      data-testid="elite-pattern-mirror"
      className="mt-4 space-y-4 border-t border-bty-border/60 pt-4"
      role="region"
      aria-label={title}
    >
      <h3 className="text-base font-semibold text-bty-navy">{title}</h3>
      <p className="text-sm leading-relaxed opacity-90">{lead}</p>

      {loading ? (
        <CardSkeleton showLabel={false} lines={4} style={{ padding: "16px 20px" }} />
      ) : (
        <div
          className="rounded-xl border border-bty-border/80 bg-bty-soft/30 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: "var(--arena-text-soft, inherit)" }}
        >
          {narrative && narrative.trim().length > 0 ? narrative : emptyMirror}
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void onContinue()}
        disabled={!runId || loading || submitting}
        aria-busy={submitting}
        className="rounded-xl border border-bty-navy bg-bty-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {continueLabel}
      </button>
      {!runId && !loading ? (
        <p className="text-xs opacity-75" role="status">
          {locale === "ko" ? "세션 기록이 없어 계속할 수 없습니다." : "No session record; cannot continue."}
        </p>
      ) : null}
    </div>
  );
}
