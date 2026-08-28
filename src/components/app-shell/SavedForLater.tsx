"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Today → Saved for later (Slice R1B-C2, relocated in R1B-C2-R1).
 *
 * PROJECTED INTO TODAY, NOT CONVERTED INTO AN OBLIGATION. Today is where the person returns for
 * what matters now, and what they chose not to lose belongs there — but as its OWN lane. This
 * surface is deliberately not reachable from, merged into, or counted by "Don't miss today",
 * Apply this week, actionStatus, reminders or any overdue logic. Committed != Saved.
 *
 * The things the user chose not to lose. NOT a task list: there is no due date, no overdue state,
 * no priority, no checkbox, no completion affordance, no XP, no Arena/Host/verification/learning
 * language anywhere in this file. Saved != Promised — a row here has made no claim on the person,
 * and the surface must never imply one.
 *
 * Data comes from the canonical owner-scoped read (`GET /api/bty/action-capture/mine`), which
 * returns `status='captured'` only. `bty_action_captures` has RLS enabled with zero policies, so
 * there is no browser-direct read path; this component never queries Supabase itself.
 *
 * Nothing here is synthesized from metadata. When a message has no preview, the row says so
 * plainly rather than inventing a task title out of ids.
 */

type Locale = "en" | "ko";

export type SavedCapture = {
  id: string;
  sourceType: string;
  previewText: string | null;
  sourceUrl: string | null;
  sourceMetadata: Record<string, unknown>;
  status: string;
  capturedAt: string | null;
};

const COPY: Record<Locale, {
  title: string;
  back: string;
  loading: string;
  empty: string;
  errorText: string;
  retry: string;
  noPreview: string;
  open: string;
  teams: string;
}> = {
  en: {
    title: "Saved for later",
    back: "Today",
    loading: "Loading…",
    empty: "Nothing saved for later.",
    errorText: "Saved items could not be loaded.",
    // "Reload" on purpose: the terminology gate reserves the retry phrasing used elsewhere for
    // Action Contract revision, and nothing here is being revised — a read did not complete.
    retry: "Reload",
    noPreview: "Saved Teams message",
    open: "Open in Teams",
    teams: "Teams",
  },
  ko: {
    title: "나중을 위해",
    back: "오늘",
    loading: "불러오는 중…",
    empty: "나중을 위해 저장한 것이 없습니다.",
    errorText: "저장한 항목을 불러오지 못했습니다.",
    retry: "다시 불러오기",
    noPreview: "저장한 Teams 메시지",
    open: "Teams에서 열기",
    teams: "Teams",
  },
};

/** Context line: the source, plus whatever real provenance exists. Never a guess. */
function contextLine(t: (typeof COPY)[Locale], m: Record<string, unknown>): string {
  const sender = typeof m?.sender_display === "string" ? m.sender_display.trim() : "";
  return sender ? `${t.teams} · ${sender}` : t.teams;
}

export default function SavedForLater({ locale, onBack }: { locale: string; onBack?: () => void }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<SavedCapture[]>([]);

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/bty/action-capture/mine", { credentials: "include", cache: "no-store" });
      if (!res.ok) return false;
      const d = (await res.json()) as { ok?: boolean; items?: SavedCapture[] };
      if (d?.ok !== true || !Array.isArray(d.items)) return false;
      setItems(d.items);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void load().then((ok) => {
      if (alive) setState(ok ? "ready" : "error");
    });
    return () => {
      alive = false;
    };
  }, [load]);

  return (
    <section className="flex flex-col gap-3" data-testid="saved-view">
      {/* Focused-view grammar measured on Today: the component owns its own Back control, exactly
          as FieldActionForm and HostActionReviewDetail do under `tab === "today"`. */}
      {onBack ? (
        <button
          type="button"
          data-testid="saved-back"
          onClick={onBack}
          className="self-start text-xs font-medium text-white/55 hover:text-white/85"
        >
          ← {t.back}
        </button>
      ) : null}
      <h2 className="text-sm font-medium text-white/75">{t.title}</h2>

      {state === "loading" ? (
        <p className="text-sm text-white/40" role="status" data-testid="saved-loading">{t.loading}</p>
      ) : state === "error" ? (
        <div className="flex flex-col items-start gap-2" data-testid="saved-error">
          {/* Calm, and scoped: something did not load. No promise was broken, because none was made. */}
          <p className="text-sm text-white/70">{t.errorText}</p>
          <button
            type="button"
            data-testid="saved-retry"
            onClick={() => {
              setState("loading");
              void load().then((ok) => setState(ok ? "ready" : "error"));
            }}
            className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-white/70"
          >
            {t.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/40" role="status" data-testid="saved-empty">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="saved-list">
          {items.map((it) => {
            const preview = it.previewText && it.previewText.trim() !== "" ? it.previewText : t.noPreview;
            return (
              <li
                key={it.id}
                data-testid="saved-item"
                className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
              >
                <span className="text-[0.95rem] text-white/85">{preview}</span>
                <span className="text-[0.78rem] text-white/45" data-testid="saved-context">
                  {contextLine(t, it.sourceMetadata ?? {})}
                </span>
                {/* Only when a real, openable URL was stored. A dead button is worse than none. */}
                {it.sourceUrl ? (
                  <a
                    href={it.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="saved-open"
                    className="mt-1 self-start text-[0.78rem] font-medium text-white/70 hover:text-white/95"
                  >
                    {t.open}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
