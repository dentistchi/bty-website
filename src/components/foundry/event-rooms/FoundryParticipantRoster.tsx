"use client";

import type { EventRoomsCopy } from "./copy";
import type { ManagerParticipant, ManagerRosterStatus } from "./types";

/**
 * The live roster. Rows are ordered joined_at asc (server-sorted). Each row shows
 * the participant's TRAINING STATUS only — the manager never sees the response
 * text (privacy). A newly arrived name settles in quietly (btySettle) — no
 * pulsing count, no celebration. Remove is only offered while the event is open.
 */
function statusLabel(status: ManagerRosterStatus, t: EventRoomsCopy): string {
  switch (status) {
    case "complete":
      return t.status_complete;
    case "response_pending":
      return t.status_response_pending;
    case "watching":
      return t.status_watching;
    default:
      return t.status_joined;
  }
}

export function FoundryParticipantRoster({
  participants,
  eventOpen,
  onRemove,
  removingId,
  t,
}: {
  participants: ManagerParticipant[];
  eventOpen: boolean;
  onRemove: (id: string) => void;
  removingId: string | null;
  t: EventRoomsCopy;
}) {
  if (participants.length === 0) {
    return <p className="text-sm text-white/45">{t.rosterEmpty}</p>;
  }
  return (
    <ul className="flex list-none flex-col gap-1.5 p-0" role="list">
      {participants.map((p) => {
        const complete = p.training_status === "complete";
        return (
          <li
            key={p.id}
            className="btySettle flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3"
          >
            <span className="min-w-0 flex-1 truncate text-[0.95rem] text-white/90">{p.display_name}</span>
            <span
              className={
                "shrink-0 text-xs " + (complete ? "text-[#C9A66B]/90" : "text-white/45")
              }
            >
              {statusLabel(p.training_status, t)}
            </span>
            {eventOpen ? (
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                disabled={removingId === p.id}
                className="shrink-0 text-xs text-white/30 transition-colors hover:text-white/70 disabled:opacity-50"
              >
                {t.remove}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
