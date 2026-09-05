"use client";

import { useCallback, useMemo, useState } from "react";
import type { BoundaryConstraint } from "@/domain/foundry/arena-draft/boundary";
import type { PracticeReadiness } from "@/domain/foundry/arena-draft/practiceReadiness";
import { inactiveBoundaries } from "@/domain/foundry/arena-draft/practiceReadiness";
import type { ArenaPracticeCopy } from "./arenaPracticeCopy";

/**
 * Host ACTIVE-BOUNDARY selector (Slice 3.2I-R5B1A.1-R2.23D).
 *
 * R2.23C made generation block once four or more boundaries are confirmed, and left the Host with a
 * static "not ready yet" panel — no boundaries shown, no way forward. This is the surface that
 * clears it.
 *
 * It never decides anything. Nothing is preselected, nothing is ranked, nothing is reordered, and
 * every confirmed statement is rendered exactly as the Manager wrote it — including the ones not
 * chosen, which stay visible because they are not unimportant, they are simply for another
 * situation. Internal ids never reach the screen.
 *
 * Selection is capped by PREVENTING the fourth choice with inline guidance, not by silently
 * dropping an earlier one: quietly replacing a Host's decision is exactly the behaviour the whole
 * contract exists to forbid.
 */
export function BoundaryScopePanel({
  readiness,
  copy,
  onConfirm,
  saving = false,
  saveError = false,
}: {
  readiness: PracticeReadiness;
  copy: ArenaPracticeCopy;
  /** Submits the exact chosen ids. The server remains the authority on what is stored. */
  onConfirm: (activeBoundaryIds: string[]) => void;
  saving?: boolean;
  saveError?: boolean;
}) {
  const { available, active, maxActive, selectionRequired, state } = readiness;
  // A confirmed scope opens read-only; "Change selection" reopens it with the stored choice intact.
  const [editing, setEditing] = useState(!readiness.confirmed);
  const [selected, setSelected] = useState<string[]>(() => active.map((c) => c.id));
  const [maxNotice, setMaxNotice] = useState(false);

  const atMax = selected.length >= maxActive;
  const inactive = useMemo(() => inactiveBoundaries(readiness), [readiness]);

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        if (prev.includes(id)) {
          setMaxNotice(false);
          return prev.filter((x) => x !== id);
        }
        if (prev.length >= maxActive) {
          // Prevent, never replace. The Host removes one deliberately.
          setMaxNotice(true);
          return prev;
        }
        setMaxNotice(false);
        return [...prev, id];
      });
    },
    [maxActive],
  );

  // --- 0 available: nothing to choose, and no selector to show ---------------
  if (available.length === 0) return null;

  // --- 1-3 available: every one governs this situation. No decision is asked. -
  if (!selectionRequired) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4" aria-labelledby="practice-boundaries-heading">
        <h2 id="practice-boundaries-heading" className="text-sm font-medium text-white/80">
          {copy.boundaryScopeAllActive}
        </h2>
        <ul className="flex flex-col gap-2">
          {available.map((c) => (
            <li key={c.id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/80">
              {c.statement}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // --- 4+ available: the Host chooses --------------------------------------
  const notice =
    state === "active_boundary_set_changed"
      ? copy.boundaryScopeChangedNotice
      : state === "unknown_active_boundary"
        ? copy.boundaryScopeUnknownNotice
        : null;

  if (!editing) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4" aria-labelledby="practice-boundaries-heading">
        <h2 id="practice-boundaries-heading" className="text-sm font-medium text-white/80">
          {copy.boundaryScopeConfirmed}
        </h2>
        <ul className="flex flex-col gap-2">
          {active.map((c) => (
            <li key={c.id} className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-sm leading-6 text-white/85">
              {c.statement}
            </li>
          ))}
        </ul>
        {inactive.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label={copy.boundaryScopeInactive}>
            {inactive.map((c) => (
              <li key={c.id} className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm leading-6 text-white/45">
                {c.statement}
                <span className="sr-only"> — {copy.boundaryScopeInactive}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs leading-5 text-white/50">{copy.boundaryScopeAnother}</p>
        <button
          type="button"
          onClick={() => {
            setSelected(active.map((c) => c.id));
            setEditing(true);
          }}
          className="self-start rounded-lg border border-white/[0.12] px-3 py-2 text-sm font-medium text-white/80"
        >
          {copy.boundaryScopeChange}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4" aria-labelledby="practice-boundaries-heading">
      <header className="flex flex-col gap-1">
        <h2 id="practice-boundaries-heading" className="text-base font-semibold leading-snug text-white">
          {copy.boundaryScopeTitle}
        </h2>
        <p className="text-sm leading-6 text-white/60">{copy.boundaryScopeHint}</p>
      </header>

      {notice ? (
        <p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/90">
          {notice}
        </p>
      ) : null}

      <p aria-live="polite" className="text-xs font-medium text-white/60">
        {copy.boundaryScopeCount(selected.length, maxActive)}
      </p>

      <ul className="flex flex-col gap-2">
        {available.map((c: BoundaryConstraint) => {
          const isSelected = selected.includes(c.id);
          // Full-row control. The statement IS the accessible name — no internal id is exposed.
          return (
            <li key={c.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                // A row that cannot currently be added is still reachable and readable; it simply
                // explains why rather than pretending to be absent.
                aria-describedby={!isSelected && atMax ? "practice-boundaries-max" : undefined}
                onClick={() => toggle(c.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm leading-6 ${
                  isSelected ? "border-white/25 bg-white/[0.07] text-white" : "border-white/[0.08] bg-white/[0.02] text-white/70"
                }`}
              >
                {c.statement}
              </button>
            </li>
          );
        })}
      </ul>

      {maxNotice || atMax ? (
        <p id="practice-boundaries-max" role="status" className="text-xs leading-5 text-white/55">
          {copy.boundaryScopeMaxReached}
        </p>
      ) : null}

      <p className="text-xs leading-5 text-white/50">{copy.boundaryScopeAnother}</p>

      {saveError ? (
        <p role="alert" className="text-xs leading-5 text-rose-200/90">
          {copy.boundaryScopeSaveError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={selected.length === 0 || saving}
        onClick={() => onConfirm(selected)}
        className="self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
      >
        {saving ? copy.boundaryScopeSaving : copy.boundaryScopeConfirm}
      </button>
    </section>
  );
}
