"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import { BUILDER_STEP_MAX } from "@/domain/foundry/module/module-builder";
import { MODULE_BUILDER_COPY, type ModuleBuilderCopy } from "./moduleBuilderCopy";
import type { ManagerEventSummary, ManagerSnapshot } from "./types";
import type { ClientDraftSummary } from "@/lib/bty/foundry/events/moduleClient";
import { CreateFoundryEventForm } from "./CreateFoundryEventForm";
import { FoundryEventControlRoom } from "./FoundryEventControlRoom";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import FoundryHistoryArchive from "./FoundryHistoryArchive";
import FoundryRequiredLearning from "./FoundryRequiredLearning";
import { ArenaPracticeFlow } from "../arena-practice/ArenaPracticeFlow";
import { LearnDoors } from "./LearnDoors";
import type { HostFocusSection, HostReturnTab } from "@/components/app-shell/hostDeepLink";

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
  | { kind: "builder"; draftId: string; initialView?: "review" }
  | { kind: "history" }
  | { kind: "arena-practice"; eventId: string }
  | {
      kind: "control";
      eventId: string;
      initial?: ManagerSnapshot | null;
      focusSection?: HostFocusSection;
      focusId?: string;
      /** 3.2G-R1: set ONLY when this room was opened from a Today-tagged deep link, so Back returns
       *  to Today. Absent for any other entry (event list, re-entry) → existing Learn-home back. */
      returnTab?: HostReturnTab;
    };

/**
 * 3.2G-R3 — atomic control-room handoff. When a Host-attention target is present AT MOUNT (the
 * in-shell Today handoff sets the event + Learn tab in the SAME commit; a direct URL sets them on the
 * shell's mount parse), the VERY FIRST render must already be the control room — never the Foundry
 * home. Initializing view=home and switching in a post-render effect painted the Learn root for
 * ~0.75s (the R2 device flash). Pure so it can be unit-tested as the root-cause detector.
 */
export function computeInitialFoundryView(
  initialEventId: string | null,
  initialFocusSection: HostFocusSection | null,
  initialFocusId: string | null,
  initialReturnTab: HostReturnTab | null,
  initialDraftId: string | null = null,
  initialDraftView: "review" | null = null,
): View {
  /*
    A draft target opens the Builder on the FIRST committed render — the same atomic handoff
    the control room already gets, so there is no Foundry-home flash and no second navigation
    (Slice 3.2L-R11.4E).
  */
  if (initialDraftId) return { kind: "builder", draftId: initialDraftId, initialView: initialDraftView ?? undefined };
  if (initialEventId) {
    return {
      kind: "control",
      eventId: initialEventId,
      focusSection: initialFocusSection ?? undefined,
      focusId: initialFocusId ?? undefined,
      returnTab: initialReturnTab ?? undefined,
    };
  }
  return { kind: "home" };
}

