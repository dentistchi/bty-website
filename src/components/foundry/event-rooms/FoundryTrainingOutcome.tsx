"use client";

import { useEffect, useState } from "react";
import type { EventRoomsCopy } from "./copy";
import type { ManagerOutcome } from "./types";

/**
 * TRAINING OUTCOME — the Host's answer to "did anything change?" (Slice R4-R3A).
 *
 * READ-ONLY, and it renders decisions the server already made. Every judgement on this screen is
 * owned by a domain authority (`classifyFollowUpDue` for overdue, `establishesObservation` for
 * confirmation) and arrives pre-computed; this component counts nothing and interprets nothing.
 * That is deliberate — a second interpretation here would be a second authority, and the two
 * would drift.
 *
 * THE THREE LEVELS STAY APART, VISUALLY AND SEMANTICALLY.
 *
 *   Completed                   — they finished the training.
 *   After the training          — what the LEARNER told us happened at work.
 *   Observed by someone else    — what an INDEPENDENT person confirmed.
 *
 * They are never summed, never averaged and never shown as one success rate. A Host given a
 * single number would have been told something nobody measured: finishing a video is not doing
 * the thing, and saying you did it is not the same as someone seeing you do it.
 *
 * "Not established" and "Couldn't tell" are shown in the neutral tone, never the failure tone.
 * `NOT_OBSERVED` means the observer did not see it — which is not a claim that it did not happen,
 * and most often means they were somewhere else.
 */

