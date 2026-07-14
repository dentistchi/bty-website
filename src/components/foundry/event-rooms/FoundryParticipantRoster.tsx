"use client";

import type { EventRoomsCopy } from "./copy";
import type { ManagerParticipant } from "./types";

/**
 * The live roster. Rows are ordered joined_at asc (server-sorted). A newly
 * arrived name settles in quietly (btySettle) — no pulsing count, no celebration.
 * Remove is only offered while the event is open.
 */
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
      {participants.map((p) => (
        <li
          key={p.id}
          className="btySettle flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3"
        >
          <span className="min-w-0 truncate text-[0.95rem] text-white/90">{p.display_name}</span>
          {eventOpen ? (
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              disabled={removingId === p.id}
              className="shrink-0 text-xs text-white/35 transition-colors hover:text-white/70 disabled:opacity-50"
            >
              {t.remove}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