export default function FoundryEventRooms({
  locale,
  onOpenReview = () => {},
  onOpenMyLearning = () => {},
  onOpenEvent,
  onOpenMyEvents,
  initialEventId = null,
  initialDraftId = null,
  initialDraftView = null,
  initialFocusSection = null,
  initialFocusId = null,
  initialReturnTab = null,
  onReturnToOrigin,
  onDraftReviewLeft = () => {},
  onDraftClosed = () => {},
  onInitialConsumed = () => {},
}: {
  locale: string;
  /** Open the authenticated completion review for a completed assignment (in-shell). */
  onOpenReview?: (assignmentId: string) => void;
  /** Open the learner's own My Learning / private reflection history (in-shell, Slice 3.1B-3H). */
  onOpenMyLearning?: () => void;
  /** Open the in-shell Reality Event create view (Slice 3.2D-EVENT-R1). */
  onOpenEvent?: () => void;
  /** Open the in-shell Host "My events" participation view (Slice 3.2E-EVENT-HOST). */
  onOpenMyEvents?: () => void;
  /** Host Leadership Attention deep link (Slice 3.1B-3L): open this OWNED event's control room on
   *  mount, focused on the given section/row. Null = normal Foundry home. Server owner-scopes the
   *  control-room reads; a not-owned event simply resolves to an empty room (no disclosure). */
  initialEventId?: string | null;
  /** 3.2L-R11.4E: open THIS owned draft directly, optionally at its review. Presentation only. */
  initialDraftId?: string | null;
  initialDraftView?: "review" | null;
  initialFocusSection?: HostFocusSection | null;
  initialFocusId?: string | null;
  /** 3.2G-R1: bounded return origin for the deep-linked control room. "today" → Back returns to Today
   *  via {@link onReturnToOrigin}; null/absent → the existing Learn-home back is used. */
  initialReturnTab?: HostReturnTab | null;
  /** 3.2G-R1: called when the deep-linked (Today-origin) control room's Back is pressed, so the shell
   *  switches back to the Today tab in-shell (no reload, no duplicate history entry). */
  onReturnToOrigin?: () => void;
  /** Called once after the initial deep-linked control room is opened, so the shell clears the
   *  one-shot params (a later tab re-entry then returns to the Foundry home list). */
  onInitialConsumed?: () => void;
  /** 3.2L-R11.4E-R2: the Host moved off the deep-linked review — `view=review` stopped being true. */
  onDraftReviewLeft?: () => void;
  /** 3.2L-R11.4E-R2: the Builder closed — nothing about that draft describes the page any more. */
  onDraftClosed?: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[loc];
  const bt: ModuleBuilderCopy = MODULE_BUILDER_COPY[loc];

  // 3.2G-R3: lazy-initialize the view FROM the pending target so the first render is already the
  // control room (atomic handoff — no Foundry-home flash). The effect below still covers the
  // cold-navigation race (target arriving as a later prop UPDATE) and consumes the one-shot params.
  const [view, setView] = useState<View>(() =>
    computeInitialFoundryView(initialEventId, initialFocusSection, initialFocusId, initialReturnTab, initialDraftId ?? null, initialDraftView ?? null),
  );

  // Host Leadership Attention deep link (Slice 3.1B-3L; 3.2G-R3): open the EXACT owned control room
  // whenever the target is available — atomically at mount via the lazy initializer above, OR as a
  // later prop UPDATE (the cold-navigation race where the tab flips before the shell's event/section/
  // focus propagate). The effect runs EXACTLY ONCE (ref-guarded); its functional updater is a no-op
  // when the lazy initializer already opened the same control room (React bails on the same
  // reference → no redundant render / no flash), but still consumes the one-shot params so the shell
  // clears them (a later tab re-entry then returns to the Foundry home). Server owner-scopes the
  // control-room reads, so a not-owned/invalid event resolves to an empty room (no disclosure).
  const deepLinkConsumedRef = useRef(false);
  useEffect(() => {
    if (initialEventId && !deepLinkConsumedRef.current) {
      deepLinkConsumedRef.current = true;
      setView((cur) =>
        cur.kind === "control" && cur.eventId === initialEventId
          ? cur
          : computeInitialFoundryView(initialEventId, initialFocusSection, initialFocusId, initialReturnTab),
      );
      onInitialConsumed();
    }
  }, [initialEventId, initialFocusSection, initialFocusId, initialReturnTab, onInitialConsumed]);
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

  // Create a new version of a published Guided training (Slice 3.2C-B1). The server
  // resolves the source draft + creates OR resumes exactly one revision draft in the
  // SAME Program; we then open the existing Builder on it (prior answers prefilled).
  // Guarded so a double-tap opens exactly one. The action is server-gated (revisable),
  // so a non-ok response is a rare race — we simply stay in the control room.
  const versioningRef = useRef(false);
  const createNewVersion = useCallback(async (eventId: string) => {
    if (versioningRef.current) return;
    versioningRef.current = true;
    try {
      const res = await fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/revisions`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { draftId?: string };
        if (data.draftId) setView({ kind: "builder", draftId: data.draftId });
      }
    } catch {
      /* stay on the control room; the action re-enables */
    } finally {
      versioningRef.current = false;
    }
  }, []);

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

  const onBuilderExit = useCallback((result?: { gone?: boolean; publishedEventId?: string }) => {
    onDraftClosed();
    // Publishing hands off straight to the new event's control room.
    if (result?.publishedEventId) {
      setView({ kind: "control", eventId: result.publishedEventId });
      return;
    }
    setView({ kind: "home" });
  }, [onDraftClosed]);

  const openControl = useCallback((eventId: string) => {
    setView({ kind: "control", eventId });
  }, []);

  const backHome = useCallback(() => setView({ kind: "home" }), []);

  /*
    "Open my learning →" OPENS MY LEARNING (Slice 3.2R-R8D-R2).

    It used to call `scrollIntoView("#learn-required")` — correct in 3.2C-B3A.1, when "my
    learning" meant the required-training section further down THIS surface. B3A.2C then made My
    Learning its own view, removed the duplicate pill from Required Learning, and recorded that
    "the LearnDoors door owns the entry" — but the door kept the scroll. Worse, `#learn-required`
    renders directly beneath the doors, so on a phone it is usually already on screen and a
    smooth scroll to it produces no visible change at all. The button worked perfectly and did
    nothing, which is why it read as dead.

    `onOpenMyLearning` is the shell's single authority for this destination — the same callback
    behind the Me row and the Learn header, and the in-shell equivalent of the `?view=my-learning`
    URL the post-claim "Continue to BTY" anchor uses. It was already threaded into this component
    and passed straight through to a child that no longer used it.
  */
  const openLearning = onOpenMyLearning;
  const learnDoors = (
    <LearnDoors locale={loc} canCreate={access === "host"} onOpenLearning={openLearning} onCreate={startNewDraft} onOpenEvent={onOpenEvent} onOpenMyEvents={onOpenMyEvents} />
  );
  const requiredLearning = (
    <div id="learn-required">
      {/* No `onOpenMyLearning` here: B3A.2C removed this child's My-Learning pill and the prop
          has been unused since. Passing it advertised a second plausible owner of the entry,
          which is how the door above kept a stale handler through that refactor. */}
      <FoundryRequiredLearning locale={loc} onOpenReview={onOpenReview} />
    </div>
  );

  if (view.kind === "create") {
    return (
      <CreateFoundryEventForm locale={loc} onCreated={onCreated} onCancel={backHome} />
    );
  }

  if (view.kind === "builder") {
    // `key` forces a full remount when the Host switches drafts. Without it React reuses
    // the instance, and the previous draft's answers — and therefore its visible identity —
    // would render for the moment before the new draft finishes restoring.
    return (
      <ModuleBuilderShell
        key={view.draftId}
        draftId={view.draftId}
        locale={loc}
        initialView={view.initialView}
        onReviewViewLeft={onDraftReviewLeft}
        onExit={onBuilderExit}
      />
    );
  }

  if (view.kind === "history") {
    return <FoundryHistoryArchive locale={loc} onBack={backHome} />;
  }

  if (view.kind === "arena-practice") {
    return (
      <ArenaPracticeFlow
        eventId={view.eventId}
        locale={loc}
        onBack={() => setView({ kind: "control", eventId: view.eventId })}
      />
    );
  }

  if (view.kind === "control") {
    return (
      <FoundryEventControlRoom
        eventId={view.eventId}
        initialSnapshot={view.initial}
        locale={loc}
        // 3.2G-R1: origin-aware Back. Opened from a Today follow-up (returnTab="today") → return to
        // Today in-shell; every other entry (event list, re-entry, direct) → existing Learn-home back.
        onBack={view.returnTab === "today" && onReturnToOrigin ? onReturnToOrigin : backHome}
        onCreateArenaPractice={() => setView({ kind: "arena-practice", eventId: view.eventId })}
        onCreateNewVersion={() => createNewVersion(view.eventId)}
        focusSection={view.focusSection}
        focusId={view.focusId}
      />
    );
  }

  // home — non-host quiet state (no Create CTA, no permission-request CTA, no
  // "coming soon"; employees join via the public QR route). An unresolved auth/
  // network error stays a neutral hold, never mislabeled as non-host.
  if (access === "non_host") {
    // A non-host learner's Foundry home: their required-learning surface leads, with
    // the quiet host-pointer copy retained beneath it (calmer, no longer full-height).
    return (
      // B3A.2C: a non-host learner's Learn surface is just the two-door entry + their
      // required learning. The "FOUNDRY / Training rooms are opened by authorized
      // hosts / Scan an invitation QR" host-pointer block is removed (it explained
      // authorization instead of offering a useful action). QR deep links are unchanged.
      <div className="btyFadeIn flex flex-col gap-8">
        {learnDoors}
        {requiredLearning}
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
      onQuickEvent={() => setView({ kind: "create" })}
      quickLabel={t.createCta}
      quickNote={t.createQuickNote}
      bt={bt}
    />
  );

  // Empty (first-ever) events state — the guided builder (with its inline quick-
  // event path) is the whole surface. A host is also a learner, so the required-
  // learning surface leads here too.
  if (events !== null && events.length === 0) {
    return (
      <div className="btyFadeIn flex flex-col gap-9">
        {learnDoors}
        {requiredLearning}
        {builderEntry}
      </div>
    );
  }

  return (
    <div className="btyFadeIn flex flex-col gap-9">
      {learnDoors}
      {requiredLearning}
      {builderEntry}
      {/* B3A.2C: the "FOUNDRY" heading is removed from the Learn surface; the
          Host's own trainings appear under their plain Open/Past section headers. */}

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
          {past.slice(0, 3).map((e) => (
            <EventRow key={e.id} summary={e} onOpen={openControl} t={t} />
          ))}
          {/* First-class read-only History archive door (deterministic ordering,
              token-free, aggregate counts) — always available, not just past 3. */}
          <button
            type="button"
            onClick={() => setView({ kind: "history" })}
            className="self-start pt-1 text-xs text-white/50 hover:text-white/75"
          >
            {t.pastViewAll} →
          </button>
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

/** Localized relative "edited" label for a draft card. */
function editedLabel(iso: string, bt: ModuleBuilderCopy): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return bt.relJustNow;
  const m = Math.floor(s / 60);
  if (m < 60) return bt.relMin(m);
  const h = Math.floor(m / 60);
  if (h < 24) return bt.relHour(h);
  return bt.relDay(Math.floor(h / 24));
}

const SWIPE_REVEAL = 88;

/**
 * A draft card with left-swipe-to-delete (mobile) plus an always-available
 * accessible overflow delete (non-swipe fallback). Only one row may be swiped
 * open at a time (parent owns the open id).
 */
function SwipeDraftRow({
  draft,
  prominent,
  isOpen,
  onSwipeOpen,
  onSwipeClose,
  onOpen,
  onDelete,
  bt,
}: {
  draft: ClientDraftSummary;
  prominent?: boolean;
  isOpen: boolean;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  bt: ModuleBuilderCopy;
}) {
  const startX = useRef<number | null>(null);
  const [dragDx, setDragDx] = useState(0);

  const title = draft.title?.trim() ? draft.title : bt.untitled;
  // Clamped to the INPUT steps — Review is not "a step of" anything. 8 since 3.2P-R3.6-R1.
  const stepN = Math.min(Math.max(draft.current_step, 1), BUILDER_STEP_MAX - 1);
  const subtitle = `${bt.stepProgress(stepN)} · ${bt.editedRel(editedLabel(draft.updated_at, bt))}`;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
    setDragDx(isOpen ? -SWIPE_REVEAL : 0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const raw = (e.touches[0]?.clientX ?? 0) - startX.current + (isOpen ? -SWIPE_REVEAL : 0);
    setDragDx(Math.min(0, Math.max(raw, -SWIPE_REVEAL)));
  };
  const onTouchEnd = () => {
    const dragging = startX.current != null;
    startX.current = null;
    if (!dragging) return;
    if (dragDx < -SWIPE_REVEAL / 2) onSwipeOpen();
    else onSwipeClose();
  };
  const translate = startX.current != null ? dragDx : isOpen ? -SWIPE_REVEAL : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${
        prominent ? "border-[#C9A66B]/40" : "border-white/10"
      }`}
    >
      {isOpen ? (
        <button
          type="button"
          aria-label={bt.deleteAction}
          onClick={() => onDelete(draft.id)}
          className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-600 text-sm font-semibold text-white"
        >
          {bt.deleteAction}
        </button>
      ) : null}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${translate}px)` }}
        className={`relative flex items-center justify-between gap-3 px-4 py-3.5 transition-transform ${
          prominent ? "bg-[#C9A66B]/[0.06]" : "bg-white/[0.03]"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpen(draft.id)}
          className="flex min-w-0 flex-col items-start text-left"
        >
          <span className="max-w-full truncate text-[0.95rem] font-medium text-white/90">{title}</span>
          <span className="text-xs text-white/40">{subtitle}</span>
        </button>
        <button
          type="button"
          aria-label={bt.deleteDraft}
          onClick={() => onDelete(draft.id)}
          className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-white/35 hover:text-white/70"
        >
          ⋯
        </button>
      </div>
    </div>
  );
}

/** Builder entry: primary "Create team training", a discoverable secondary
 *  quick-event path directly beneath it, then resumable draft(s). */
function BuilderEntry({
  drafts,
  starting,
  onStart,
  onOpen,
  onDelete,
  onQuickEvent,
  quickLabel,
  quickNote,
  bt,
}: {
  drafts: ClientDraftSummary[];
  starting: boolean;
  onStart: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onQuickEvent: () => void;
  quickLabel: string;
  quickNote: string;
  bt: ModuleBuilderCopy;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [topDraft, ...rest] = drafts;
  const openBuilder = (id: string) => {
    setOpenId(null);
    onOpen(id);
  };
  const startNew = () => {
    setOpenId(null);
    onStart();
  };
  const row = (d: ClientDraftSummary, prominent: boolean) => (
    <SwipeDraftRow
      key={d.id}
      draft={d}
      prominent={prominent}
      isOpen={openId === d.id}
      onSwipeOpen={() => setOpenId(d.id)}
      onSwipeClose={() => setOpenId((prev) => (prev === d.id ? null : prev))}
      onOpen={openBuilder}
      onDelete={onDelete}
      bt={bt}
    />
  );
  void startNew; // create-new is owned by the top "Create training" door (B3A.1)
  return (
    <section className="flex flex-col gap-3">
      {/* Quick-event path (create-new lives in the top door now, B3A.1). */}
      <div className="mt-1 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
        <span className="min-w-0 text-sm text-white/50">{bt.quickLead}</span>
        <button
          type="button"
          onClick={onQuickEvent}
          className="shrink-0 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80"
          aria-describedby="quick-event-note"
        >
          {quickLabel}
        </button>
      </div>
      <span id="quick-event-note" className="-mt-1 self-end text-[0.68rem] text-white/35">
        {quickNote}
      </span>

      {topDraft ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm text-white/50">{bt.continueLead}</p>
          {row(topDraft, true)}
          {rest.length > 0 ? (
            <>
              <h3 className="pt-1 text-xs uppercase tracking-[0.12em] text-white/40">{bt.otherDrafts}</h3>
              {rest.map((d) => row(d, false))}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
