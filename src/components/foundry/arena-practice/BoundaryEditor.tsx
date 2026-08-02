"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONSTRAINTS_MAX,
  CONSTRAINT_STATEMENT_MAX,
  constraintId,
  type BoundaryConstraint,
  type BoundaryProvenance,
  type PracticeBoundary,
} from "@/domain/foundry/arena-draft/boundary";
import type { ArenaPracticeCopy } from "./arenaPracticeCopy";

/**
 * Host BOUNDARY CONFIRMATION surface (Slice 3.2I-R5B2).
 *
 * `regenerateArenaDraft` refuses a NEW-AUTHORITY draft with `boundary_confirmation_required`
 * unless a boundary exists and is confirmed. `saveDraftBoundary` — reached only through
 * `PUT /arena-drafts/[id]/boundary` — is the one writer of that state, and nothing in the product
 * called it. Every new Practice therefore stopped at a setup screen with no control on it. This
 * is the surface that was missing.
 *
 * It never confirms anything by itself. The Host assembles the rules; the SERVER validates them,
 * decides what `confirmed` means, and returns the canonical state that this screen then renders.
 * A local list is a proposal, never an authority — so this component reports what it has and
 * waits, and the parent replaces its input with whatever the server actually stored.
 *
 * `mode` is derived rather than asked: rules present → `judgment_with_constraints` (the mode that
 * REQUIRES at least one), none → `judgment`. Both are legitimate confirmed boundaries and the
 * server accepts either, so the Host answers a question about their training instead of picking
 * from an internal enum. `knowledge_check` stays valid server-side and is simply not reachable
 * from this surface yet.
 */

/** A rule while the Host is still editing. `key` is render identity only — never sent. */
type DraftRule = { key: string; statement: string; provenance: BoundaryProvenance };

const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/** The exact shape the server stores. Ids are derived from content + position, as suggestions are. */
export function toBoundary(rules: DraftRule[]): PracticeBoundary {
  const constraints: BoundaryConstraint[] = rules.map((r, i) => ({
    id: constraintId(i, r.statement.trim()),
    statement: r.statement.trim(),
    provenance: r.provenance,
  }));
  return {
    mode: constraints.length > 0 ? "judgment_with_constraints" : "judgment",
    confirmed: true,
    constraints,
  };
}

