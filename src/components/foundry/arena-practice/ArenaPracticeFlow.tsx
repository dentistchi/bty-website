"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActionDecisionChoice,
  ArenaScenarioDraft,
  AvoidancePressureSeed,
  HardestWhenOption,
  ScenarioDraftChoice,
} from "@/domain/foundry/arena-draft/types";
import type { AudienceType } from "@/domain/foundry/module/module-builder";
import { ARENA_PRACTICE_COPY, AUDIENCE_LABELS, type ArenaPracticeCopy, type Locale } from "./arenaPracticeCopy";
import { ArenaScenarioPreview } from "./ArenaScenarioPreview";
import { ArenaPracticePlayer } from "@/components/bty-arena/practice/ArenaPracticePlayer";
import { BoundaryScopePanel } from "./BoundaryScopePanel";
import { BoundaryEditor } from "./BoundaryEditor";
import { resolvePracticeReadiness, type PracticeReadiness } from "@/domain/foundry/arena-draft/practiceReadiness";
import {
  CONSTRAINTS_MAX,
  CONSTRAINT_STATEMENT_MAX,
  suggestConstraints,
  type PracticeBoundary,
} from "@/domain/foundry/arena-draft/boundary";
import type { PracticeBoundaryScope } from "@/domain/foundry/arena-draft/boundaryScope";
import { resolveEditorActions } from "./editorActions";
import { AutoTextarea } from "./AutoTextarea";

/**
 * R2 — one shared button scale for the editor's action region. Every control is a full-width,
 * comfortable tap target at the same height, so no two actions can be confused for one another on
 * a 390pt screen, and none of them can shrink another by sharing a row.
 */
const ACTION_BASE = "min-h-[3rem] rounded-xl px-5 py-3 text-[0.95rem] font-semibold";
const PRIMARY_ACTION = `${ACTION_BASE} bg-[#C9A66B] text-[#0B1F3A] disabled:opacity-60`;
const SECONDARY_ACTION = `${ACTION_BASE} border border-[#C9A66B]/50 text-[#C9A66B] disabled:opacity-45`;
const TERTIARY_ACTION = "min-h-[2.75rem] px-2 py-2 text-xs text-white/45 hover:text-white/75 disabled:opacity-40";

/**
 * Foundry Guided Arena Builder — the in-app, iPhone-first guided flow.
 *
 * Source summary → Q1 → Q2 → generate → editor/preview. One dominant question per
 * screen; no dashboard. All rules (source binding, validity) are enforced
 * server-side — this only renders, collects input, and shows honest loading/saved/
 * error states. A provider or save failure never loses the host's answers.
 */

type SourceSummary = {
  event_title: string;
  event_status: "open" | "closed";
  module_version: number;
  arena_recommended: boolean;
  capability: string | null;
  expected_behavior: string | null;
  success_evidence: string | null;
  audience_type: AudienceType | null;
  audience_detail: string | null;
  learning_needs: string[];
  hardest_when_options: HardestWhenOption[];
  avoidance_seeds: AvoidancePressureSeed[];
};

type ClientDraft = {
  id: string;
  scenario_draft: ArenaScenarioDraft | null;
  generation_source: "ai" | "template" | "edited" | null;
  revision: number;
  /** R2.23D — the setup surface needs the confirmed boundary and the Host's active selection. */
  guided_answers?: {
    /**
     * R5B2 — the lifecycle discriminator. Its PRESENCE is what makes the server refuse generation
     * without a confirmed boundary, so readiness cannot be honest without reading it.
     */
    practiceSetupVersion?: number;
    practiceBoundary?: PracticeBoundary;
    practiceBoundaryScope?: PracticeBoundaryScope;
  };
};

type Phase = "loading" | "error" | "gone" | "no_module" | "summary" | "setup" | "q1" | "q2" | "generating" | "editor";
type SaveState = "idle" | "saving" | "saved" | "error";

