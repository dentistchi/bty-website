"use client";

/** Completion is already durable. These states never claim an award or repeat the learning. */
export function CompletionXpRecovery({ status, locale, busy, failed, onRetry }: {
  status: "unavailable" | "review_required";
  locale: "en" | "ko";
  busy: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const copy = locale === "ko" ? {
    pending: "훈련 완료 기록은 저장됐습니다. XP 지급은 확인되지 않았습니다.",
    review: "훈련 완료 기록은 저장됐습니다. XP 지급 여부는 검토가 필요합니다.",
    retry: "XP 다시 확인", saving: "확인 중…", failed: "XP 지급을 아직 확인하지 못했습니다. 다시 시도해 주세요.",
  } : {
    pending: "Your training is complete and saved. XP has not been confirmed.",
    review: "Your training is complete and saved. This XP claim needs review before it can be confirmed.",
    retry: "Try XP again", saving: "Checking…", failed: "XP still could not be confirmed. Please try again.",
  };
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/20 bg-white/[0.04] p-4" data-testid="completion-xp-recovery" aria-live="polite">
      <p className="text-sm leading-6 text-white/85">{status === "review_required" ? copy.review : copy.pending}</p>
      {status === "unavailable" ? <>
        {failed ? <p role="alert" className="text-sm leading-6 text-white/80">{copy.failed}</p> : null}
        <button type="button" data-testid="completion-xp-retry" onClick={onRetry} disabled={busy}
          className="min-h-11 rounded-xl border border-[#C9A66B]/60 px-4 py-3 font-semibold text-[#E5B769] disabled:opacity-60">
          {busy ? copy.saving : copy.retry}
        </button>
      </> : null}
    </section>
  );
}
