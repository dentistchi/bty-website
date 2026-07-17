"use client";

import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import type { ArenaPracticeCopy } from "./arenaPracticeCopy";

/**
 * Non-playable draft preview — Opening → Primary → Escalation → Tradeoff → Action.
 *
 * Deliberately self-contained (shared Foundry theme tokens), NOT the live Arena
 * interactive components: those carry runtime invariants (a tradeoff choice must
 * have a non-empty `cost`, client callbacks, i18n coupling) that a free-form draft
 * cannot guarantee, and reusing them would risk a dev-time throw. This renders the
 * exact same sequence a learner sees, clearly marked as a preview, so the boundary
 * is honest: it displays the draft, it does not run it.
 */

function InertChoice({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="min-w-0 text-[0.95rem] leading-6 text-white/85">{label}</span>
      {tag ? (
        <span className="shrink-0 rounded-full border border-[#C9A66B]/40 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-[#C9A66B]/90">
          {tag}
        </span>
      ) : null}
    </div>
  );
}

function PhaseHeading({ children }: { children: string }) {
  return <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">{children}</h3>;
}

export function ArenaScenarioPreview({
  draft,
  t,
}: {
  draft: ArenaScenarioDraft;
  t: ArenaPracticeCopy;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/50">
        {t.previewNotPlayable}
      </p>

      <h2 className="text-xl font-semibold leading-snug text-white">{draft.title}</h2>

      {/* Opening */}
      <section className="flex flex-col gap-2">
        <PhaseHeading>{t.previewOpening}</PhaseHeading>
        <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-white/80">{draft.opening}</p>
      </section>

      {/* Primary */}
      <section className="flex flex-col gap-2.5">
        <PhaseHeading>{t.previewPrimary}</PhaseHeading>
        {draft.primary.choices.map((c) => (
          <InertChoice key={c.id} label={c.label} />
        ))}
      </section>

      {/* Escalation */}
      <section className="flex flex-col gap-2">
        <PhaseHeading>{t.previewEscalation}</PhaseHeading>
        <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-white/80">{draft.tradeoff.escalationText}</p>
      </section>

      {/* Tradeoff */}
      <section className="flex flex-col gap-2.5">
        <PhaseHeading>{t.previewTradeoff}</PhaseHeading>
        {draft.tradeoff.choices.map((c) => (
          <InertChoice key={c.id} label={c.label} />
        ))}
      </section>

      {/* Action decision */}
      <section className="flex flex-col gap-2.5">
        <PhaseHeading>{t.previewAction}</PhaseHeading>
        <p className="text-[0.98rem] leading-7 text-white/85">{draft.actionDecision.prompt}</p>
        {draft.actionDecision.choices.map((c) => (
          <InertChoice key={c.id} label={c.label} tag={c.isActionCommitment ? t.previewCommitmentTag : undefined} />
        ))}
      </section>
    </div>
  );
}