export function ArenaPracticeFlow({
  eventId,
  locale,
  onBack,
}: {
  eventId: string;
  locale: string;
  onBack: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = ARENA_PRACTICE_COPY[loc];

  const [phase, setPhase] = useState<Phase>("loading");
  const [source, setSource] = useState<SourceSummary | null>(null);

  const [q1, setQ1] = useState<HardestWhenOption | null>(null);
  const [q1Custom, setQ1Custom] = useState("");
  const [q2, setQ2] = useState("");

  const [draftId, setDraftId] = useState<string | null>(null);
  const [editable, setEditable] = useState<ArenaScenarioDraft | null>(null);
  const [genSource, setGenSource] = useState<"ai" | "template" | "edited" | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [genError, setGenError] = useState(false);
  // R2.23D — the setup surface reads readiness from ONE domain resolver, never from local rules.
  const [setupDraft, setSetupDraft] = useState<ClientDraft | null>(null);
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeSaveError, setScopeSaveError] = useState(false);
  // R5B2 — boundary confirmation lives on the same setup surface.
  const [boundarySaving, setBoundarySaving] = useState(false);
  const [boundarySaveError, setBoundarySaveError] = useState<string | null>(null);
  const [boundaryConflict, setBoundaryConflict] = useState(false);
  const [boundaryInvalidated, setBoundaryInvalidated] = useState(false);
  const [setupGenError, setSetupGenError] = useState(false);

  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  // 3.0B — publish + test-in-arena
  const [revision, setRevision] = useState<number>(0);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "stale" | "error">("idle");
  const [publishedPracticeId, setPublishedPracticeId] = useState<string | null>(null);
  // The published practice id for the CURRENT saved revision, if already live (so a
  // host who re-opens an already-published draft immediately sees + can open it).
  const [livePracticeId, setLivePracticeId] = useState<string | null>(null);

  const refreshLiveStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(id)}/publish`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { practice?: { id?: string } | null };
      setLivePracticeId(data.practice?.id ?? null);
    } catch {
      /* best-effort */
    }
  }, []);

  // ---- initial load: resume an existing draft, else show the source summary ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const srcRes = await fetch(`/api/bty/foundry/arena-source/${encodeURIComponent(eventId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (srcRes.status === 404) return setPhase("gone");
        if (srcRes.status === 409) return setPhase("no_module");
        if (!srcRes.ok) return setPhase("error");
        const srcData = (await srcRes.json()) as { source?: SourceSummary };
        if (!srcData.source) return setPhase("error");
        if (cancelled) return;
        setSource(srcData.source);

        // Resume the latest saved draft for this event, if one exists.
        const listRes = await fetch(`/api/bty/foundry/arena-drafts?eventId=${encodeURIComponent(eventId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (listRes.ok) {
          const listData = (await listRes.json()) as { drafts?: { id: string }[] };
          const latest = listData.drafts?.[0];
          if (latest) {
            const one = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(latest.id)}`, {
              credentials: "include",
              cache: "no-store",
            });
            if (cancelled) return;
            if (one.ok) {
              const d = (await one.json()) as { draft?: ClientDraft };
              if (d.draft?.scenario_draft) {
                setDraftId(d.draft.id);
                setEditable(d.draft.scenario_draft);
                setGenSource(d.draft.generation_source);
                setRevision(d.draft.revision);
                setDirty(false);
                void refreshLiveStatus(d.draft.id); // already published at this revision?
                setPhase("editor");
                return;
              }
              if (d.draft) {
                // Shell-first (Slice 3.2I-R5A.2/R5B1): a canonical draft shell exists but no
                // scenario is generated yet. Show the honest Practice-setup state — NOT the old
                // generation-retry error. R5B2 gave that surface its boundary editor, so this is
                // now a resumable setup rather than a place to stop.
                setDraftId(d.draft.id);
                setRevision(d.draft.revision);
                setSetupDraft(d.draft);
                setPhase("setup");
                return;
              }
            }
          }
        }
        setPhase("summary");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const startNew = useCallback(() => {
    setDraftId(null);
    setEditable(null);
    setQ1(null);
    setQ1Custom("");
    setQ2("");
    setGenError(false);
    setPhase("q1");
  }, []);

  /**
   * R2.23D — persist the Host's ACTIVE-boundary selection. The server is the authority: it
   * validates, rejects (never trims) and returns canonical state, which replaces the local copy so
   * the screen can never drift from what is stored.
   */
  const saveBoundaryScope = useCallback(
    async (activeBoundaryIds: string[]) => {
      if (!draftId || scopeSaving) return;
      setScopeSaving(true);
      setScopeSaveError(false);
      try {
        const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}/boundary-scope`, {
          method: "PUT",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeBoundaryIds, expectedRevision: revision }),
        });
        if (!res.ok) {
          setScopeSaveError(true);
          return;
        }
        const data = (await res.json()) as { draft?: ClientDraft };
        if (!data.draft) {
          setScopeSaveError(true);
          return;
        }
        setSetupDraft(data.draft);
        setRevision(data.draft.revision);
      } catch {
        setScopeSaveError(true);
      } finally {
        setScopeSaving(false);
      }
    },
    [draftId, revision, scopeSaving],
  );

  /**
   * R5B2 — resolve a boundary refusal into something the Host can act on. The route answers with a
   * validation CODE; a code is a fact about the request, not an instruction to a person, so it
   * never reaches the screen.
   */
  const boundaryErrorCopy = useCallback(
    (reason: string | undefined): string => {
      if (reason === "constraint_statement_empty") return t.boundaryErrorEmpty;
      if (reason === "constraint_statement_too_long") return t.boundaryErrorTooLong(CONSTRAINT_STATEMENT_MAX);
      if (reason === "constraint_duplicate_statement" || reason === "constraint_duplicate_id") return t.boundaryErrorDuplicate;
      if (reason === "boundary_too_many_constraints") return t.boundaryErrorTooMany(CONSTRAINTS_MAX);
      return t.boundarySaveError;
    },
    [t],
  );

  /**
   * R5B2 — persist the Host-assembled boundary. The SERVER decides whether it is valid and what
   * `confirmed` then means; the response replaces the local view, so the screen can never claim a
   * confirmation the server did not grant.
   *
   * A stale revision is NOT an overwrite opportunity: the save is abandoned, the latest canonical
   * revision is re-read so the next attempt can succeed, and the Host's rules stay on screen.
   */
  const saveBoundary = useCallback(
    async (boundary: PracticeBoundary) => {
      if (!draftId || boundarySaving) return;
      setBoundarySaving(true);
      setBoundarySaveError(null);
      setBoundaryConflict(false);
      setSetupGenError(false);
      try {
        const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}/boundary`, {
          method: "PUT",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boundary, expectedRevision: revision }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 409 || body?.error === "stale_revision") {
            setBoundaryConflict(true);
            // Re-read the canonical row so the retry carries the revision the server now holds.
            const fresh = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}`, {
              credentials: "include",
              cache: "no-store",
            }).catch(() => null);
            if (fresh?.ok) {
              const d = (await fresh.json().catch(() => ({}))) as { draft?: ClientDraft };
              if (d.draft) {
                setSetupDraft(d.draft);
                setRevision(d.draft.revision);
              }
            }
            return;
          }
          setBoundarySaveError(boundaryErrorCopy(body?.error));
          return;
        }
        const data = (await res.json()) as { draft?: ClientDraft; invalidated?: boolean };
        if (!data.draft) {
          setBoundarySaveError(t.boundarySaveError);
          return;
        }
        setSetupDraft(data.draft);
        setRevision(data.draft.revision);
        setBoundaryInvalidated(data.invalidated === true);
      } catch {
        setBoundarySaveError(t.boundarySaveError);
      } finally {
        setBoundarySaving(false);
      }
    },
    [draftId, revision, boundarySaving, boundaryErrorCopy, t],
  );

  /**
   * R5B2 — the forward action out of setup. It reuses the EXISTING regenerate path, which reads the
   * stored guided answers and the server-side boundary; there is no second generation
   * implementation and no client-supplied boundary.
   */
  const generateFromSetup = useCallback(async () => {
    if (!draftId || submittingRef.current) return;
    submittingRef.current = true;
    setSetupGenError(false);
    setPhase("generating");
    try {
      const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}/regenerate`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: loc }),
      });
      const data = res.ok ? ((await res.json()) as { draft?: ClientDraft; warnings?: string[] }) : null;
      if (!data?.draft?.scenario_draft) {
        // Honest and recoverable: back to setup with the boundary intact, never a raw code.
        setSetupGenError(true);
        setPhase("setup");
        return;
      }
      setEditable(data.draft.scenario_draft);
      setGenSource(data.draft.generation_source);
      setRevision(data.draft.revision);
      setDirty(false);
      setPublishState("idle");
      setLivePracticeId(null);
      setWarnings(data.warnings ?? []);
      setBoundaryInvalidated(false);
      setView("edit");
      setSaveState("idle");
      setPhase("editor");
    } catch {
      setSetupGenError(true);
      setPhase("setup");
    } finally {
      submittingRef.current = false;
    }
  }, [draftId, loc]);

  const q1Ready = q1 !== null && (q1 !== "other" || q1Custom.trim().length > 0);
  const q2Ready = q2.trim().length > 0;

  const generate = useCallback(async () => {
    if (submittingRef.current || !q1 || !q2Ready) return;
    submittingRef.current = true;
    setGenError(false);
    setPhase("generating");
    try {
      const res = await fetch(`/api/bty/foundry/arena-drafts`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEventId: eventId,
          locale: loc,
          guidedAnswers: {
            hardestWhen: { choice: q1, ...(q1 === "other" ? { customText: q1Custom.trim() } : {}) },
            avoidancePressure: { text: q2.trim() },
          },
        }),
      });
      if (!res.ok) {
        setGenError(true);
        setPhase("q2"); // keep the host's answers, allow retry
        return;
      }
      const data = (await res.json()) as { draft?: ClientDraft; warnings?: string[] };
      if (!data.draft) {
        setGenError(true);
        setPhase("q2");
        return;
      }
      if (!data.draft.scenario_draft) {
        // Shell-first (Slice 3.2I-R5B1A): create-or-open returned a canonical shell (no
        // scenario yet). Go to the honest setup surface — NOT a generation error. The boundary
        // editor (R5B2) replaces the Q1/Q2 step; generation happens after the boundary is set.
        setDraftId(data.draft.id);
        setRevision(data.draft.revision);
        setSetupDraft(data.draft);
        setPhase("setup");
        return;
      }
      setDraftId(data.draft.id);
      setEditable(data.draft.scenario_draft);
      setGenSource(data.draft.generation_source);
      setRevision(data.draft.revision);
      setDirty(false);
      setPublishState("idle");
      setLivePracticeId(null);
      setWarnings(data.warnings ?? []);
      setView("edit");
      setSaveState("idle");
      setPhase("editor");
    } catch {
      setGenError(true);
      setPhase("q2");
    } finally {
      submittingRef.current = false;
    }
  }, [eventId, loc, q1, q1Custom, q2, q2Ready]);

  const save = useCallback(async () => {
    if (!draftId || !editable || saveState === "saving") return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_draft: editable }),
      });
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      const data = (await res.json()) as { draft?: ClientDraft; warnings?: string[] };
      setWarnings(data.warnings ?? []);
      setGenSource("edited");
      if (typeof data.draft?.revision === "number") setRevision(data.draft.revision);
      setDirty(false);
      setPublishState("idle");
      setLivePracticeId(null); // a saved (new) revision is not yet published
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [draftId, editable, saveState]);

  // 3.0B — publish the exact saved revision (host must save first: !dirty).
  const publish = useCallback(async () => {
    if (!draftId || dirty || publishState === "publishing") return;
    setPublishState("publishing");
    try {
      const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}/publish`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: revision }),
      });
      if (res.ok) {
        // Success OR idempotently-resolved (both 200/201) carry the practice id.
        const okBody = (await res.json().catch(() => ({}))) as { practice?: { id?: string } };
        const id = okBody.practice?.id ?? null;
        setPublishedPracticeId(id);
        setLivePracticeId(id); // this revision is now live
        setPublishState("published");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setPublishState(body?.error === "stale_revision" ? "stale" : "error");
    } catch {
      setPublishState("error");
    }
  }, [draftId, dirty, revision, publishState]);

  const regenerate = useCallback(async () => {
    if (!draftId || busy) return;
    if (typeof window !== "undefined" && !window.confirm(t.regenerateConfirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bty/foundry/arena-drafts/${encodeURIComponent(draftId)}/regenerate`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: loc }),
      });
      if (res.ok) {
        const data = (await res.json()) as { draft?: ClientDraft; warnings?: string[] };
        if (data.draft?.scenario_draft) {
          setEditable(data.draft.scenario_draft);
          setGenSource(data.draft.generation_source);
          if (typeof data.draft.revision === "number") setRevision(data.draft.revision);
          setDirty(false);
          setPublishState("idle");
          setLivePracticeId(null);
          setWarnings(data.warnings ?? []);
          setSaveState("idle");
          setView("edit");
        }
      }
    } catch {
      /* keep current draft on transient error */
    } finally {
      setBusy(false);
    }
  }, [draftId, busy, loc, t.regenerateConfirm]);

  // ---- editable-draft mutators (local only; Save persists) ----
  const patchDraft = useCallback((fn: (d: ArenaScenarioDraft) => ArenaScenarioDraft) => {
    setEditable((prev) => (prev ? fn(prev) : prev));
    setSaveState("idle");
    setDirty(true);
    setPublishState("idle");
    setLivePracticeId(null); // editing diverges from any published revision
  }, []);
  const setChoiceLabel = useCallback(
    (group: "primary" | "tradeoff" | "action", index: number, label: string) => {
      patchDraft((d) => {
        if (group === "primary") {
          const choices = d.primary.choices.map((c, i) => (i === index ? { ...c, label } : c));
          return { ...d, primary: { ...d.primary, choices } };
        }
        if (group === "tradeoff") {
          const choices = d.tradeoff.choices.map((c, i) => (i === index ? { ...c, label } : c));
          return { ...d, tradeoff: { ...d.tradeoff, choices } };
        }
        const choices = d.actionDecision.choices.map((c, i) => (i === index ? { ...c, label } : c));
        return { ...d, actionDecision: { ...d.actionDecision, choices } };
      });
    },
    [patchDraft],
  );
  const toggleCommitment = useCallback(
    (index: number) => {
      patchDraft((d) => {
        const choices = d.actionDecision.choices.map((c, i) =>
          i === index ? { ...c, isActionCommitment: !c.isActionCommitment } : c,
        );
        return { ...d, actionDecision: { ...d.actionDecision, choices } };
      });
    },
    [patchDraft],
  );

  // ---------------------------------------------------------------- renders ----
  const header = (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onBack} className="text-sm text-white/50 transition-colors hover:text-white/80">
        ← {t.back}
      </button>
      <span className="text-xs uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="btyFadeIn flex flex-col gap-6">
      {header}
      {children}
    </div>
  );

  if (phase === "loading") return shell(<div aria-hidden className="min-h-[40vh]" />);

  if (phase === "gone")
    return shell(<HonestState title={t.sourceGoneTitle} lead={t.sourceGoneLead} />);
  if (phase === "no_module")
    return shell(<HonestState title={t.noModuleTitle} lead={t.noModuleLead} />);
  if (phase === "error")
    return shell(<HonestState title={t.genericError} lead={t.loadError} />);

  if (phase === "setup" && source) {
    // In-shell Practice setup (Slice 3.2I-R5B1, completed R2.23D). A canonical shell is loaded but
    // not generated yet. Honest state — never a "couldn't generate" error and never a raw code.
    //
    // R2.23C made generation block once four or more boundaries are confirmed and gave the Host no
    // way out; this surface is that way out. Readiness comes from the domain resolver, so the
    // screen cannot disagree with the server about why generation is unavailable.
    //
    // R5B2 — the discriminator decides which generation rule the SERVER will apply, so readiness
    // reads it too. Without it this screen reported "ready" for a draft the server refuses.
    const boundary = setupDraft?.guided_answers?.practiceBoundary;
    const newAuthority = typeof setupDraft?.guided_answers?.practiceSetupVersion === "number";
    const readiness: PracticeReadiness = resolvePracticeReadiness(
      boundary,
      setupDraft?.guided_answers?.practiceBoundaryScope,
      { newAuthority },
    );
    // Suggestions are derived from the SAME training facts the server maps into generation
    // (`capability` = problem, `expected_behavior` = observable behaviour, `success_evidence`).
    // They are candidates only; nothing is suggested into authority.
    const suggestions = suggestConstraints({
      problem: source.capability,
      observableBehavior: source.expected_behavior,
      successEvidence: source.success_evidence,
      learningNeeds: source.learning_needs,
    });
    const statusLine =
      readiness.state === "boundary_confirmation_required"
        ? t.setupNeedsBoundary
        : readiness.state === "boundary_unconfirmed"
          ? t.setupNeedsConfirmation
          : readiness.state === "active_boundary_set_changed"
            ? t.boundaryScopeChangedNotice
            : // With the editor present, the confirmed rules are already on screen; restating that
              // they all apply is the whole content of the scope panel's 1-3 branch, so it moves
              // here and the panel is not rendered twice over the same list.
              newAuthority && readiness.state === "ready_all_available_boundaries_active"
              ? t.boundaryScopeAllActive
              : readiness.canGenerate
                ? t.boundaryScopeReady
                : t.setupPending;
    return shell(
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-snug text-white">{t.setupTitle}</h1>
          <p className="text-sm leading-6 text-white/60">{t.setupLead}</p>
        </header>
        <dl className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4">
          <SummaryRow label={t.labelSourceTraining} value={source.event_title} />
          {source.expected_behavior ? <SummaryRow label={t.labelExpected} value={source.expected_behavior} /> : null}
        </dl>

        {/* The boundary comes first: on a new-authority draft nothing else is reachable without it. */}
        {newAuthority ? (
          <BoundaryEditor
            boundary={boundary}
            suggestions={suggestions}
            copy={t}
            saving={boundarySaving}
            saveError={boundarySaveError}
            conflict={boundaryConflict}
            onConfirm={saveBoundary}
          />
        ) : null}

        {boundaryInvalidated ? (
          <p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/90">
            {t.boundaryInvalidatedNotice}
          </p>
        ) : null}

        {/* The scope panel answers a DIFFERENT question — which of four or more rules govern THIS
            situation. With the editor showing the confirmed set, rendering it below three rules
            would only repeat that list back. Legacy drafts have no editor, so nothing changes for
            them and the panel keeps its established behaviour. */}
        {!newAuthority || readiness.selectionRequired ? (
          <BoundaryScopePanel
            readiness={readiness}
            copy={t}
            saving={scopeSaving}
            saveError={scopeSaveError}
            onConfirm={saveBoundaryScope}
          />
        ) : null}

        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/50">
          {statusLine}
        </p>

        {/* One forward action, and only once the server would actually accept it. */}
        {readiness.canGenerate ? (
          <div className="flex flex-col gap-2">
            {setupGenError ? <p role="alert" className="text-sm text-red-300/90">{t.setupGenerateError}</p> : null}
            <PrimaryButton onClick={generateFromSetup}>{t.setupGenerateCta}</PrimaryButton>
          </div>
        ) : null}
      </div>,
    );
  }

  if (phase === "summary" && source) {
    return shell(
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-snug text-white">{t.summaryTitle}</h1>
          <p className="text-sm leading-6 text-white/60">{t.summaryLead}</p>
        </header>
        <dl className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4">
          <SummaryRow label={t.labelSourceTraining} value={source.event_title} />
          {source.capability ? <SummaryRow label={t.labelCapability} value={source.capability} /> : null}
          {source.audience_type ? (
            <SummaryRow
              label={t.labelForWhom}
              value={
                AUDIENCE_LABELS[loc][source.audience_type] +
                (source.audience_detail ? ` · ${source.audience_detail}` : "")
              }
            />
          ) : null}
          {source.expected_behavior ? <SummaryRow label={t.labelExpected} value={source.expected_behavior} /> : null}
        </dl>
        <button
          type="button"
          onClick={startNew}
          className="rounded-xl bg-[#C9A66B] px-6 py-3.5 text-base font-semibold text-[#0B1F3A]"
        >
          {t.startCta}
        </button>
      </div>,
    );
  }

  if (phase === "q1" && source) {
    return shell(
      <QuestionScreen
        title={t.q1Title}
        help={t.q1Help}
        backLabel={t.back}
        onBack={() => setPhase(draftId ? "editor" : "summary")}
      >
        <div className="flex flex-col gap-2.5">
          {source.hardest_when_options.map((opt) => (
            <OptionCard key={opt} selected={q1 === opt} label={t.hardestWhen[opt]} onSelect={() => setQ1(opt)} />
          ))}
          {q1 === "other" ? (
            <AutoTextarea
              value={q1Custom}
              onChange={setQ1Custom}
              placeholder={t.otherPlaceholder}
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-[0.95rem] text-white/90 outline-none placeholder:text-white/30 focus:border-[#C9A66B]/50"
            />
          ) : null}
        </div>
        <PrimaryButton disabled={!q1Ready} onClick={() => setPhase("q2")}>
          {t.continueCta}
        </PrimaryButton>
      </QuestionScreen>,
    );
  }

  if (phase === "q2" && source) {
    return shell(
      <QuestionScreen title={t.q2Title} help={t.q2Help} backLabel={t.back} onBack={() => setPhase("q1")}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {source.avoidance_seeds.map((seed) => (
              <button
                key={seed}
                type="button"
                onClick={() => setQ2(t.seed[seed])}
                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 hover:border-[#C9A66B]/50 hover:text-white/90"
              >
                {t.seed[seed]}
              </button>
            ))}
          </div>
          <AutoTextarea
            value={q2}
            onChange={setQ2}
            placeholder={t.q2Placeholder}
            rows={3}
            className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-[0.95rem] text-white/90 outline-none placeholder:text-white/30 focus:border-[#C9A66B]/50"
          />
        </div>
        {genError ? <p className="text-sm text-red-300/90">{t.genericError}</p> : null}
        <PrimaryButton disabled={!q2Ready} onClick={generate}>
          {t.generateCta}
        </PrimaryButton>
      </QuestionScreen>,
    );
  }

  if (phase === "generating") {
    return shell(
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#C9A66B]" />
        <p className="text-base text-white/85">{t.generatingTitle}</p>
        <p className="max-w-[20rem] text-sm leading-6 text-white/50">{t.generatingLead}</p>
      </div>,
    );
  }

  // 3.0B — Test in Arena: ephemeral play of the CURRENT in-memory draft through the
  // real learner surface. No run, no XP, no completion record. Returns to editor.
  if (testing && editable) {
    return (
      <div className="btyFadeIn min-h-[60vh] rounded-2xl bg-bty-soft/40 p-2">
        <ArenaPracticePlayer
          scenario={editable}
          locale={loc}
          mode="test"
          sourceTrainingTitle={source?.event_title}
          onExit={() => setTesting(false)}
        />
      </div>
    );
  }

  // 3.0B.1 — prominent publish success (never leave the screen visually unchanged).
  if (phase === "editor" && publishState === "published" && publishedPracticeId) {
    return shell(
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A66B]/15 text-2xl text-[#C9A66B]">
          ✓
        </div>
        <h1 className="text-xl font-semibold text-white">{t.publishedTitle}</h1>
        {/* No route navigation: the native app tab is owned by BtyDailyAppShell.
            Guide the host to the Practice tab instead of ejecting to a web route. */}
        <p className="max-w-[20rem] text-sm leading-6 text-white/60">{t.openArenaTabHint}</p>
        <button
          type="button"
          onClick={() => setPublishState("idle")}
          className="rounded-xl bg-[#C9A66B] px-8 py-3.5 text-base font-semibold text-[#0B1F3A]"
        >
          {t.backToEditor}
        </button>
      </div>,
    );
  }

  if (phase === "editor" && editable) {
    const hasSensitive = warnings.length > 0;
    // ONE authority for which actions are true at once (R2). Publish is no longer offered for a
    // revision that is already live, and only one action carries primary weight.
    const actions = resolveEditorActions({ dirty, saveState, publishState, livePracticeId, view, busy });
    return shell(
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-white">{t.editTitle}</h1>
          <button
            type="button"
            onClick={() => setView((v) => (v === "edit" ? "preview" : "edit"))}
            className="text-sm text-white/60 hover:text-white/90"
          >
            {view === "edit" ? t.previewCta : t.editCta}
          </button>
        </div>

        <p className="text-xs text-white/40">
          {genSource === "ai" ? t.aiDraftNote : genSource === "template" ? t.templateDraftNote : ""}
        </p>
        {hasSensitive ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-200/90">
            {t.sensitiveWarning}
          </p>
        ) : null}

        {/* Already published at this revision → the host sees it is live. No route
            navigation: learners start it from the Practice tab (shell-owned). */}
        {actions.liveAtThisRevision ? (
          <div data-testid="editor-live-banner" className="rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-4 py-3">
            <span className="text-sm text-[#C9A66B]">✓ {t.liveBanner}</span>
            <span className="ml-1 text-sm text-[#C9A66B]/80">{t.openArenaTabHint}</span>
          </div>
        ) : null}

        {view === "preview" ? (
          <ArenaScenarioPreview draft={editable} t={t} />
        ) : (
          <Editor
            draft={editable}
            t={t}
            onField={(field, value) => patchDraft((d) => ({ ...d, [field]: value }))}
            onEscalation={(value) => patchDraft((d) => ({ ...d, tradeoff: { ...d.tradeoff, escalationText: value } }))}
            onActionPrompt={(value) =>
              patchDraft((d) => ({ ...d, actionDecision: { ...d.actionDecision, prompt: value } }))
            }
            onChoiceLabel={setChoiceLabel}
            onToggleCommitment={toggleCommitment}
          />
        )}

        {/*
          R2 — ONE action region, in normal document flow.

          It was a bare `sticky bottom-2` stack with no background: five controls and up to four
          conditional lines floated over the scenario, which stayed visible through the gaps between
          them, and nothing reserved its height so the last fields could never be scrolled clear.
          Sticky with a backdrop would still have to reserve that space on a 390pt screen; flow
          cannot overlap anything by construction, so it is what the Host gets.

          One primary action per state, decided by `resolveEditorActions`; replacement actions stay
          visually secondary because they destroy work; at most one explanation line, so the region
          cannot grow by stacking hints.
        */}
        <div
          data-testid="editor-actions"
          className="mt-2 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {actions.showSave ? (
            <button
              type="button"
              data-testid="editor-action-save"
              onClick={save}
              disabled={actions.saveDisabled}
              className={
                (actions.primary === "save" ? PRIMARY_ACTION : SECONDARY_ACTION) + " w-full"
              }
            >
              {saveState === "saving" ? t.saving : saveState === "saved" ? t.saved : t.save}
            </button>
          ) : null}

          {actions.showPublish ? (
            <button
              type="button"
              data-testid="editor-action-publish"
              onClick={publish}
              disabled={actions.publishDisabled}
              className={
                (actions.primary === "publish" ? PRIMARY_ACTION : SECONDARY_ACTION) + " w-full"
              }
            >
              {publishState === "publishing" ? t.publishing : t.publishToArena}
            </button>
          ) : null}

          {actions.showTest ? (
            <button
              type="button"
              data-testid="editor-action-test"
              onClick={() => setTesting(true)}
              disabled={actions.testDisabled}
              className={(actions.primary === "test" ? PRIMARY_ACTION : SECONDARY_ACTION) + " w-full"}
            >
              {t.testInArena}
            </button>
          ) : null}

          {/* Exactly one line, so a long label or a second condition can never grow the region. */}
          {actions.hint ? (
            <p
              data-testid="editor-action-hint"
              role={actions.hint === "save_error" || actions.hint === "publish_error" ? "alert" : "status"}
              className={
                "text-center text-xs leading-5 " +
                (actions.hint === "save_error" || actions.hint === "publish_error"
                  ? "text-red-300/90"
                  : actions.hint === "publish_stale"
                    ? "text-amber-300/90"
                    : "text-white/45")
              }
            >
              {actions.hint === "save_error"
                ? t.saveError
                : actions.hint === "publish_error"
                  ? t.publishError
                  : actions.hint === "publish_stale"
                    ? t.publishStale
                    : actions.hint === "save_before_publish"
                      ? t.saveBeforePublish
                      : t.saveBeforeTesting}
            </p>
          ) : null}

          {/* Replacement actions: they throw away the current draft, so they never sit at primary
              weight and never sit beside the action that saves it. */}
          {actions.showRegenerate || actions.showStartOver ? (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/8 pt-3">
              {actions.showRegenerate ? (
                <button
                  type="button"
                  data-testid="editor-action-regenerate"
                  onClick={regenerate}
                  disabled={busy}
                  className={TERTIARY_ACTION}
                >
                  {busy ? t.regenerating : t.regenerate}
                </button>
              ) : null}
              {actions.showStartOver ? (
                <button type="button" data-testid="editor-action-start-over" onClick={startNew} className={TERTIARY_ACTION}>
                  {t.startOver}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>,
    );
  }

  return shell(<div aria-hidden className="min-h-[40vh]" />);
}

// --------------------------------------------------------------- sub-views ----

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</dt>
      <dd className="text-[0.95rem] leading-6 text-white/85">{value}</dd>
    </div>
  );
}

function HonestState({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
      <p className="max-w-[20rem] text-base leading-7 text-white/80">{title}</p>
      <p className="max-w-[20rem] text-sm leading-6 text-white/50">{lead}</p>
    </div>
  );
}

function QuestionScreen({
  title,
  help,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  help: string;
  backLabel: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-snug text-white">{title}</h1>
        <p className="text-sm leading-6 text-white/55">{help}</p>
      </header>
      {children}
      <button type="button" onClick={onBack} className="self-start text-sm text-white/40 hover:text-white/70">
        ← {backLabel}
      </button>
    </div>
  );
}

function OptionCard({ selected, label, onSelect }: { selected: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "rounded-xl border px-4 py-3.5 text-left text-[0.98rem] leading-6 transition-colors " +
        (selected
          ? "border-[#C9A66B]/60 bg-[#C9A66B]/[0.08] text-white"
          : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]")
      }
    >
      {label}
    </button>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-[#C9A66B] px-6 py-3.5 text-base font-semibold text-[#0B1F3A] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</span>
      <AutoTextarea
        value={value}
        rows={rows}
        onChange={onChange}
        className="w-full rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-[0.95rem] leading-6 text-white/90 outline-none focus:border-[#C9A66B]/50"
      />
    </label>
  );
}

function Editor({
  draft,
  t,
  onField,
  onEscalation,
  onActionPrompt,
  onChoiceLabel,
  onToggleCommitment,
}: {
  draft: ArenaScenarioDraft;
  t: ArenaPracticeCopy;
  onField: (field: "title" | "opening", value: string) => void;
  onEscalation: (value: string) => void;
  onActionPrompt: (value: string) => void;
  onChoiceLabel: (group: "primary" | "tradeoff" | "action", index: number, label: string) => void;
  onToggleCommitment: (index: number) => void;
}) {
  const choiceRow = (
    group: "primary" | "tradeoff" | "action",
    c: ScenarioDraftChoice,
    i: number,
    action?: ActionDecisionChoice,
  ) => (
    <div key={c.id} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/35">{t.choiceLabel(i + 1)}</span>
        {action ? (
          <button
            type="button"
            onClick={() => onToggleCommitment(i)}
            className={
              "rounded-full border px-2.5 py-0.5 text-[0.62rem] uppercase tracking-[0.1em] " +
              (action.isActionCommitment
                ? "border-[#C9A66B]/60 bg-[#C9A66B]/10 text-[#C9A66B]"
                : "border-white/15 text-white/45")
            }
          >
            {action.isActionCommitment ? t.commitmentOn : t.commitmentOff}
          </button>
        ) : null}
      </div>
      <AutoTextarea
        value={c.label}
        rows={2}
        onChange={(v) => onChoiceLabel(group, i, v)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[0.9rem] leading-6 text-white/90 outline-none focus:border-[#C9A66B]/50"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Field label={t.fieldTitle} value={draft.title} rows={1} onChange={(v) => onField("title", v)} />
      <Field label={t.fieldOpening} value={draft.opening} rows={4} onChange={(v) => onField("opening", v)} />

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">{t.sectionPrimary}</h3>
        {draft.primary.choices.map((c, i) => choiceRow("primary", c, i))}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">{t.sectionTradeoff}</h3>
        <Field label={t.fieldEscalation} value={draft.tradeoff.escalationText} rows={3} onChange={onEscalation} />
        {draft.tradeoff.choices.map((c, i) => choiceRow("tradeoff", c, i))}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">{t.sectionAction}</h3>
        <Field label={t.fieldActionPrompt} value={draft.actionDecision.prompt} rows={2} onChange={onActionPrompt} />
        <p className="text-xs text-white/40">{t.commitmentHint}</p>
        {draft.actionDecision.choices.map((c, i) => choiceRow("action", c, i, c))}
      </section>
    </div>
  );
}
