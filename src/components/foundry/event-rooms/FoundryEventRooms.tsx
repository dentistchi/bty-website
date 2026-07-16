"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import { MODULE_BUILDER_COPY, type ModuleBuilderCopy } from "./moduleBuilderCopy";
import type { ManagerEventSummary, ManagerSnapshot } from "./types";
import type { ClientDraftSummary } from "@/lib/bty/foundry/events/moduleClient";
import { CreateFoundryEventForm } from "./CreateFoundryEventForm";
import { FoundryEventControlRoom } from "./FoundryEventControlRoom";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * Foundry Event Rooms — the native Foundry tab (replaces the LockedRoom).
 *
 * The manager's room, not a dashboard: create an event, get a QR, watch the team
 * arrive, close it. The shell mounts this with `locale` only; it fetches its own
 * data from `/api/bty/foundry/*` (credentials-included, fail-soft). This is the
 * FIRST real Foundry feature — content (training modules) is a later, bounded
 * seam inside the room, not built here.
 *
 * View state is internal (no router): home → create → control. On tab re-entry
 * the shell remounts this and we re-list from the server (cold restore).
 */
type View =
  | { kind: "home" }
  | { kind: "create" }
  | { kind: "builder"; draftId: string }
  | { kind: "control"; eventId: string; initial?: ManagerSnapshot | null };

