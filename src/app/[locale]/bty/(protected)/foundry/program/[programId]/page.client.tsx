"use client";

import Link from "next/link";
import React from "react";
import {
  PROGRAM_COMPLETED_EVENT,
  postFoundryProgramProgress,
  type ProgramCompletedDetail,
} from "@/components/foundry/ProgramRecommenderWidget";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

export default function ProgramDetailClient({
  locale,
  programId,
}: {
  locale: "ko" | "en";
  programId: string;
}) {
  const t = getMessages(locale as Locale).bty;
  const localePath = locale;
  const [title, setTitle] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = React.useState(false);
  const [completeMsg, setCompleteMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error: qErr } = await sb
          .from("program_catalog")
          .select("title")
          .eq("program_id", programId)
          .maybeSingle();
        if (!alive) return;
        if (qErr) {
          setError(qErr.message);
          return;
        }
        setTitle(typeof data?.title === "string" ? data.title : programId);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [programId]);

  const onMarkComplete = React.useCallback(async () => {
    setCompleteBusy(true);
    setCompleteMsg(null);
    try {
      const r = await postFoundryProgramProgress({ action: "complete", programId });
      if (!r.ok) {
        setCompleteMsg(r.error ?? "failed");
        return;
      }
      if (r.programCompletedDetail) {
        window.dispatchEvent(
          new CustomEvent<ProgramCompletedDetail>(PROGRAM_COMPLETED_EVENT, { detail: r.programCompletedDetail }),
        );
      }
      setCompleteMsg(locale === "ko" ? "완료로 기록했습니다." : "Marked complete.");
    } catch {
      setCompleteMsg(locale === "ko" ? "요청에 실패했습니다." : "Request failed.");
    } finally {
      setCompleteBusy(false);
    }
  }, [programId, locale]);

  return (
    <main className="max-w-xl mx-auto px-4 py-8" aria-label={t.foundryProgramDetailMainAria}>
      <Link
        href={`/${localePath}/bty/foundry`}
        className="text-sm text-[var(--arena-accent)] font-medium mb-6 inline-block"
      >
        {t.foundryBackToBtyHome}
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--arena-text)]">
        {title ?? (error ? t.programRecommenderWidgetError : "…")}
      </h1>
      <p className="text-xs text-[var(--arena-text-soft)] mt-2 font-mono">{programId}</p>
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void onMarkComplete()}
          disabled={completeBusy}
          className="rounded-xl border border-[var(--arena-accent)]/40 bg-[var(--arena-accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--arena-text)] hover:bg-[var(--arena-accent)]/20 disabled:opacity-50"
        >
          {locale === "ko" ? "프로그램 완료로 표시" : "Mark program complete"}
        </button>
        {completeMsg ? (
          <p className="text-xs text-[var(--arena-text-soft)] m-0" role="status">
            {completeMsg}
          </p>
        ) : null}
      </div>
    </main>
  );
}
