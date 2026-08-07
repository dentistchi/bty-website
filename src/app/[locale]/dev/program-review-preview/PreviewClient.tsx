"use client";

import { useCallback, useState } from "react";
import { ProgramAuthorship, type ProgramGenerateOutcome } from "@/components/foundry/event-rooms/ProgramAuthorship";
import { FIXTURE_IDENTITY, PREVIEW_ANSWERS, PREVIEW_EVIDENCE_CEILING, PREVIEW_PROPOSAL } from "./fixture";

/**
 * Physical readability preview (Slice 3.2L-R5) — the REAL review component, a STATIC
 * proposal, and no network of any kind.
 *
 * `onGenerate` resolves a local fixture: no fetch, no provider, no attempt row, no call
 * row. `onApply` records that it was pressed and does nothing else — no draft is written,
 * and the canonical draft is never referenced anywhere on this page.
 */
export function PreviewClient({ buildSha }: { buildSha: string }) {
  const [applied, setApplied] = useState(false);

  /** Deliberately async so the component's real working → review transition is exercised. */
  const onGenerate = useCallback(async (): Promise<ProgramGenerateOutcome> => {
    return { ok: true, proposal: PREVIEW_PROPOSAL, evidenceCeiling: PREVIEW_EVIDENCE_CEILING, attemptId: null };
  }, []);

  const onApply = useCallback(() => {
    setApplied(true);
  }, []);

  return (
    <main className="min-h-dvh bg-[#0B1F3A] px-5 py-6 text-white" data-testid="program-review-preview">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/[0.08] px-4 py-3">
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-amber-200" data-testid="preview-banner">
            Test preview — not a real training draft
          </p>
          {/*
            Which source rendered this page. Visible before the proposal opens, so a physical
            recording carries its own build identity and a stale bundle cannot be mistaken for
            a code defect again.
          */}
          <p className="mt-0.5 font-mono text-xs text-amber-200/70" data-testid="preview-build">
            Build {buildSha}
          </p>
          {/*
            WHICH proposal this is (Slice 3.2L-R8.1). The last recording could not tell that
            the page was mixing a live result with an older invented narrative, because the
            page never said what it was replaying. Now it does.
          */}
          <p className="mt-0.5 font-mono text-xs text-amber-200/70" data-testid="preview-fixture">
            Fixture: {FIXTURE_IDENTITY}
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">
            Nothing here is saved, drafted by AI, or connected to any of your trainings. This page exists to
            check that every line of a drafted program is readable on a phone.
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-100/60" data-testid="preview-fixture-note">
            Replays one real result. Its assumptions and warnings, and the middle of “Why this matters”, were
            never stored, so they are left out rather than invented. One outcome promise it originally ended
            with — “ultimately affects project success and team collaboration” — is removed here, because a
            training can’t claim that.
          </p>
        </div>

        <ProgramAuthorship
          draftId="preview-fixture"
          answers={PREVIEW_ANSWERS}
          journey={undefined}
          ready
          onGenerate={onGenerate}
          onApply={onApply}
        />

        {applied ? (
          <p className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/70" data-testid="preview-apply-noop">
            Preview mode — nothing was added. In a real training this would add the program to your draft.
          </p>
        ) : null}
      </div>
    </main>
  );
}