function Row({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "quiet" | "warn" }) {
  const valueClass =
    tone === "warn" ? "text-amber-300/90" : tone === "quiet" ? "text-white/45" : "text-white/85";
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm leading-6 text-white/60">{label}</span>
      <span className={`shrink-0 text-sm font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * The Host's own timezone, sent as the `?tz=` hint. Same helper and same transport the follow-up
 * panel on this event already uses — "overdue" is a BTY day-key question and is only correct in
 * the reader's frame.
 */
function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Fetches its own data, like `FoundryFollowupStatus` — so the control-room snapshot poll is
 * untouched and this panel simply does not render when it has nothing to say.
 */
export function FoundryTrainingOutcome({ eventId, t }: { eventId: string; t: EventRoomsCopy }) {
  const [outcome, setOutcome] = useState<ManagerOutcome | null>(null);
  const [openDecisions, setOpenDecisions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tz = deviceTz();
        const qs = tz ? `?tz=${encodeURIComponent(tz)}` : "";
        const res = await fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/outcome${qs}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; outcome?: ManagerOutcome };
        if (!cancelled && data?.ok && data.outcome) setOutcome(data.outcome);
      } catch {
        /* The room never depends on this panel: no outcome, no block. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!outcome) return null;
  return <TrainingOutcomeBody outcome={outcome} t={t} openDecisions={openDecisions} setOpenDecisions={setOpenDecisions} />;
}

/** The pure presentation half — rendered from a fully-decided aggregate, counts nothing itself. */
export function TrainingOutcomeBody({
  outcome,
  t,
  openDecisions,
  setOpenDecisions,
}: {
  outcome: ManagerOutcome;
  t: EventRoomsCopy;
  openDecisions: boolean;
  setOpenDecisions: (v: (p: boolean) => boolean) => void;
}) {
  const { participation: p, followUp: f, observation: o } = outcome;

  /*
    WHY THE EVIDENCE STOPS — and it is now decided by the field that actually gates it (R4-R3A-R1).

    R4-R3A asked the Journey and printed "no follow-up was set up for it". Measured against
    production, that sentence was wrong on 17 of the 31 events that have completions: every one of
    them HAD a 7- or 30-day checkpoint. The Host was being told they had forgotten to configure
    something they had configured.

    R4-R3B2 then removed the second false statement at this seam. The panel used to explain a
    missing obligation as "finished without signing in, so we can't follow up with them" — a cause
    the product cannot prove, and one that was measurably false for three production completions
    that DID have a reachable follow-up. It now reports the shortfall and asserts no cause.

    Three distinct states, and only the first one ends the training:

      not configured        → "ends at completion" (the honest original sentence, correctly scoped)
      configured, 0 rows    → the checkpoint exists; state what has not been connected yet
      configured, rows      → render the evidence, exactly as before

    The tables stay hidden whenever there are no obligations to show, because a table of zeros
    reads as learner failure and nobody failed. But they are NEVER hidden merely because some
    completions have no obligation of their own: real rows are rendered, and the unconnected ones
    are noted beside them.
  */
  const endsAtCompletion = !f.configured;
  const hasFollowUpEvidence = f.total > 0;

  return (
    <section className="flex flex-col gap-3" data-testid="training-outcome">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.outcomeHeading}</h2>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
        <p className="text-[0.95rem] font-medium leading-6 text-white/90">{t.outcomeQuestion}</p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm leading-6 text-white/60">{t.outcomeCompleted}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-white/85" data-testid="outcome-completed">
              {t.outcomeCompletedOf(p.completed, p.joined)}
            </span>
          </div>
          {/*
            Said once, in the place that says it best. When the checkpoint has produced nothing at
            all, the sentence below names the configuration AND the count, so repeating the generic
            note here would state the same fact twice in one panel.
          */}
          {p.followUpNotConnected > 0 && outcome.reading !== "awaiting_connection" && (
            <p className="mt-1.5 text-xs leading-5 text-white/40" data-testid="outcome-not-connected">
              {t.outcomeNotConnectedNote(p.followUpNotConnected)}
            </p>
          )}
        </div>

        {endsAtCompletion ? (
          <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-5 text-white/50" data-testid="outcome-ends-at-completion">
            {t.outcomeEndsAtCompletion}
          </p>
        ) : !hasFollowUpEvidence ? (
          /*
            The checkpoint IS set and produced no obligation. Either nobody who finished signed in
            — which is the identity gap, named as such — or nobody has finished yet.
          */
          <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-5 text-white/50" data-testid="outcome-reading">
            {outcome.reading === "awaiting_connection" && f.days !== null
              ? t.outcomeAwaitingConnection(f.days, p.followUpNotConnected)
              : t.outcomeReadingNothingYet}
          </p>
        ) : (
          <>
            <div className="mt-4 border-t border-white/8 pt-4" data-testid="outcome-after">
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">{t.outcomeAfterHeading}</h3>
              <div className="mt-2">
                <Row label={t.outcomeApplied} value={f.applied} />
                <Row label={t.outcomePartly} value={f.partlyApplied} />
                <Row label={t.outcomeNotYet} value={f.notYet} />
                <Row label={t.outcomeBlocked} value={f.blocked} />
                <Row label={t.outcomeWaiting} value={f.waiting} tone="quiet" />
                <Row label={t.outcomeOverdue} value={f.overdue} tone={f.overdue > 0 ? "warn" : "quiet"} />
              </div>
            </div>

            <div className="mt-4 border-t border-white/8 pt-4" data-testid="outcome-observed">
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">{t.outcomeObservedHeading}</h3>
              <div className="mt-2">
                <Row label={t.outcomeConfirmed} value={o.confirmed} />
                {/* Neither of these is a failure. Quiet tone, never amber. */}
                <Row label={t.outcomeNotEstablished} value={o.notEstablished} tone="quiet" />
                <Row label={t.outcomeCouldntTell} value={o.couldntTell} tone="quiet" />
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-white/55" data-testid="outcome-reading">
              {outcome.reading === "confirmed"
                ? t.outcomeReadingConfirmed
                : outcome.reading === "unknown_yet"
                  ? t.outcomeReadingUnknown(f.waiting, f.overdue)
                  : outcome.reading === "reported_only"
                    ? t.outcomeReadingReportedOnly
                    : t.outcomeReadingNothingYet}
            </p>
          </>
        )}

        {/*
          SECONDARY AND COLLAPSED, by Founder decision. `decision_response_text` is Host-visible —
          declared on the column since 3.2M-1 and already carried by the shared-review allow-list —
          but a learner's own words do not belong in the first viewport. Unattributed: this slice
          was told not to widen identity exposure, so the decisions arrive without names.
        */}
        {outcome.decisionCount > 0 && (
          <div className="mt-4 border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={() => setOpenDecisions((v) => !v)}
              aria-expanded={openDecisions}
              data-testid="outcome-decisions-toggle"
              className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-sm text-white/70"
            >
              <span>{t.outcomeDecisionsToggle(outcome.decisionCount)}</span>
              <span className="shrink-0 text-white/40">{openDecisions ? "−" : "+"}</span>
            </button>
            {openDecisions && (
              <ul className="mt-1 flex flex-col gap-2" data-testid="outcome-decisions">
                {outcome.decisions.map((d, i) => (
                  <li key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-6 text-white/80">
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
