"use client";

import { useCallback, useEffect, useState } from "react";
import type { FoundryContentType } from "@/domain/foundry/events/content-type";
import type { Locale, HistoryCopy } from "./historyCopy";
import { HISTORY_COPY } from "./historyCopy";

/**
 * Foundry Event History Archive — read-only host surface (a view inside the
 * Foundry host tab, NOT a new global destination). It answers one need: "find the
 * training sessions we already ran and confirm what happened." No edit, reopen,
 * rerun, duplicate, or delete controls. No individual reflection text. No ranking.
 *
 * Data comes entirely from the server view models (`/api/bty/foundry/event-
 * history[/:id]`) — the UI renders factual counts and completion status only and
 * never reconstructs qualification or count semantics.
 */

type RosterStatus =
  | "joined"
  | "watching"
  | "reading"
  | "response_pending"
  | "complete"
  | "removed";

type HistoryListItem = {
  eventId: string;
  title: string;
  status: "closed";
  contentType: FoundryContentType | null;
  createdAt: string;
  endedAt: string | null;
  participantCount: number;
  completionCount: number;
};

type HistoryMaterial =
  | { kind: "youtube"; title: string | null; videoId: string; completionPrompt: string }
  | { kind: "document"; fileName: string | null; pageCount: number; sourceType: string; completionPrompt: string }
  /** R4-R2G — the Host's own text, frozen in the immutable module snapshot. */
  | { kind: "written_guidance"; guidance: string; completionPrompt: string }
  | { kind: "live_discussion"; discussion: string; completionPrompt: string }
  | { kind: "unknown" }
  | { kind: "none" };

type HistoryParticipant = {
  id: string;
  displayName: string;
  joinedAt: string;
  status: RosterStatus;
};

type HistoryDetail = {
  eventId: string;
  title: string;
  status: "closed";
  contentType: FoundryContentType | null;
  createdAt: string;
  endedAt: string | null;
  participantCount: number;
  completionCount: number;
  material: HistoryMaterial;
  participants: HistoryParticipant[];
};

type Sub = { kind: "list" } | { kind: "detail"; eventId: string };

