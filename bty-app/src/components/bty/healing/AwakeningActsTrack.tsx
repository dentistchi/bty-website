"use client";

/**
 * Q4 Awakening: GET /api/bty/awakening + POST /api/bty/healing/progress — 표시·토스트만.
 * 순위/정렬 없음; completedActs는 API 응답만 반영.
 */
import React from "react";
import Link from "next/link";
import { clampHealingAwakeningActProgressDisplayPercent } from "@/domain/healing";
import { healingAwakeningActLockReasonDisplayKey, type AwakeningActId } from "@/domain/healing";
import {
  getMessages,
  healingAwakeningLockReasonCopy,
  healingPathProgressBlockedCopy,
} from "@/lib/i18n";
import { healingPathProgressBlockedUserDisplayKey } from "@/domain/healing";
import type { Locale } from "@/lib/i18n";

type AwakeningApi = {
  ok?: boolean;
  acts?: Record<string, string>;
  trigger?: { day?: number; requires_min_sessions?: number };
  completedActs?: number[];
};

const ACT_IDS = [1, 2, 3] as const;

const ACT_DESCRIPTIONS: Record<number, { ko: string; en: string }> = {
  1: {
    ko: "진단과 편지를 쓰며 쌓아온 자기 이해를 바탕으로, '나는 어떻게 변했는가?'를 조용히 돌아봅니다. 성찰의 공간에 머무세요.",
    en: "Drawing on the self-understanding you've built through your assessment and letter, quietly ask yourself: 'How have I changed?' Stay in this space of reflection.",
  },
  2: {
    ko: "변화를 인정합니다. 과거의 나와 지금의 나 사이에 다리를 놓고, 새로운 자신으로의 전환을 내면에서 선언합니다.",
    en: "Acknowledge the change. Build a bridge between who you were and who you are now, and declare this transition to yourself.",
  },
  3: {
    ko: "여정의 완성입니다. 깨어난 자신을 온전히 받아들이세요. 이 선언이 다음 장의 시작점이 됩니다.",
    en: "The journey is complete. Fully embrace your awakened self. This declaration becomes the starting point of your next chapter.",
  },
};

