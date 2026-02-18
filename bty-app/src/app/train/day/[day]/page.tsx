"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { getTrainDay } from "@/lib/trainContent";
import { getLocaleFromPathname } from "@/lib/locale";
import { t } from "@/lib/i18n/train";
import { SECTION_KEY_MAP } from "@/lib/trainSectionMap";
import { extractChecklist } from "@/lib/extractChecklist";
import { useAuth } from "@/contexts/AuthContext";
import { useTrainUI } from "@/contexts/TrainUIContext";
import { safeJson } from "@/lib/utils";
import ActionChecklist from "@/components/train/ActionChecklist";
import FocusTimer from "@/components/train/FocusTimer";
import ReflectionBox from "@/components/train/ReflectionBox";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
  unlockedMaxDay: number;
};

/** 오늘의 1개 실천: 핵심 실천 첫 줄 또는 요약 */
function todayOnePractice(dayData: { sections?: Record<string, string> }) {
  const core = dayData.sections?.["핵심 실천"] ?? "";
  const firstLine = core.split(/\n/)[0]?.trim() ?? "";
  return firstLine || "오늘의 핵심 실천을 레슨에서 확인하세요.";
}

/** 더미 생성기(나중에 LLM로 교체) */
function buildDummyCompletionPayload(args: { day: number; title: string; lessonText: string }) {
  return {
    day: args.day,
    title: args.title,
    summary: [
      `You completed Day ${args.day}.`,
      "You practiced showing up without self-judgment.",
      "You chose consistency over perfection.",
    ],
    questions: [
      "What was the hardest moment today—and what did you do instead of criticizing yourself?",
      "If a friend had the same day, what would you say to them (one sentence)?",
      "What is your smallest 60-second version of this practice for tomorrow?",
    ],
  };
}

