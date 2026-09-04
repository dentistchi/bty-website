"use client";

import { useCallback, useEffect, useState } from "react";
import type { TriageChoice, TriageState } from "@/domain/action-capture/triage";
import { groupByConversation } from "@/domain/action-capture/conversationGroup";
import SwipeAction from "@/components/app-shell/SwipeAction";
import { openSourceLink } from "@/lib/bty/teams/openSourceLink";

/**
 * Today → Saved for later (Slice R1B-C2, relocated in R1B-C2-R1, triage added in T2).
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
 * WHAT T2.1 ADDS. Several messages saved from ONE Teams conversation collapse into one compact
 * card inside their lane, because three stacked full-size cards from the same chat read as three
 * problems when they are one. Grouping is VISUAL ONLY: triage stays message-level, a group has no
 * decision of its own, and there are deliberately no bulk controls — with no undo in V1, one tap
 * must never decide for messages the person has not read. A conversation with one saved message
 * renders exactly as it did before, with no group chrome at all.
 *
 * Grouping happens AFTER the lane split, never across it, so a conversation whose messages hold
 * different decisions simply appears in each lane it has messages in. The key is computed by a
 * pure domain function from tenant + conversation id and is opaque; sender is display material
 * only, and grouping by it would merge a private-channel post into a 1:1 chat — measured on live
 * data, not imagined.
 *
 * WHAT T2 ADDS, AND WHAT IT REFUSES TO ADD. One decision per saved item: Soon or Later. Both are
 * VISIBLE BUTTONS, because a hidden gesture must never be the only way to do a required thing —
 * there is no swipe in V1. Choosing moves the card into that group and the controls go away; there
 * is no Done, no Clear, no Dismiss, no Delete, no undo and no count, because none of those is a
 * promise this object makes. `soon` is a position in this list. It is not a deadline, it never
 * reaches Today's obligations, and it never becomes an Action Contract.
 *
 * Data comes from the canonical owner-scoped read (`GET /api/bty/action-capture/mine`), which
 * returns `status='captured'` only, ALREADY ORDERED (undecided → soon → later). This component
 * renders that order; it does not compute it.
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
  groupNew: string;
  groupSoon: string;
  groupLater: string;
  savedCount: (n: number) => string;
  soon: string;
  later: string;
  notSaved: string;
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
    openFailed: "Couldn't open this message in Teams.",
    // "Open again", not the retry phrasing the terminology gate reserves — the same reason
    // this lane already says "Reload" rather than the obvious word.
    openRetry: "Open again",
    teams: "Teams",
    // Group headings name a PLACE, never a status or a workflow stage.
    groupNew: "New",
    groupSoon: "Soon",
    groupLater: "Later",
    // Says how much is here, never how much is left to do. Only ever shown on a group of 2+.
    savedCount: (n) => `${n} saved messages`,
    soon: "Soon",
    later: "Later",
    // The card has already moved back to where it was; the controls are visible again, so the
    // recovery is simply to press one. No dialog, and nothing lost.
    notSaved: "That didn't save.",
  },
  ko: {
    title: "나중에 보기",
    back: "오늘",
    loading: "불러오는 중…",
    empty: "아직 저장한 항목이 없습니다.",
    errorText: "저장한 항목을 불러오지 못했습니다.",
    retry: "다시 불러오기",
    noPreview: "저장한 Teams 메시지",
    open: "Teams에서 열기",
    openFailed: "이 메시지를 Teams에서 열지 못했습니다.",
    openRetry: "다시 열기",
    teams: "Teams",
    groupNew: "새로 담은 것",
    groupSoon: "곧",
    groupLater: "나중에",
    savedCount: (n) => `저장한 메시지 ${n}개`,
    soon: "곧",
    later: "나중에",
    notSaved: "저장되지 않았습니다.",
  },
};

/**
 * One saved message.
 *
 * MODULE-LEVEL ON PURPOSE. Declared inside `SavedForLater` this was a new component type on
 * every parent render, so React remounted every row whenever anything changed — losing an
 * in-progress swipe and any transient row state with it. The SAME card whether it stands alone or sits inside an expanded
 * conversation — a message does not become a different thing because it has neighbours.
 */
