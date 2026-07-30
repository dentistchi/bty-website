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
                // generation-retry error. The boundary editor arrives in R5B2.
                setDraftId(d.draft.id);
                setRevision(d.draft.revision);
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
      if (!data.draft?.scenario_draft) {
        setGenError(true);
        setPhase("q2");
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
    // Interim in-shell Practice-setup surface (Slice 3.2I-R5B1). A canonical shell is loaded
    // but not generated yet. Honest state — no "couldn't generate" error, no raw codes. The
    // 3-mode boundary editor replaces this in R5B2 without changing the route or shell contract.
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
        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/50">
          {t.setupPending}
        </p>
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
            <textarea
              value={q1Custom}
              onChange={(e) => setQ1Custom(e.target.value)}
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
          <textarea
            value={q2}
            onChange={(e) => setQ2(e.target.value)}
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
            Guide the host to the Arena tab instead of ejecting to a web route. */}
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
            navigation: they start it from the Arena tab (shell-owned). */}
        {livePracticeId && !dirty ? (
          <div className="rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-4 py-3">
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

        <div className="sticky bottom-2 mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saveState === "saving"}
              className="flex-1 rounded-xl bg-[#C9A66B] px-6 py-3.5 text-base font-semibold text-[#0B1F3A] disabled:opacity-60"
            >
              {saveState === "saving" ? t.saving : saveState === "saved" ? t.saved : t.save}
            </button>
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              className="shrink-0 rounded-xl border border-white/15 px-4 py-3.5 text-sm text-white/70 hover:text-white/90 disabled:opacity-50"
            >
              {busy ? t.regenerating : t.regenerate}
            </button>
          </div>
          {saveState === "error" ? <p className="text-sm text-red-300/90">{t.saveError}</p> : null}

          {/* Test in Arena — prominent (not a subtle header link). Always shown; if a
              save is required first it is disabled with an honest explanation, never
              silently hidden. Tests the exact current SAVED revision. */}
          <button
            type="button"
            onClick={() => setTesting(true)}
            disabled={dirty}
            className="rounded-xl border border-[#C9A66B]/50 px-6 py-3 text-sm font-semibold text-[#C9A66B] disabled:opacity-45"
          >
            {t.testInArena}
          </button>
          {dirty ? <p className="text-center text-xs text-white/40">{t.saveBeforeTesting}</p> : null}

          {/* Publish to Arena — the exact SAVED revision. Disabled while there are
              unsaved edits so the host never publishes bytes they didn't see. */}
          <button
            type="button"
            onClick={publish}
            disabled={dirty || publishState === "publishing" || publishState === "published"}
            className="rounded-xl border border-[#C9A66B]/50 bg-[#C9A66B]/[0.08] px-6 py-3 text-sm font-semibold text-[#C9A66B] disabled:opacity-45"
          >
            {publishState === "publishing"
              ? t.publishing
              : publishState === "published"
                ? t.published
                : t.publishToArena}
          </button>
          {dirty ? <p className="text-center text-xs text-white/40">{t.saveBeforePublish}</p> : null}
          {publishState === "stale" ? <p className="text-center text-xs text-amber-300/90">{t.publishStale}</p> : null}
          {publishState === "error" ? <p className="text-center text-xs text-red-300/90">{t.publishError}</p> : null}

          <button type="button" onClick={startNew} className="self-center pt-1 text-xs text-white/40 hover:text-white/70">
            {t.startOver}
          </button>
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
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
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
      <textarea
        value={c.label}
        rows={2}
        onChange={(e) => onChoiceLabel(group, i, e.target.value)}
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