export default function TrainDayPage() {
  const params = useParams<{ day: string }>();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const { user, loading } = useAuth();
  const { openCompletionPanel } = useTrainUI();

  const [progress, setProgress] = useState<Progress | null>(null);
  const [pLoading, setPLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const dayNum = Number(params.day ?? "1");
  const dayData = useMemo(() => getTrainDay(dayNum), [dayNum]);

  const refreshProgress = useCallback(async () => {
    setPLoading(true);
    try {
      const j = await safeJson("/api/train/progress");
      if (j?.ok && j?.hasSession) {
        setProgress({
          startDateISO: j.startDateISO,
          lastCompletedDay: j.lastCompletedDay ?? 0,
          lastCompletedAt: j.lastCompletedAt ?? null,
          unlockedMaxDay: j.unlockedMaxDay ?? 1,
        });
      } else {
        setProgress(null);
      }
    } catch {
      setProgress(null);
    } finally {
      setPLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setPLoading(false);
      setProgress(null);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const j = await safeJson("/api/train/progress");
        if (!alive) return;

        if (j?.ok && j?.hasSession) {
          setProgress({
            startDateISO: j.startDateISO,
            lastCompletedDay: j.lastCompletedDay ?? 0,
            lastCompletedAt: j.lastCompletedAt ?? null,
            unlockedMaxDay: j.unlockedMaxDay ?? 1,
          });
        } else {
          setProgress(null);
        }
      } catch {
        if (!alive) return;
        setProgress(null);
      } finally {
        if (!alive) return;
        setPLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  const isLocked = useMemo(() => {
    if (!progress) return true;
    return dayNum > progress.unlockedMaxDay;
  }, [dayNum, progress]);

  const markComplete = useCallback(async () => {
    if (isLocked) return;

    setToast(null);
    try {
      const r = await fetch("/api/train/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: dayNum }),
        cache: "no-store",
      });

      const ct = r.headers.get("content-type") || "";
      const text = await r.text();
      const j = ct.includes("application/json") ? JSON.parse(text) : { ok: false, error: text.slice(0, 120) };

      if (!r.ok || !j?.ok) {
        setToast(j?.error ?? "Failed");
        return;
      }

      await refreshProgress();

      if (dayData) {
        const payload = buildDummyCompletionPayload({
          day: dayNum,
          title: dayData.title,
          lessonText: dayData.raw ?? "",
        });
        openCompletionPanel(payload);
      }
    } catch (e) {
      setToast(String(e) ?? "Network error");
    }
  }, [dayNum, dayData, isLocked, openCompletionPanel, refreshProgress]);

  if (loading || pLoading) return <div className="p-6">loading...</div>;
  if (!user) return <div className="p-6">로그인이 필요합니다.</div>;
  if (!progress) return <div className="p-6">progress not ready</div>;
  if (!dayData) return <div className="p-8">Invalid day.</div>;

  // 한국어 키로 들어있는 섹션들을 "UI 목적 라벨 키"로 재구성
  const mapped = useMemo(() => {
    const out: Partial<Record<string, string>> = {};
    for (const [k, v] of Object.entries(dayData.sections || {})) {
      const kk = SECTION_KEY_MAP[k];
      if (kk) out[kk] = v;
    }
    return out;
  }, [dayData.sections]);

  const checklistItems = useMemo(() => extractChecklist(mapped.actions ?? ""), [mapped.actions]);
  const onePractice = useMemo(() => todayOnePractice(dayData), [dayData]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-2 text-xs text-gray-500">
        unlockedMaxDay: {progress.unlockedMaxDay} / lastCompletedDay: {progress.lastCompletedDay}
      </div>
      <div className="text-xs text-gray-500">{dayData.date}</div>
      <h1 className="text-2xl font-semibold mt-1">Day {dayData.day}</h1>
      <div className="text-sm text-gray-600 mt-2">{dayData.title}</div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* LEFT: Lesson cards */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-5">
            <div className="text-sm font-semibold">{t(locale, "lesson")}</div>
            <div className="mt-3 text-sm leading-7 whitespace-pre-wrap text-gray-700">
              {dayData.raw}
            </div>
          </div>

          {/* 오늘의 1개 실천 + Mark today as complete */}
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <div className="text-sm font-semibold">오늘의 1개 실천</div>
            <p className="text-sm text-gray-700">{onePractice}</p>
            <div>
              <button
                type="button"
                onClick={() => markComplete()}
                disabled={isLocked}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${isLocked ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800"}`}
              >
                {isLocked ? "Locked" : t(locale, "markComplete")}
              </button>
              {toast && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {toast}
                </p>
              )}
            </div>
          </div>

          <ActionChecklist
            day={dayNum}
            items={checklistItems}
            title={t(locale, "actions")}
          />

          {mapped.whyItWorks && (
            <div className="rounded-xl border bg-white p-5">
              <div className="text-sm font-semibold">{t(locale, "whyItWorks")}</div>
              <div className="mt-2 text-sm leading-7 whitespace-pre-wrap text-gray-700">
                {mapped.whyItWorks}
              </div>
            </div>
          )}

          {mapped.resistance && (
            <div className="rounded-xl border bg-white p-5">
              <div className="text-sm font-semibold">{t(locale, "resistance")}</div>
              <div className="mt-2 text-sm leading-7 whitespace-pre-wrap text-gray-700">
                {mapped.resistance}
              </div>
            </div>
          )}

          {mapped.breakthrough && (
            <div className="rounded-xl border bg-white p-5">
              <div className="text-sm font-semibold">{t(locale, "breakthrough")}</div>
              <div className="mt-2 text-sm leading-7 whitespace-pre-wrap text-gray-700">
                {mapped.breakthrough}
              </div>
            </div>
          )}

          <ReflectionBox
            day={dayNum}
            title={t(locale, "reflectionTitle")}
            placeholder={t(locale, "reflectionPlaceholder")}
            saveLabel={t(locale, "saveDraft")}
          />
        </div>

        {/* RIGHT: Focus tools */}
        <div className="space-y-6">
          <FocusTimer
            minutes={10}
            labels={{
              start: t(locale, "startFocus"),
              stop: t(locale, "stop"),
              reset: t(locale, "reset"),
            }}
          />

          {mapped.questions && (
            <div className="rounded-xl border bg-white p-5">
              <div className="text-sm font-semibold">{t(locale, "questions")}</div>
              <div className="mt-2 text-sm leading-7 whitespace-pre-wrap text-gray-700">
                {mapped.questions}
              </div>
            </div>
          )}

          {mapped.evening && (
            <div className="rounded-xl border bg-white p-5">
              <div className="text-sm font-semibold">{t(locale, "evening")}</div>
              <div className="mt-2 text-sm leading-7 whitespace-pre-wrap text-gray-700">
                {mapped.evening}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