export function AwakeningActsTrack({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const th = getMessages(lang).healing;
  const [data, setData] = React.useState<AwakeningApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [pathBlockedHint, setPathBlockedHint] = React.useState<string | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setErr(null);
    fetch("/api/bty/awakening", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as AwakeningApi;
        if (!r.ok) {
          setErr(th.awakeningActsLoadError);
          setData(null);
        } else {
          setData(j);
        }
      })
      .catch(() => {
        setErr(th.awakeningActsLoadError);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [th.awakeningActsLoadError]);

  React.useEffect(() => {
    load();
  }, [load]);

  const completed = new Set(data?.completedActs ?? []);
  const doneCount = completed.size;
  const actProgressPct = clampHealingAwakeningActProgressDisplayPercent(
    (doneCount / ACT_IDS.length) * 100,
  );
  const nextAct = ACT_IDS.find((id) => !completed.has(id)) ?? null;
  const actsMap = data?.acts ?? {};
  const day = data?.trigger?.day ?? 30;
  const sessions = data?.trigger?.requires_min_sessions ?? 10;

  async function recordNext() {
    if (nextAct == null || posting) return;
    setPathBlockedHint(null);
    setPosting(true);
    try {
      const r = await fetch("/api/bty/healing/progress", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actId: nextAct }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        completedActs?: number[];
        error?: string;
      };
      if (r.status === 200 && body.ok && Array.isArray(body.completedActs)) {
        setPathBlockedHint(null);
        showToast(th.awakeningProgressToastOk);
        setData((prev) =>
          prev
            ? { ...prev, completedActs: body.completedActs as number[] }
            : prev
        );
      } else if (r.status === 409) {
        showToast(th.awakeningProgressToast409);
        load();
      } else if (r.status === 400) {
        const code = body.error;
        if (code === "ACT_PREREQUISITE") {
          const msg = healingPathProgressBlockedCopy(
            lang,
            healingPathProgressBlockedUserDisplayKey("phase_requirement_not_met"),
          );
          showToast(msg);
          setPathBlockedHint(msg);
        } else if (code === "COOLDOWN_ACTIVE") {
          const msg = healingPathProgressBlockedCopy(
            lang,
            healingPathProgressBlockedUserDisplayKey("cooldown_active"),
          );
          showToast(msg);
          setPathBlockedHint(msg);
        } else {
          showToast(th.awakeningProgressToast400);
        }
      } else {
        showToast(th.awakeningProgressToastNetwork);
      }
    } catch {
      showToast(th.awakeningProgressToastNetwork);
    } finally {
      setPosting(false);
    }
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-bty-border bg-bty-surface px-4 py-4"
      aria-labelledby="awakening-acts-track-heading"
      aria-label={th.awakeningActsTrackRegionAria}
    >
      <h2
        id="awakening-acts-track-heading"
        className="text-sm font-semibold text-bty-text"
      >
        {th.awakeningActsTrackTitle}
      </h2>
      <p className="mt-1 text-xs text-bty-secondary">
        {th.awakeningActsTriggerLine
          .replace("{day}", String(day))
          .replace("{sessions}", String(sessions))}
      </p>

      {loading && (
        <p className="mt-3 text-xs text-bty-muted" role="status">
          {th.loading}
        </p>
      )}
      {err && !loading && (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {err}
        </p>
      )}

      {!loading && !err && data?.ok && (
        <>
          <div
            className="mt-3"
            role="region"
            aria-label={th.healingActsOverallProgressAria}
          >
            <p className="text-xs font-medium text-bty-secondary mb-1.5">
              {th.healingActsOverallProgressCaption}: {doneCount}/{ACT_IDS.length}
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={actProgressPct}
              aria-valuetext={th.healingActsOverallProgressValuetext
                .replace("{done}", String(doneCount))
                .replace("{total}", String(ACT_IDS.length))
                .replace("{pct}", String(actProgressPct))}
              aria-label={th.healingActsOverallProgressAria}
              className="h-2 rounded-full bg-bty-border overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-[var(--arena-accent,#7c6b9a)] transition-[width] duration-300"
                style={{ width: `${actProgressPct}%` }}
              />
            </div>
          </div>
          <ul
            className="mt-3 grid grid-cols-1 gap-3"
            role="list"
            aria-label={th.awakeningActsGridAria}
          >
            {ACT_IDS.map((id) => {
              const name = actsMap[String(id)] ?? `Act ${id}`;
              const done = completed.has(id);
              const isNext = id === nextAct;
              const completedArr = Array.from(completed) as AwakeningActId[];
              const lockKey = healingAwakeningActLockReasonDisplayKey(id, completedArr);
              const showBlocked = !done && lockKey != null && !isNext;
              const desc = ACT_DESCRIPTIONS[id];
              return (
                <li
                  key={id}
                  className={`flex flex-col rounded-xl border px-3 py-4 shadow-sm ${
                    done
                      ? "border-green-200 bg-green-50/60"
                      : isNext
                        ? "border-[var(--arena-accent)]/40 bg-[var(--arena-accent)]/5"
                        : "border-bty-border bg-bty-bg opacity-60"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-bty-muted">
                    {th.awakeningActNumberLabel.replace("{n}", String(id))}
                  </span>
                  <span className="mt-1 text-sm font-semibold leading-tight text-bty-text">{name}</span>
                  <span className={`mt-1.5 text-[11px] font-medium ${done ? "text-green-700" : isNext ? "text-[var(--arena-accent)]" : "text-bty-muted"}`}>
                    {done ? th.awakeningActDone : isNext ? (lang === "ko" ? "다음 순서" : "Up next") : th.awakeningActOpen}
                  </span>
                  {desc && (
                    <p className="mt-2 text-xs leading-relaxed text-bty-secondary">
                      {lang === "ko" ? desc.ko : desc.en}
                    </p>
                  )}
                  {showBlocked && lockKey && (
                    <span
                      className="mt-2 text-[11px] leading-snug text-amber-900/90"
                      role="note"
                    >
                      {healingAwakeningLockReasonCopy(lang, lockKey)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-bty-muted">{th.healingProgressRefreshHint}</p>
          <button
            type="button"
            className="mt-2 rounded-lg border border-bty-border bg-bty-bg px-3 py-1.5 text-xs font-medium text-bty-secondary transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel disabled:opacity-50"
            disabled={loading || posting}
            onClick={() => load()}
            aria-busy={loading}
          >
            {th.healingProgressRefreshCta}
          </button>

          {nextAct == null ? (
            <p className="mt-3 text-xs text-bty-secondary">{th.awakeningAllActsRecorded}</p>
          ) : (
            <button
              type="button"
              className="mt-4 rounded-xl border border-bty-border bg-bty-soft px-4 py-2 text-sm font-semibold text-bty-text transition-colors hover:bg-bty-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel disabled:opacity-50"
              disabled={posting}
              onClick={recordNext}
            >
              {posting ? th.loading : th.awakeningRecordNextCta}
            </button>
          )}
          {pathBlockedHint != null && pathBlockedHint !== "" && (
            <p className="mt-2 text-sm text-amber-900/95" role="status">
              {pathBlockedHint}
            </p>
          )}

          <p className="mt-3 text-xs text-bty-muted">
            <Link
              href={`/${locale}/bty/healing/awakening`}
              className="font-medium text-bty-navy underline-offset-2 hover:underline"
            >
              {th.awakeningCta}
            </Link>
          </p>
        </>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl border border-bty-border bg-bty-surface px-4 py-3 text-sm text-bty-text shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