export function BoundaryEditor({
  boundary,
  suggestions,
  copy,
  saving = false,
  saveError = null,
  conflict = false,
  onConfirm,
}: {
  /** The canonical stored boundary, or undefined when none has ever been saved. */
  boundary: PracticeBoundary | undefined;
  /** Domain-derived candidates from this training. May legitimately be empty. */
  suggestions: BoundaryConstraint[];
  copy: ArenaPracticeCopy;
  saving?: boolean;
  /** A resolved, user-facing message. Never a raw server code. */
  saveError?: string | null;
  /** True after a stale-revision refusal: the Host's list is kept, not replaced. */
  conflict?: boolean;
  onConfirm: (boundary: PracticeBoundary) => void;
}) {
  const stored = useMemo(() => boundary?.constraints ?? [], [boundary]);
  const isConfirmed = boundary?.confirmed === true;

  const keySeq = useRef(0);
  const nextKey = useCallback(() => `r${++keySeq.current}`, []);

  const fromStored = useCallback(
    (): DraftRule[] => stored.map((c) => ({ key: nextKey(), statement: c.statement, provenance: c.provenance })),
    [stored, nextKey],
  );

  const [rules, setRules] = useState<DraftRule[]>(fromStored);
  const [editing, setEditing] = useState(!isConfirmed);
  const [newText, setNewText] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * Re-sync when the SERVER's boundary changes — a lazy initializer alone would keep showing the
   * pre-save list after the parent replaces the draft. A conflict is deliberately excluded: the
   * save was refused, so the Host's unsaved rules are still the work in progress and must survive.
   */
  const storedKey = useMemo(
    () => JSON.stringify([isConfirmed, stored.map((c) => [c.id, c.statement])]),
    [isConfirmed, stored],
  );
  const synced = useRef(storedKey);
  useEffect(() => {
    if (synced.current === storedKey || conflict) return;
    synced.current = storedKey;
    setRules(fromStored());
    setEditing(!isConfirmed);
    setNewText("");
    setEditKey(null);
    setLocalError(null);
  }, [storedKey, conflict, fromStored, isConfirmed]);

  /** Mirrors `validateBoundary` so the Host reads a sentence instead of a rejection code. */
  const reject = useCallback(
    (statement: string, ignoreKey?: string): string | null => {
      const s = statement.trim();
      if (s.length === 0) return copy.boundaryErrorEmpty;
      if (s.length > CONSTRAINT_STATEMENT_MAX) return copy.boundaryErrorTooLong(CONSTRAINT_STATEMENT_MAX);
      const key = normalize(s);
      if (rules.some((r) => r.key !== ignoreKey && normalize(r.statement) === key)) return copy.boundaryErrorDuplicate;
      return null;
    },
    [rules, copy],
  );

  const addStatement = useCallback(
    (statement: string, provenance: BoundaryProvenance): boolean => {
      if (rules.length >= CONSTRAINTS_MAX) {
        setLocalError(copy.boundaryErrorTooMany(CONSTRAINTS_MAX));
        return false;
      }
      const problem = reject(statement);
      if (problem) {
        setLocalError(problem);
        return false;
      }
      setLocalError(null);
      setRules((prev) => [...prev, { key: nextKey(), statement: statement.trim(), provenance }]);
      return true;
    },
    [rules.length, reject, copy, nextKey],
  );

  const unusedSuggestions = useMemo(() => {
    const taken = new Set(rules.map((r) => normalize(r.statement)));
    return suggestions.filter((s) => !taken.has(normalize(s.statement)));
  }, [suggestions, rules]);

  // ---------------------------------------------------------------- confirmed ----
  if (isConfirmed && !editing) {
    return (
      <section
        className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4"
        aria-labelledby="practice-boundary-heading"
      >
        <h2 id="practice-boundary-heading" className="text-sm font-medium text-white/80">
          {copy.boundaryConfirmedTitle}
        </h2>
        {stored.length === 0 ? (
          <p className="text-sm leading-6 text-white/55">{copy.boundaryRulesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stored.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm leading-6 text-white/85"
              >
                {c.statement}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            setRules(fromStored());
            setEditing(true);
          }}
          className="self-start rounded-lg border border-white/12 px-3 py-2 text-sm font-medium text-white/80"
        >
          {copy.boundaryChangeCta}
        </button>
      </section>
    );
  }

  // ------------------------------------------------------------------ editing ----
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4"
      aria-labelledby="practice-boundary-heading"
    >
      <header className="flex flex-col gap-1">
        <h2 id="practice-boundary-heading" className="text-base font-semibold leading-snug text-white">
          {copy.boundaryTitle}
        </h2>
        <p className="text-sm leading-6 text-white/60">{copy.boundaryLead}</p>
      </header>

      {conflict ? (
        <p
          role="status"
          className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/90"
        >
          {copy.boundaryConflict}
        </p>
      ) : null}

      {unusedSuggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-[0.12em] text-white/40">{copy.boundarySuggestedTitle}</h3>
          <p className="text-xs leading-5 text-white/45">{copy.boundarySuggestedHint}</p>
          <ul className="flex flex-col gap-2">
            {unusedSuggestions.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className="flex-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm leading-6 text-white/70">
                  {s.statement}
                </span>
                <button
                  type="button"
                  onClick={() => addStatement(s.statement, s.provenance)}
                  className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80"
                >
                  {copy.boundarySuggestionAdd}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs uppercase tracking-[0.12em] text-white/40">{copy.boundaryRulesTitle}</h3>
          <span aria-live="polite" className="text-xs text-white/45">
            {copy.boundaryCount(rules.length, CONSTRAINTS_MAX)}
          </span>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm leading-6 text-white/55">{copy.boundaryRulesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((r) =>
              editKey === r.key ? (
                <li key={r.key} className="flex flex-col gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-3">
                  <textarea
                    aria-label={copy.boundaryEditCta}
                    value={editText}
                    rows={2}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-sm leading-6 text-white/90 outline-none focus:border-[#C9A66B]/50"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const problem = reject(editText, r.key);
                        if (problem) return setLocalError(problem);
                        setLocalError(null);
                        setRules((prev) =>
                          prev.map((x) => (x.key === r.key ? { ...x, statement: editText.trim(), provenance: "manager_entered" } : x)),
                        );
                        setEditKey(null);
                      }}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/85"
                    >
                      {copy.boundaryEditSaveCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditKey(null);
                        setLocalError(null);
                      }}
                      className="rounded-lg px-3 py-1.5 text-sm text-white/50"
                    >
                      {copy.boundaryEditCancelCta}
                    </button>
                  </div>
                </li>
              ) : (
                <li key={r.key} className="flex items-start gap-2">
                  <span className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85">
                    {r.statement}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditKey(r.key);
                      setEditText(r.statement);
                      setLocalError(null);
                    }}
                    className="shrink-0 rounded-lg border border-white/12 px-2.5 py-2 text-xs text-white/70"
                  >
                    {copy.boundaryEditCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRules((prev) => prev.filter((x) => x.key !== r.key));
                      setLocalError(null);
                    }}
                    className="shrink-0 rounded-lg border border-white/12 px-2.5 py-2 text-xs text-white/70"
                  >
                    {copy.boundaryRemoveCta}
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        <textarea
          aria-label={copy.boundaryAddCta}
          value={newText}
          rows={2}
          placeholder={copy.boundaryNewPlaceholder}
          onChange={(e) => setNewText(e.target.value)}
          className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm leading-6 text-white/90 outline-none placeholder:text-white/30 focus:border-[#C9A66B]/50"
        />
        <button
          type="button"
          onClick={() => {
            if (addStatement(newText, "manager_entered")) setNewText("");
          }}
          className="self-start rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80"
        >
          {copy.boundaryAddCta}
        </button>

        <p className="text-xs leading-5 text-white/45">{copy.boundaryOptionalHint}</p>
      </div>

      {localError ? (
        <p role="alert" className="text-xs leading-5 text-rose-200/90">
          {localError}
        </p>
      ) : null}
      {saveError ? (
        <p role="alert" className="text-xs leading-5 text-rose-200/90">
          {saveError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving || editKey !== null}
        onClick={() => {
          if (rules.length > CONSTRAINTS_MAX) return setLocalError(copy.boundaryErrorTooMany(CONSTRAINTS_MAX));
          for (const r of rules) {
            const problem = reject(r.statement, r.key);
            if (problem) return setLocalError(problem);
          }
          setLocalError(null);
          onConfirm(toBoundary(rules));
        }}
        className="self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
      >
        {saving ? copy.boundarySaving : copy.boundaryConfirmCta}
      </button>
    </section>
  );
}
