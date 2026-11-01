"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { ThemeBody } from "@/components/ThemeBody";
import { CardSkeleton, LoadingFallback } from "@/components/bty-arena";
import { AwakeningActsTrack } from "@/components/bty/healing/AwakeningActsTrack";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SecondAwakeningRitual = {
  act1: {
    name: string;
    sessionCount: number;
    repairLoopCount: number;
    oFnRCount: number;
    coreHighlight: { statId: string; name: string; value: number }[];
    patternNote: string;
  };
  act2: {
    name: string;
    identityStatement: string;
    phaseIiIntro: string;
  };
  act3: {
    name: string;
    unlockGranted: "PRM" | "SAG" | null;
    unlockLabel: string;
  };
};

type SecondAwakeningRes = {
  eligible: boolean;
  completed: boolean;
  userDay: number;
  sessionCount: number;
  ritual?: SecondAwakeningRitual;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
function isRitual(value: unknown): value is SecondAwakeningRitual {
  if (!isRecord(value) || !isRecord(value.act1) || !isRecord(value.act2) || !isRecord(value.act3)) return false;
  const { act1, act2, act3 } = value;
  return isText(act1.name) && isCount(act1.sessionCount) && isCount(act1.repairLoopCount) && isCount(act1.oFnRCount)
    && isText(act1.patternNote) && Array.isArray(act1.coreHighlight) && act1.coreHighlight.every(item =>
      isRecord(item) && isText(item.statId) && isText(item.name) && typeof item.value === "number" && Number.isFinite(item.value))
    && isText(act2.name) && isText(act2.identityStatement) && isText(act2.phaseIiIntro)
    && isText(act3.name) && isText(act3.unlockLabel) && [null, "PRM", "SAG"].includes(act3.unlockGranted as string | null);
}
function isAwakening(value: unknown): value is SecondAwakeningRes {
  return isRecord(value) && typeof value.eligible === "boolean" && typeof value.completed === "boolean"
    && isCount(value.userDay) && isCount(value.sessionCount)
    && ((!value.eligible || value.completed) || isRitual(value.ritual));
}
function isCompletion(value: unknown): boolean {
  return isRecord(value) && value.ok === true && typeof value.idempotent === "boolean"
    && (value.starterUnlockGranted === undefined || value.starterUnlockGranted === "PRM" || value.starterUnlockGranted === "SAG");
}

export default function SecondAwakeningPageClient() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const tHealing = getMessages(locale === "ko" ? "ko" : "en").healing;
  const router = useRouter();
  const [data, setData] = useState<SecondAwakeningRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRevision = useRef(0);
  const submittingRef = useRef(false);
  const readError = locale === "ko"
    ? "2차 각성 정보를 불러오지 못했어요. 다시 시도해 주세요."
    : "Could not load Second Awakening. Please try again.";
  const writeError = locale === "ko"
    ? "완료 상태를 확인하지 못했어요. 진행 내용은 그대로 남아 있습니다. 다시 시도해 주세요."
    : "Could not confirm your completion. Your ritual is still here. Please try again.";
  const reviewError = locale === "ko"
    ? "이 완료 기록은 확인을 위한 검토가 필요합니다. 진행 내용은 그대로 남아 있습니다."
    : "This completion needs review before it can be confirmed. Your ritual is still here.";
  const retry = locale === "ko" ? "다시 시도" : "Retry";

  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/emotional-stats/second-awakening", { credentials: "include" });
      if (!response.ok) throw new Error("READ_FAILED");
      const body: unknown = await response.json();
      if (!isAwakening(body)) throw new Error("READ_INVALID");
      if (revision === loadRevision.current) setData(body);
    } catch {
      if (revision === loadRevision.current) { setData(null); setError(readError); }
    } finally {
      if (revision === loadRevision.current) setLoading(false);
    }
  }, [readError]);
  useEffect(() => {
    void load();
    return () => { loadRevision.current += 1; };
  }, [load]);

  const handleEnterNextPhase = async () => {
    if (!data?.eligible || data.completed || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/emotional-stats/second-awakening/complete", { method: "POST", credentials: "include" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isCompletion(body)) {
        setError(response.status === 409 && isRecord(body) && body.code === "HEALING_COMPLETION_REVIEW_REQUIRED" ? reviewError : writeError);
        return;
      }
      setData(prev => prev ? { ...prev, completed: true } : prev);
      router.refresh();
    } catch {
      setError(writeError);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading && !error) {
    const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white flex items-center justify-center" aria-busy="true" aria-label={tHealing.awakeningLoadingLabel} aria-live="polite">
          <LoadingFallback icon="⏳" message={tLoading.message} withSkeleton />
        </main>
      </AuthGate>
    );
  }

  if (error && !data) {
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white flex flex-col items-center justify-center px-4" aria-label={tHealing.awakeningMainRegionAriaError}>
          <div className="flex flex-col items-center" role="region" aria-label={locale === "ko" ? "오류 안내 및 복귀" : "Error message and return"}>
            <p className="text-foundry-ink-soft text-center mb-4" role="alert">{error}</p>
            <button type="button" onClick={() => void load()} className="mb-3 rounded-xl bg-foundry-purple px-6 py-3 font-medium text-white">{retry}</button>
            <Link href={locale === "ko" ? "/ko/bty/healing" : "/en/bty/healing"} className="rounded-xl px-6 py-3 font-medium border border-foundry-purple-muted text-foundry-purple hover:bg-foundry-purple/10 transition-colors" aria-label={locale === "ko" ? "Healing으로 돌아가기" : "Back to Healing"}>
            {locale === "ko" ? "Healing으로" : "Back to Healing"}
          </Link>
          </div>
        </main>
      </AuthGate>
    );
  }

  if (!data) {
    const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white flex items-center justify-center" aria-busy="true" aria-label={tHealing.awakeningLoadingLabel}>
          <LoadingFallback icon="⏳" message={tLoading.message} withSkeleton />
        </main>
      </AuthGate>
    );
  }

  const basePath = locale === "ko" ? "/ko/bty" : "/en/bty";

  if (data.completed) {
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white" aria-label={tHealing.awakeningMainRegionAriaCompleted}>
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4" role="region" aria-label={locale === "ko" ? "완료 안내 및 다음 단계" : "Completion summary and next step"}>
              <h1 className="text-xl sm:text-2xl font-semibold text-foundry-purple-dark mb-3">
                {locale === "ko" ? "Phase II" : "Phase II"}
              </h1>
              <p className="text-foundry-ink-soft text-sm mb-8 max-w-sm">
                {locale === "ko"
                  ? "일반 루틴으로 돌아가며, 훈련은 더 정교해집니다."
                  : "Back to the usual routine—training grows more refined."}
              </p>
              <Link
                href={basePath}
                className={cn(
                  "rounded-xl px-6 py-3 font-medium text-white",
                  "bg-foundry-purple hover:bg-foundry-purple-dark transition-colors"
                )}
                aria-label={locale === "ko" ? "Foundry로 이동" : "Go to Foundry"}
              >
                {locale === "ko" ? "Foundry로" : "To Foundry"}
              </Link>
            </div>
          </div>
        </main>
      </AuthGate>
    );
  }

  if (!data.eligible) {
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white" aria-label={tHealing.awakeningMainRegionAriaEligibility}>
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4" role="region" aria-label={locale === "ko" ? "해금 조건 안내 및 현재 진행" : "Eligibility info and progress"}>
              <h1 className="text-xl sm:text-2xl font-semibold text-foundry-purple-dark mb-3">
                {locale === "ko" ? "Second Awakening" : "Second Awakening"}
              </h1>
              <p className="text-foundry-ink-soft text-sm mb-4">
                {locale === "ko"
                  ? "이 의식은 28일 훈련을 완주하면 열려요. 매일의 기록이 충분히 쌓이면, 다음 문이 자연스럽게 열립니다."
                  : "This ritual opens once you complete the 28-day training. As your daily records gather, the next door opens naturally."}
              </p>
              <Link
                href={`/${locale}/train/28days`}
                className={cn(
                  "rounded-xl px-6 py-3 font-medium text-white",
                  "bg-foundry-purple hover:bg-foundry-purple-dark transition-colors"
                )}
                aria-label={locale === "ko" ? "28일 훈련으로 가기" : "Go to the 28-day training"}
              >
                {locale === "ko" ? "28일 훈련으로 가기" : "Go to the 28-day training"}
              </Link>
            </div>
          </div>
        </main>
      </AuthGate>
    );
  }

  const ritual = data.ritual!;
  return (
    <AuthGate>
      <ThemeBody theme="foundry" />
      <main className="min-h-screen bg-foundry-white" aria-label={tHealing.awakeningMainRegionAriaRitual}>
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
          <AwakeningActsTrack locale={locale} />
          <header className="text-center mb-8" role="region" aria-label={locale === "ko" ? "의식 제목" : "Ritual title"}>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foundry-purple-dark">
              {locale === "ko" ? "Second Awakening" : "Second Awakening"}
            </h1>
            <p className="text-foundry-ink-soft mt-1 text-sm">
              {locale === "ko" ? "당신의 성장을 돌아보는 의식" : "A ritual to reflect on your growth."}
            </p>
          </header>

          <section className="space-y-8 flex-1" aria-label={tHealing.awakeningRitualActsRegionAria}>
            <section className="rounded-2xl border border-foundry-purple-muted bg-foundry-purple/5 p-5" role="region" aria-label={locale === "ko" ? "의식 1막" : "Act 1"}>
              <h2 className="text-sm font-semibold text-foundry-purple-dark mb-3">
                {ritual.act1.name}
              </h2>
              <ul className="text-sm text-foundry-ink space-y-1 mb-3" role="list" aria-label={locale === "ko" ? "1막 요약" : "Act 1 summary"}>
                <li>· {locale === "ko" ? "세션 수" : "Sessions"}: {ritual.act1.sessionCount}</li>
                <li>· {locale === "ko" ? "회복 루프 성공" : "Repair loop success"}: {ritual.act1.repairLoopCount}</li>
                <li>· O-F-N-R {locale === "ko" ? "완성" : "completed"}: {ritual.act1.oFnRCount}</li>
                {ritual.act1.coreHighlight.length > 0 && (
                  <li>
                    · {locale === "ko" ? "Core 성장 하이라이트" : "Core highlight"}:{" "}
                    {ritual.act1.coreHighlight.map((h) => `${h.name}`).join(", ")}
                  </li>
                )}
              </ul>
              <p className="text-xs text-foundry-ink-soft">{ritual.act1.patternNote}</p>
            </section>

            <section className="rounded-2xl border border-foundry-purple-muted bg-foundry-purple/5 p-5" role="region" aria-label={locale === "ko" ? "의식 2막" : "Act 2"}>
              <h2 className="text-sm font-semibold text-foundry-purple-dark mb-3">
                {ritual.act2.name}
              </h2>
              <p className="text-sm text-foundry-ink font-medium mb-2">
                {ritual.act2.identityStatement}
              </p>
              <p className="text-sm text-foundry-ink-soft">{ritual.act2.phaseIiIntro}</p>
            </section>

            <section className="rounded-2xl border border-foundry-purple-muted bg-foundry-purple/5 p-5" role="region" aria-label={locale === "ko" ? "의식 3막" : "Act 3"}>
              <h2 className="text-sm font-semibold text-foundry-purple-dark mb-3">
                {ritual.act3.name}
              </h2>
              <p className="text-sm text-foundry-ink mb-4">{ritual.act3.unlockLabel}</p>
              <button
                type="button"
                onClick={() => void handleEnterNextPhase()}
                disabled={submitting}
                aria-label={submitting ? (locale === "ko" ? "처리 중" : "Processing") : error ? retry : (locale === "ko" ? "다음 단계로" : "Enter next phase")}
                className={cn(
                  "rounded-xl px-6 py-3 font-medium text-white",
                  "bg-foundry-purple hover:bg-foundry-purple-dark transition-colors",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {submitting
                  ? (locale === "ko" ? "처리 중…" : "Processing…")
                  : error ? retry : "Enter Next Phase"}
              </button>
              {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
              {submitting && (
                <div className="mt-3" role="status" aria-busy="true" aria-label={locale === "ko" ? "다음 단계 처리 중" : "Processing next phase"}>
                  <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
                </div>
              )}
            </section>
          </section>

          <footer className="pt-6 mt-6 border-t border-foundry-purple-muted text-center text-sm" role="contentinfo" aria-label={locale === "ko" ? "푸터: Foundry 링크" : "Footer: link to Foundry"}>
            <Link href={basePath} className="text-foundry-purple hover:underline" aria-label={locale === "ko" ? "Foundry로 돌아가기" : "Back to Foundry"}>
              {locale === "ko" ? "Foundry로 돌아가기" : "Back to Foundry"}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
