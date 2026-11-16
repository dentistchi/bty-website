"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TriageState } from "@/domain/action-capture/triage";
import { groupByConversation } from "@/domain/action-capture/conversationGroup";
import TodaySwipeAction from "@/components/app-shell/TodaySwipeAction";
import { openSourceLink } from "@/lib/bty/teams/openSourceLink";

/**
 * Saved Teams messages are a personal list. Grouping by conversation is visual only.
 * Each message retains its own source link and can be removed individually.
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
  triageChoice: TriageState;
  triagedAt: string | null;
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
  openFailed: string;
  openRetry: string;
  teams: string;
  savedCount: (n: number) => string;
  remove: string;
  removeFailed: string;
}> = {
  en: {
    title: "Saved for later",
    back: "Today",
    // The SAME word Today uses for the same gesture. One vocabulary for one meaning.
    remove: "Remove",
    removeFailed: "Couldn't remove that.",
    loading: "Loading…",
    empty: "Nothing saved for later.",
    errorText: "Saved items could not be loaded.",
    // "Reload" on purpose: the terminology gate reserves the retry phrasing used elsewhere for
    // Action Contract revision, and nothing here is being revised — a read did not complete.
    retry: "Reload",
    noPreview: "Saved Teams message",
    open: "Open in Teams",
    openFailed: "Couldn't open this message in Teams.",
    // "Open again", not the retry phrasing the terminology gate reserves — the same reason
    // this lane already says "Reload" rather than the obvious word.
    openRetry: "Open again",
    teams: "Teams",
    savedCount: (n) => `${n} saved messages`,
  },
  ko: {
    title: "나중에 보기",
    back: "오늘",
    remove: "치우기",
    removeFailed: "치우지 못했습니다.",
    loading: "불러오는 중…",
    empty: "아직 저장한 항목이 없습니다.",
    errorText: "저장한 항목을 불러오지 못했습니다.",
    retry: "다시 불러오기",
    noPreview: "저장한 Teams 메시지",
    open: "Teams에서 열기",
    openFailed: "이 메시지를 Teams에서 열지 못했습니다.",
    openRetry: "다시 열기",
    teams: "Teams",
    savedCount: (n) => `저장한 메시지 ${n}개`,
  },
};

function CaptureCard({
  it,
  t,
  pendingId,
  failedId,
  remove,
  swipeOpenId,
  setSwipeOpenId,
}: {
  it: SavedCapture;
  t: (typeof COPY)[Locale];
  pendingId: string | null;
  failedId: string | null;
  remove: (id: string) => void;
  swipeOpenId: string | null;
  setSwipeOpenId: (id: string | null) => void;
}) {
  const [openFailed, setOpenFailed] = useState(false);

  const body = (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <span className="text-[0.95rem] text-white/85">{previewOf(it, t)}</span>
      <span className="text-[0.78rem] text-white/55" data-testid="saved-context">
        {contextLine(t, it.sourceMetadata ?? {})}
      </span>
      {/*
        Only when a real, openable URL was stored. A dead button is worse than none.

        ★ A COMMAND, NOT AN ANCHOR (2026-09-04). This was `<a target="_blank">`, and inside the
        Teams tab that is the defect: the frame containment skips `_blank` links as "already
        leaving, on purpose", so `app.openLink` never ran, the off-domain navigation could not be
        honoured against the manifest's single valid domain, and the tab was bounced back to its
        own contentUrl — which is the "BTY couldn't open yet." the person saw. The destination is
        unchanged and still the stored URL, verbatim; only who is asked to open it changed.
      */}
      {it.sourceUrl ? (
        <>
          <button
            type="button"
            data-testid="saved-open"
            /*
              The destination, inspectable but NOT navigable. It keeps the coverage that mattered —
              each message opens ITS own message, never one ambiguous group link — without
              reintroducing the `href`/`_blank` pair that the Teams containment skips.
            */
            data-source-url={it.sourceUrl}
            onClick={() => {
              setOpenFailed(false);
              void openSourceLink(it.sourceUrl).then((ok) => setOpenFailed(!ok));
            }}
            className="mt-1 min-h-[44px] self-start text-left text-[0.78rem] font-medium text-white/70 hover:text-white/95"
          >
            {t.open}
          </button>
          {/*
            The person stays exactly where they were. No bootstrap screen, no "Open BTY" — they are
            already inside BTY — and the saved message stays on screen behind this line.
          */}
          {openFailed ? (
            <span className="text-[0.78rem] text-white/60" data-testid="saved-open-failed">
              {t.openFailed}{" "}
              <button
                type="button"
                data-testid="saved-open-retry"
                onClick={() => {
                  setOpenFailed(false);
                  void openSourceLink(it.sourceUrl).then((ok) => setOpenFailed(!ok));
                }}
                className="min-h-[44px] font-medium text-white/80 underline hover:text-white"
              >
                {t.openRetry}
              </button>
            </span>
          ) : null}
        </>
      ) : null}

      {failedId === it.id ? (
        <p className="mt-1 text-[0.75rem] text-white/60" role="status" data-testid="saved-remove-error">
          {t.removeFailed}
        </p>
      ) : null}
    </div>
  );

  return (
    <li data-testid="saved-item">
      <TodaySwipeAction
        action={{ label: t.remove, tone: "destructive", onCommit: () => remove(it.id) }}
        open={swipeOpenId === it.id}
        onOpenChange={(open) => setSwipeOpenId(open ? it.id : null)}
        busy={pendingId === it.id}
        testIdPrefix="saved"
      >
        {body}
        <button
          type="button"
          data-testid="saved-remove"
          disabled={pendingId === it.id}
          onClick={() => remove(it.id)}
          className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:z-10 focus:inline-flex focus:min-h-[2.75rem] focus:items-center focus:rounded-lg focus:bg-[#B3261E] focus:px-3 focus:text-[0.78rem] focus:font-semibold focus:text-white disabled:opacity-50"
        >
          {t.remove}
        </button>
      </TodaySwipeAction>
    </li>
  );
}