function CaptureCard({
it,
t,
pendingId,
failedId,
choose,
}: {
it: SavedCapture;
t: (typeof COPY)[Locale];
pendingId: string | null;
failedId: string | null;
choose: (id: string, choice: TriageChoice) => void;
}) {
  /** Local to this row: one card failing to open must not disturb any other. */
  const [openFailed, setOpenFailed] = useState(false);

  const undecided = it.triageChoice === null;
  const surface =
    "flex flex-col gap-1 rounded-xl border px-4 py-3 " +
    // Soon reads a little more present; Later stays quiet. Neither is urgent, and neither is
    // ever red — nothing here is late, because nothing is owed.
    (it.triageChoice === "soon"
      ? "border-[#C9A66B]/25 bg-[#C9A66B]/[0.04]"
      : "border-white/[0.08] bg-white/[0.02]");

  /* Swipe IS the decision now — it calls the identical `choose` the visible buttons below call,
     so there is one mutation path, one optimistic update and one rollback. What used to sit here
     was a tray holding a second copy of those same two buttons; the gesture reached the same
     place by a longer road, and parked the card open on the way. */
  const swipeOutcome = (choice: TriageChoice, label: string) => ({
    label,
    onCommit: () => void choose(it.id, choice),
    // Reuses the tone the card already gives this choice. No new colour is introduced.
    className: choice === "soon" ? "bg-[#C9A66B]/20 text-[#E5B769]" : "bg-white/[0.06] text-white/75",
  });

  const body = (
    <div className={surface}>
      <span className="text-[0.95rem] text-white/85">{previewOf(it, t)}</span>
      <span className="text-[0.78rem] text-white/45" data-testid="saved-context">
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
            already inside BTY — and the saved item, its group and its decision controls are all
            still on screen behind this line.
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

      {/* The one decision, and only while it is still open. Two plain buttons, sized for a thumb,
          no icon to decode and no gesture to discover. Message-level, always — never on a group. */}
      {undecided ? (
        <div className="mt-2 flex gap-2" data-testid="saved-triage-controls">
          {(
            [
              ["soon", t.soon] as const,
              ["later", t.later] as const,
            ] satisfies readonly (readonly [TriageChoice, string])[]
          ).map(([choice, label]) => (
            <button
              key={choice}
              type="button"
              data-testid={`saved-triage-${choice}`}
              disabled={pendingId !== null}
              onClick={() => void choose(it.id, choice)}
              className={
                "min-h-[2.75rem] flex-1 rounded-xl border px-4 text-[0.85rem] font-medium transition-colors disabled:opacity-50 " +
                (choice === "soon"
                  ? "border-[#C9A66B]/45 bg-[#C9A66B]/10 text-[#E5B769]"
                  : "border-white/[0.12] bg-white/[0.03] text-white/70")
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {failedId === it.id ? (
        <p className="mt-1 text-[0.75rem] text-white/55" role="status" data-testid="saved-triage-error">
          {t.notSaved}
        </p>
      ) : null}
    </div>
  );

  return (
    <li data-testid="saved-item" data-triage={it.triageChoice ?? "none"}>
      <SwipeAction
        enabled={undecided}
        left={swipeOutcome("soon", t.soon)}
        right={swipeOutcome("later", t.later)}
      >
        {body}
      </SwipeAction>
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
  /** Which card's decision failed to save. Scoped to one row — never a screen-level error. */
  const [failedId, setFailedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  /**
   * Move the card immediately, then confirm with the server.
   *
   * OPTIMISTIC, BUT NEVER LOSSY. On failure the previous list is restored exactly as it was — the
   * card returns to where it sat, with its controls, and says so quietly. A saved thing must not
   * be able to disappear because a request failed.
   */
  const choose = useCallback(
    async (id: string, choice: TriageChoice) => {
      if (pendingId) return; // one decision at a time; a second tap is not a second decision
      const previous = items;
      setFailedId(null);
      setPendingId(id);
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, triageChoice: choice, triagedAt: new Date().toISOString() } : it)),
      );
      try {
        const res = await fetch(`/api/bty/action-capture/${encodeURIComponent(id)}/triage`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice }),
        });
        const d = (await res.json().catch(() => null)) as { ok?: boolean; capture?: SavedCapture } | null;
        if (!res.ok || d?.ok !== true || !d.capture) {
          setItems(previous);
          setFailedId(id);
          return;
        }
        // Adopt the server's row so the rendered state is the stored state, not our guess.
        const saved = d.capture;
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...saved } : it)));
      } catch {
        setItems(previous);
        setFailedId(id);
      } finally {
        setPendingId(null);
      }
    },
    [items, pendingId],
  );

  const lanes: { key: "new" | "soon" | "later"; heading: string; rows: SavedCapture[] }[] = [
    { key: "new", heading: t.groupNew, rows: items.filter((i) => i.triageChoice === null) },
    { key: "soon", heading: t.groupSoon, rows: items.filter((i) => i.triageChoice === "soon") },
    { key: "later", heading: t.groupLater, rows: items.filter((i) => i.triageChoice === "later") },
  ];



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
            className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/70"
          >
            {t.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/40" role="status" data-testid="saved-empty">{t.empty}</p>
      ) : (
        <div className="flex flex-col gap-5" data-testid="saved-list">
          {lanes.map((lane) =>
            // An empty lane is not a place yet, so it is not drawn. No zero, no badge, no count.
            lane.rows.length === 0 ? null : (
              <div key={lane.key} className="flex flex-col gap-2" data-testid={`saved-group-${lane.key}`}>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/35">
                  {lane.heading}
                </span>
                <ul className="flex flex-col gap-2">
                  {/* Grouped AFTER the lane split, never across it (T2.1). A conversation with one
                      saved message in this lane passes straight through as the card it always was. */}
                  {groupByConversation(lane.rows).map((conv) =>
                    conv.count === 1 ? (
                      <CaptureCard
                        key={conv.captures[0].id}
                        it={conv.captures[0]}
                        t={t}
                        pendingId={pendingId}
                        failedId={failedId}
                        choose={choose}
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
                            <span className="text-[0.78rem] text-white/45">
                              {contextLine(t, conv.latestCapture.sourceMetadata ?? {})}
                            </span>
                            {/* Quiet, and a statement of fact — how much is here, never how much
                                is left to do. Never rendered on Today. */}
                            <span className="shrink-0 text-[0.72rem] text-white/35" data-testid="saved-conversation-count">
                              {t.savedCount(conv.count)}
                            </span>
                          </span>
                          <span className="flex items-start justify-between gap-3">
                            <span className="text-[0.95rem] text-white/85">{previewOf(conv.latestCapture, t)}</span>
                            <span aria-hidden className="mt-0.5 shrink-0 text-[0.7rem] text-white/35">
                              {expanded.has(conv.key) ? "▾" : "▸"}
                            </span>
                          </span>
                        </button>

                        {/* Expanded: every saved message, individually addressable — its own source
                            link and its own decision. The GROUP never offers Soon/Later. */}
                        {expanded.has(conv.key) ? (
                          <ul className="mt-2 flex flex-col gap-2 pl-3" data-testid="saved-conversation-messages">
                            {conv.captures.map((it) => (
                              <CaptureCard
                                key={it.id}
                                it={it}
                                t={t}
                                pendingId={pendingId}
                                failedId={failedId}
                                choose={choose}
                              />
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
