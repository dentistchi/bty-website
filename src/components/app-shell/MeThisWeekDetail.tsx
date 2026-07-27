"use client";

import { useEffect, useState } from "react";
import type { WeeklyActivityDetail } from "@/lib/bty/daily/weeklyActivity.server";

/**
 * MeThisWeekDetail (Slice 3.2C-B3A.2D-R1) — the nested This Week surface opened by a SHORT TAP on
 * the Me Orb. Header "‹ Me" + "THIS WEEK", then the exact 7-BTY-day window and the canonical
 * disclosure from GET /api/me/today/weekly-activity?detail=1 (the SAME read-only endpoint — no
 * second weekly route). Fail-soft per category: an omitted (undefined) category is hidden; an
 * empty list under a present count is a proven canonical zero. Privacy: Center reflections show
 * DATES only — the reflection body is never fetched or rendered here.
 */

const COPY = {
  en: {
    back: "‹ Me",
    title: "This week",
    window: "Last 7 days",
    points: "Weekly points",
    activeDays: "Active days",
    attendance: "Attendance",
    learning: "Learning completed",
    training: "Training created",
    center: "Center reflections",
    actions: "Action plans completed",
    activity: "Activity recorded",
    noActivity: "No activity recorded",
    reflection: "Reflection",
    none: "—",
    loading: "Loading…",
    quiet: "A quiet week so far.",
  },
  ko: {
    back: "‹ 나",
    title: "이번 주",
    window: "지난 7일",
    points: "주간 포인트",
    activeDays: "활동일",
    attendance: "출석",
    learning: "완료한 학습",
    training: "생성한 교육",
    center: "센터 성찰",
    actions: "완료한 행동 계획",
    activity: "활동 기록됨",
    noActivity: "활동 없음",
    reflection: "성찰",
    none: "—",
    loading: "불러오는 중…",
    quiet: "아직 조용한 한 주입니다.",
  },
};

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
function fmtDate(iso: string, loc: string): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
function fmtWeekday(iso: string, loc: string): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { weekday: "short" });
  } catch {
    return "";
  }
}

export default function MeThisWeekDetail({
  locale,
  onBack,
  refreshKey,
}: {
  locale: string;
  onBack: () => void;
  refreshKey?: number;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [detail, setDetail] = useState<WeeklyActivityDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      try {
        const tz = deviceTz();
        const res = await fetch(`/api/me/today/weekly-activity?detail=1${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as WeeklyActivityDetail;
          if (!cancelled) setDetail(d);
        }
      } catch {
        /* fail-soft → the header + whatever loaded still render */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const s = detail?.summary ?? {};
  const attendance = detail?.attendance;

  const Section = ({ label, count, children }: { label: string; count?: number; children?: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</span>
        {typeof count === "number" ? <span className="text-sm font-semibold text-white/80">{count}</span> : null}
      </div>
      {children}
    </div>
  );

  return (
    <section className="flex flex-col gap-4" data-testid="me-this-week-detail">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="me-this-week-back"
          onClick={onBack}
          className="self-start text-xs font-medium text-white/55 hover:text-white/85"
        >
          {t.back}
        </button>
      </div>
      <h1 className="text-lg font-semibold tracking-tight text-white">{t.title}</h1>
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{t.window}</p>

      {!loaded ? (
        <p className="text-sm text-white/40" role="status">{t.loading}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Weekly points — canonical weekly balance only (no hidden leadership scores/formulas). */}
          {typeof s.weeklyPoints === "number" ? (
            <Section label={t.points} count={s.weeklyPoints} />
          ) : null}

          {/* Attendance — 7 dated circles; tapping a day discloses date + recorded/not. */}
          {attendance && attendance.length > 0 ? (
            <Section label={t.attendance} count={typeof s.activeDays === "number" ? s.activeDays : undefined}>
              <div className="flex items-center justify-between gap-1 pt-1" data-testid="me-week-attendance">
                {attendance.map((d, i) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setOpenDay(openDay === i ? null : i)}
                    className="flex flex-col items-center gap-1"
                    aria-label={`${fmtDate(d.date, loc)} — ${d.active ? t.activity : t.noActivity}`}
                  >
                    <span className="text-[0.6rem] text-white/35">{fmtWeekday(d.date, loc)}</span>
                    <span className={`h-3.5 w-3.5 rounded-full ${d.active ? "bg-[#E5B769]" : "border border-white/15 bg-transparent"}`} />
                  </button>
                ))}
              </div>
              {openDay != null && attendance[openDay] ? (
                <p className="pt-1 text-[0.8rem] text-white/65" data-testid="me-week-day-detail">
                  {fmtDate(attendance[openDay].date, loc)} · {attendance[openDay].active ? t.activity : t.noActivity}
                </p>
              ) : null}
            </Section>
          ) : null}

          {detail?.learningCompleted ? (
            <Section label={t.learning} count={detail.learningCompleted.length}>
              {detail.learningCompleted.map((it, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[0.82rem]">
                  <span className="truncate text-white/75">{it.title}</span>
                  <span className="shrink-0 text-white/40">{fmtDate(it.date, loc)}</span>
                </div>
              ))}
            </Section>
          ) : null}

          {detail?.trainingCreated ? (
            <Section label={t.training} count={detail.trainingCreated.length}>
              {detail.trainingCreated.map((it, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[0.82rem]">
                  <span className="truncate text-white/75">{it.title}</span>
                  <span className="shrink-0 text-white/40">{fmtDate(it.date, loc)}</span>
                </div>
              ))}
            </Section>
          ) : null}

          {detail?.centerReflections ? (
            <Section label={t.center} count={detail.centerReflections.length}>
              {/* DATE ONLY — reflection bodies are never fetched or shown here (privacy invariant). */}
              {detail.centerReflections.map((it, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[0.82rem]">
                  <span className="text-white/55">{t.reflection}</span>
                  <span className="shrink-0 text-white/40">{fmtDate(it.date, loc)}</span>
                </div>
              ))}
            </Section>
          ) : null}

          {detail?.actionPlansCompleted ? (
            <Section label={t.actions} count={detail.actionPlansCompleted.length}>
              {detail.actionPlansCompleted.map((it, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[0.82rem]">
                  <span className="truncate text-white/75">{it.title}</span>
                  <span className="shrink-0 text-white/40">{fmtDate(it.date, loc)}</span>
                </div>
              ))}
            </Section>
          ) : null}
        </div>
      )}
    </section>
  );
}