/** A preview exists for recognition; when there is none, say so plainly rather than invent one. */
function previewOf(c: SavedCapture, t: (typeof COPY)[Locale]): string {
  return c.previewText && c.previewText.trim() !== "" ? c.previewText : t.noPreview;
}

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
  const [failedId, setFailedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Ignore superseded reads, including a response after the list was closed.
  const readGeneration = useRef(0);
  /** ONE ROW OPEN AT A TIME, owned here: there is only one slot to be open in. */
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  /** Which conversations are open. Local only — a reading position is not worth persisting. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const load = useCallback(async (): Promise<boolean> => {
    const generation = ++readGeneration.current;
    try {
      const res = await fetch("/api/bty/action-capture/mine", { credentials: "include", cache: "no-store" });
      if (generation !== readGeneration.current) return false;
      if (!res.ok) return false;
      const d = (await res.json()) as { ok?: boolean; items?: SavedCapture[] };
      if (generation !== readGeneration.current) return false;
      if (d?.ok !== true || !Array.isArray(d.items)) return false;
      // The API's legacy triage order does not apply to this single list.
      setItems([...d.items].sort((a, b) =>
        (b.capturedAt ?? "").localeCompare(a.capturedAt ?? "") || a.id.localeCompare(b.id),
      ));
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
      readGeneration.current++;
    };
  }, [load]);

  // Remove is optimistic; restore the same message if the request fails.
  const removeFromSaved = useCallback(
    async (id: string) => {
      if (pendingId) return;
      const previous = items;
      setFailedId(null);
      setPendingId(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setSwipeOpenId(null);
      try {
        const res = await fetch(`/api/bty/action-capture/${encodeURIComponent(id)}/remove`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const d = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (!res.ok || d?.ok !== true) {
          setItems(previous);
          setFailedId(id);
        }
        // `changed: false` is success: it had already left, and it is already gone from this list.
      } catch {
        setItems(previous);
        setFailedId(id);
      } finally {
        setPendingId(null);
      }
    },
    [items, pendingId],
  );

  return (
    <section className="flex flex-col gap-3" data-testid="saved-view">
      {/* Focused-view grammar measured on Today: the component owns its own Back control, exactly
          as FieldActionForm and HostActionReviewDetail do under `tab === "today"`. */}
      {onBack ? (
        <button
          type="button"
          data-testid="saved-back"
          onClick={onBack}
          className="self-start text-xs font-medium text-white/60 hover:text-white/85"
        >
          ← {t.back}
        </button>
      ) : null}
      <h2 className="text-sm font-medium text-white/75">{t.title}</h2>

      {state === "loading" ? (
        <p className="text-sm text-white/55" role="status" data-testid="saved-loading">{t.loading}</p>
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
            className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/70"
          >
            {t.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/55" role="status" data-testid="saved-empty">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="saved-list">
          {groupByConversation(items).map((conv) =>
            conv.count === 1 ? (
              <CaptureCard
                key={conv.captures[0].id}
                it={conv.captures[0]}
                t={t}
                pendingId={pendingId}
                failedId={failedId}
                remove={removeFromSaved}
                swipeOpenId={swipeOpenId}
                setSwipeOpenId={setSwipeOpenId}
              />
            ) : (
              <li key={conv.key} data-testid="saved-conversation" data-count={conv.count}>
                <button
                  type="button"
                  data-testid="saved-conversation-header"
                  aria-expanded={expanded.has(conv.key)}
                  onClick={() => toggle(conv.key)}
                  className="flex w-full flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[0.78rem] text-white/55">
                      {contextLine(t, conv.latestCapture.sourceMetadata ?? {})}
                    </span>
                    <span className="shrink-0 text-[0.72rem] text-white/50" data-testid="saved-conversation-count">
                      {t.savedCount(conv.count)}
                    </span>
                  </span>
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[0.95rem] text-white/85">{previewOf(conv.latestCapture, t)}</span>
                    <span aria-hidden className="mt-0.5 shrink-0 text-[0.7rem] text-white/50">
                      {expanded.has(conv.key) ? "▾" : "▸"}
                    </span>
                  </span>
                </button>

                {expanded.has(conv.key) ? (
                  <ul className="mt-2 flex flex-col gap-2 pl-3" data-testid="saved-conversation-messages">
                    {conv.captures.map((it) => (
                      <CaptureCard
                        key={it.id}
                        it={it}
                        t={t}
                        pendingId={pendingId}
                        failedId={failedId}
                        remove={removeFromSaved}
                        swipeOpenId={swipeOpenId}
                        setSwipeOpenId={setSwipeOpenId}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