export default function FoundryEventRooms({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[loc];
  const bt: ModuleBuilderCopy = MODULE_BUILDER_COPY[loc];

  const [view, setView] = useState<View>({ kind: "home" });
  const [events, setEvents] = useState<ManagerEventSummary[] | null>(null);
  const [drafts, setDrafts] = useState<ClientDraftSummary[]>([]);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  // Host-capability access, resolved from the events list response. A non-host
  // sees a quiet employee-pointer state; an auth/network error is NOT shown as
  // "non-host" (it stays a neutral loading hold so we never misrepresent it).
  const [access, setAccess] = useState<"loading" | "host" | "non_host">("loading");

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/events", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { events?: ManagerEventSummary[] };
        setEvents(Array.isArray(data.events) ? data.events : []);
        setAccess("host");
        return;
      }
      if (res.status === 403) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (body?.error === "foundry_host_required") {
          setAccess("non_host");
          return;
        }
      }
      // Auth expiry / network / server error → stay in a neutral hold (not non-host).
      setAccess("loading");
    } catch {
      setAccess("loading");
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/modules", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { drafts?: ClientDraftSummary[] };
      // Only draft-status drafts are resumable in the builder; approved/published
      // are never shown as resumable. Server already sorts by updated_at desc.
      setDrafts((data.drafts ?? []).filter((d) => d.status === "draft"));
    } catch {
      /* keep prior list on transient error */
    }
  }, []);

  useEffect(() => {
    if (view.kind === "home") {
      void loadList();
      void loadDrafts();
    }
  }, [view.kind, loadList, loadDrafts]);

  const onCreated = useCallback((snapshot: ManagerSnapshot) => {
    setView({ kind: "control", eventId: snapshot.event.id, initial: snapshot });
  }, []);

  // Start a new guided draft. Guarded so a double-tap creates EXACTLY one row.
  const startNewDraft = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const res = await fetch("/api/bty/foundry/modules", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { draft?: { id?: string } };
        const id = data.draft?.id;
        if (id) setView({ kind: "builder", draftId: id });
      }
    } catch {
      /* stay on home; the button re-enables */
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, []);

  const openDraft = useCallback((id: string) => setView({ kind: "builder", draftId: id }), []);

  const deleteDraft = useCallback(
    async (id: string) => {
      if (!window.confirm(bt.deleteConfirm)) return;
      try {
        await fetch(`/api/bty/foundry/modules/${id}`, {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        /* fall through to reload */
      }
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      void loadDrafts();
    },
    [bt.deleteConfirm, loadDrafts],
  );

  const onBuilderExit = useCallback(() => {
    setView({ kind: "home" });
  }, []);

  const openControl = useCallback((eventId: string) => {
    setView({ kind: "control", eventId });
  }, []);

  const backHome = useCallback(() => setView({ kind: "home" }), []);

  if (view.kind === "create") {
    return (
      <CreateFoundryEventForm locale={loc} onCreated={onCreated} onCancel={backHome} />
    );
  }

  if (view.kind === "builder") {
    return <ModuleBuilderShell draftId={view.draftId} locale={loc} onExit={onBuilderExit} />;
  }

  if (view.kind === "control") {
    return (
      <FoundryEventControlRoom
        eventId={view.eventId}
        initialSnapshot={view.initial}
        locale={loc}
        onBack={backHome}
      />
    );
  }

  // home — non-host quiet state (no Create CTA, no permission-request CTA, no
  // "coming soon"; employees join via the public QR route). An unresolved auth/
  // network error stays a neutral hold, never mislabeled as non-host.
  if (access === "non_host") {
    return (
      <div className="btyFadeIn flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {t.eyebrow}
        </span>
        <p className="max-w-[18rem] text-base leading-7 text-white/80">{t.nonHostLead}</p>
        <p className="max-w-[18rem] text-sm leading-6 text-white/50">{t.nonHostSub}</p>
      </div>
    );
  }
  if (access === "loading") {
    return <div aria-hidden className="min-h-[40vh]" />;
  }

  const open = (events ?? []).filter((e) => e.status === "open");
  const past = (events ?? []).filter((e) => e.status === "closed");

  const builderEntry = (
    <BuilderEntry
      drafts={drafts}
      starting={starting}
      onStart={startNewDraft}
      onOpen={openDraft}
      onDelete={deleteDraft}
      bt={bt}
    />
  );

  // Empty (first-ever) events state — the guided builder leads; the direct event
  // create stays available beneath it.
  if (events !== null && events.length === 0) {
    return (
      <div className="btyFadeIn flex flex-col gap-7">
        {builderEntry}
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <p className="max-w-[16rem] text-base leading-7 text-white/55">{t.emptyLead}</p>
          <button
            type="button"
            onClick={() => setView({ kind: "create" })}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/80"
          >
            {t.createCta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="btyFadeIn flex flex-col gap-7">
      {builderEntry}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {t.eyebrow}
        </span>
        <button
          type="button"
          onClick={() => setView({ kind: "create" })}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80"
        >
          {t.createCta}
        </button>
      </div>

      {open.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
            {t.openHeader}
          </h2>
          {open.map((e) => (
            <EventRow key={e.id} summary={e} onOpen={openControl} t={t} />
          ))}
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
            {t.pastHeader}
          </h2>
          {past.map((e) => (
            <EventRow key={e.id} summary={e} onOpen={openControl} t={t} />
          ))}
        </section>
      ) : null}

      {events === null ? <div aria-hidden className="min-h-[30vh]" /> : null}
    </div>
  );
}

function EventRow({
  summary,
  onOpen,
  t,
}: {
  summary: ManagerEventSummary;
  onOpen: (id: string) => void;
  t: EventRoomsCopy;
}) {
  const isOpen = summary.status === "open";
  return (
    <button
      type="button"
      onClick={() => onOpen(summary.id)}
      className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className="min-w-0 truncate text-[0.98rem] font-medium text-white/90">
        {summary.title}
      </span>
      <span className="ml-3 shrink-0 text-xs text-white/45">
        {isOpen ? t.joinedCount(summary.joined_count) : t.closedTag}
      </span>
    </button>
  );
}

/** Compact relative-time hint for a draft row (client-only presentation). */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "·";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function DraftRow({
  draft,
  prominent,
  onOpen,
  onDelete,
  bt,
}: {
  draft: ClientDraftSummary;
  prominent?: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  bt: ModuleBuilderCopy;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 ${
        prominent ? "border-[#C9A66B]/40 bg-[#C9A66B]/[0.06]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(draft.id)}
        className="flex min-w-0 flex-col items-start text-left"
      >
        <span className="text-[0.95rem] font-medium text-white/90">{bt.continueDraft}</span>
        <span className="text-xs text-white/40">{bt.draftUpdated(relTime(draft.updated_at))}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(draft.id)}
        aria-label={bt.deleteDraft}
        className="shrink-0 text-xs text-white/40 hover:text-white/70"
      >
        {bt.deleteDraft}
      </button>
    </div>
  );
}

/** Builder entry: primary "Start new training" + resumable draft(s). */
function BuilderEntry({
  drafts,
  starting,
  onStart,
  onOpen,
  onDelete,
  bt,
}: {
  drafts: ClientDraftSummary[];
  starting: boolean;
  onStart: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  bt: ModuleBuilderCopy;
}) {
  const [topDraft, ...rest] = drafts;
  return (
    <section className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
        {bt.entryEyebrow}
      </span>
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="rounded-xl bg-[#C9A66B] px-6 py-3.5 text-base font-semibold text-[#0B1F3A] disabled:opacity-60"
      >
        {starting ? bt.starting : bt.startNew}
      </button>
      {topDraft ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm text-white/50">{bt.continueLead}</p>
          <DraftRow draft={topDraft} prominent onOpen={onOpen} onDelete={onDelete} bt={bt} />
          {rest.length > 0 ? (
            <>
              <h3 className="pt-1 text-xs uppercase tracking-[0.12em] text-white/40">{bt.otherDrafts}</h3>
              {rest.map((d) => (
                <DraftRow key={d.id} draft={d} onOpen={onOpen} onDelete={onDelete} bt={bt} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
