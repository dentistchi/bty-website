"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerEventSummary, ManagerSnapshot } from "./types";
import { CreateFoundryEventForm } from "./CreateFoundryEventForm";
import { FoundryEventControlRoom } from "./FoundryEventControlRoom";

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
  | { kind: "control"; eventId: string; initial?: ManagerSnapshot | null };

export default function FoundryEventRooms({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[loc];

  const [view, setView] = useState<View>({ kind: "home" });
  const [events, setEvents] = useState<ManagerEventSummary[] | null>(null);
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

  useEffect(() => {
    if (view.kind === "home") void loadList();
  }, [view.kind, loadList]);

  const onCreated = useCallback((snapshot: ManagerSnapshot) => {
    setView({ kind: "control", eventId: snapshot.event.id, initial: snapshot });
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

  // Empty (first-ever) state — quiet, single CTA.
  if (events !== null && events.length === 0) {
    return (
      <div className="btyFadeIn flex min-h-[55vh] flex-col items-center justify-center gap-6 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {t.eyebrow}
        </span>
        <p className="max-w-[16rem] text-lg leading-7 text-white/80">{t.emptyLead}</p>
        <button
          type="button"
          onClick={() => setView({ kind: "create" })}
          className="rounded-xl bg-[#C9A66B] px-6 py-3.5 text-base font-semibold text-[#0B1F3A]"
        >
          {t.createCta}
        </button>
      </div>
    );
  }

  return (
    <div className="btyFadeIn flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {t.eyebrow}
        </span>
        <button
          type="button"
          onClick={() => setView({ kind: "create" })}
          className="rounded-lg bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
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
