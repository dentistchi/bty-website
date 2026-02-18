"use client";

import { useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { getTrainDay } from "@/lib/trainContent";
import { getLocaleFromPathname } from "@/lib/locale";
import { t } from "@/lib/i18n/train";
import { SECTION_KEY_MAP } from "@/lib/trainSectionMap";
import { extractChecklist } from "@/lib/extractChecklist";
import { useTrainLayout } from "@/contexts/TrainLayoutContext";
import ActionChecklist from "@/components/train/ActionChecklist";
import FocusTimer from "@/components/train/FocusTimer";
import ReflectionBox from "@/components/train/ReflectionBox";

/** 오늘의 1개 실천: 핵심 실천 첫 줄 또는 요약 */
function todayOnePractice(dayData: { sections?: Record<string, string> }) {
  const core = dayData.sections?.["핵심 실천"] ?? "";
  const firstLine = core.split(/\n/)[0]?.trim() ?? "";
  return firstLine || "오늘의 핵심 실천을 레슨에서 확인하세요.";
}

export default function TrainDayPage() {
  const params = useParams<{ day: string }>();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const layout = useTrainLayout();

  const [toast, setToast] = useState<string | null>(null);

  const dayNum = Number(params.day);
  const dayData = useMemo(() => getTrainDay(dayNum), [dayNum]);

  async function markComplete(day: number) {
    setToast(null);
    const r = await fetch("/api/train/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ day }),
    }).then((x) => x.json());

    if (!r?.ok) {
      setToast(r?.error ?? "Failed");
      return;
    }
    await layout?.refreshProgress();
    layout?.onMarkCompleteSuccess();
  }

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
                onClick={() => markComplete(dayNum)}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-black text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {t(locale, "markComplete")}
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