function formatDate(iso: string | null, dateLocale: string): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  try {
    return new Intl.DateTimeFormat(dateLocale, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(t),
    );
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

function rosterLabel(status: RosterStatus, t: HistoryCopy): string {
  switch (status) {
    case "complete":
      return t.status_complete;
    case "response_pending":
      return t.status_response_pending;
    case "watching":
      return t.status_watching;
    case "reading":
      return t.status_reading;
    default:
      return t.status_joined;
  }
}

export default function FoundryHistoryArchive({
  locale,
  onBack,
}: {
  locale: Locale;
  onBack: () => void;
}) {
  const t = HISTORY_COPY[locale];
  const [sub, setSub] = useState<Sub>({ kind: "list" });

  return (
    <div className="btyFadeIn flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (sub.kind === "detail" ? setSub({ kind: "list" }) : onBack())}
          className="text-sm text-white/50 transition-colors hover:text-white/80"
        >
          ← {t.back}
        </button>
        <span className="text-xs uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
      </div>

      {sub.kind === "list" ? (
        <HistoryList t={t} onOpen={(id) => setSub({ kind: "detail", eventId: id })} />
      ) : (
        <HistoryDetailView t={t} eventId={sub.eventId} onBack={() => setSub({ kind: "list" })} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function HistoryList({ t, onOpen }: { t: HistoryCopy; onOpen: (id: string) => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<HistoryListItem[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/bty/foundry/event-history", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = (await res.json()) as { events?: HistoryListItem[] };
      setItems(Array.isArray(data.events) ? data.events : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold leading-snug text-white">{t.title}</h1>
        <p className="text-sm leading-6 text-white/55">{t.subtitle}</p>
      </header>

      {state === "loading" ? (
        <div className="flex flex-col gap-2.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[4.5rem] rounded-xl border border-white/[0.08] bg-white/[0.03]" />
          ))}
        </div>
      ) : state === "error" ? (
        <ErrorBlock message={t.loadError} retryLabel={t.retry} onRetry={load} />
      ) : items.length === 0 ? (
        <div className="flex min-h-[35vh] flex-col items-center justify-center gap-2 text-center">
          <p className="text-base font-medium text-white/80">{t.emptyTitle}</p>
          <p className="max-w-[18rem] text-sm leading-6 text-white/45">{t.emptySub}</p>
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-2.5 p-0 m-0" role="list">
          {items.map((it) => (
            <li key={it.eventId}>
              <button
                type="button"
                onClick={() => onOpen(it.eventId)}
                className="flex w-full flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-left transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.98rem] font-medium text-white/90">
                    {it.title}
                  </span>
                  <span className="shrink-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#C9A66B]/80">
                    {t.completedTag}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
                  <span>{t.endedOn(formatDate(it.endedAt ?? it.createdAt, t.dateLocale))}</span>
                  <span aria-hidden>·</span>
                  <span>{t.participantsCount(it.participantCount)}</span>
                  <span aria-hidden>·</span>
                  <span>{t.completedCount(it.completionCount)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function HistoryDetailView({
  t,
  eventId,
  onBack,
}: {
  t: HistoryCopy;
  eventId: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "not_found">("loading");
  const [detail, setDetail] = useState<HistoryDetail | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/bty/foundry/event-history/${encodeURIComponent(eventId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 404) {
        setState("not_found");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = (await res.json()) as { event?: HistoryDetail };
      if (!data.event) {
        setState("not_found");
        return;
      }
      setDetail(data.event);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="h-8 w-2/3 rounded-lg bg-white/[0.05]" />
        <div className="h-24 rounded-xl border border-white/[0.08] bg-white/[0.03]" />
        <div className="h-24 rounded-xl border border-white/[0.08] bg-white/[0.03]" />
      </div>
    );
  }
  if (state === "not_found") {
    return <ErrorBlock message={t.notFound} retryLabel={t.back} onRetry={onBack} />;
  }
  if (state === "error" || !detail) {
    return <ErrorBlock message={t.loadError} retryLabel={t.retry} onRetry={load} />;
  }

  const incomplete =
    detail.completionCount <= detail.participantCount
      ? detail.participantCount - detail.completionCount
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-snug text-white">{detail.title}</h1>
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">
          {t.completedTag}
        </span>
      </header>

      {/* Session details */}
      <Section title={t.sessionDetails} t={t}>
        <Field label={t.createdLabel} value={formatDate(detail.createdAt, t.dateLocale)} />
        <Field label={t.endedLabel} value={formatDate(detail.endedAt, t.dateLocale)} />
      </Section>

      {/* Participation — factual counts only */}
      <Section title={t.participation} t={t}>
        <Field label={t.participantsLabel} value={String(detail.participantCount)} />
        <Field label={t.completedByLabel} value={String(detail.completionCount)} />
        {incomplete !== null ? <Field label={t.incompleteLabel} value={String(incomplete)} /> : null}
      </Section>

      {/* Training materials */}
      <Section title={t.trainingMaterials} t={t}>
        <MaterialBlock material={detail.material} t={t} />
      </Section>

      {/* Completion — roster with completion-only status (no response text) */}
      <Section title={t.completionSummary} t={t}>
        {detail.participants.length === 0 ? (
          <p className="text-sm text-white/45">{t.rosterEmpty}</p>
        ) : (
          <ul className="flex list-none flex-col gap-1.5 p-0 m-0" role="list">
            {detail.participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm text-white/85">{p.displayName}</span>
                <span
                  className={
                    "shrink-0 text-xs " +
                    (p.status === "complete" ? "text-[#C9A66B]/85" : "text-white/40")
                  }
                >
                  {rosterLabel(p.status, t)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function MaterialBlock({ material, t }: { material: HistoryMaterial; t: HistoryCopy }) {
  if (material.kind === "none") {
    return <p className="text-sm text-white/45">{t.materialNone}</p>;
  }
  /*
    R4-R2G — this function used to end with an UNGUARDED YouTube block, so any material kind it
    did not recognise rendered as a video with `material.title`/`material.videoId` undefined.
    Both new kinds are explicit, and an unknown one says so.
  */
  if (material.kind === "unknown") {
    return <p className="text-sm text-white/45">{t.materialUnknown}</p>;
  }
  if (material.kind === "written_guidance" || material.kind === "live_discussion") {
    const body = material.kind === "written_guidance" ? material.guidance : material.discussion;
    const label = material.kind === "written_guidance" ? t.materialWrittenGuidance : t.materialLiveDiscussion;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-xs text-white/45">{label}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{body}</p>
        <PromptLine label={t.reflectionQuestion} value={material.completionPrompt} />
      </div>
    );
  }
  if (material.kind === "document") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-white/85">{material.fileName ?? "PDF"}</span>
          <span className="shrink-0 text-xs text-white/45">
            {t.materialDocument} · {t.pagesLabel(material.pageCount)}
          </span>
        </div>
        <PromptLine label={t.reflectionQuestion} value={material.completionPrompt} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-white/85">
          {material.title ?? material.videoId}
        </span>
        <span className="shrink-0 text-xs text-white/45">{t.materialVideo}</span>
      </div>
      <PromptLine label={t.reflectionQuestion} value={material.completionPrompt} />
    </div>
  );
}

function PromptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-3 py-2.5">
      <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/35">{label}</div>
      <div className="mt-0.5 text-sm leading-6 text-white/70">{value}</div>
    </div>
  );
}

function Section({
  title,
  t: _t,
  children,
}: {
  title: string;
  t: HistoryCopy;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{title}</h2>
      <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-medium text-white/85">{value}</span>
    </div>
  );
}

function ErrorBlock({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
      <p className="max-w-[18rem] text-sm leading-6 text-white/60">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.08]"
      >
        {retryLabel}
      </button>
    </div>
  );
}
