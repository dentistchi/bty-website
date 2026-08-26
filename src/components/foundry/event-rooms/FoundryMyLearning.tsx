"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readContentType, type FoundryContentType } from "@/domain/foundry/events/content-type";
import { contentTypeLabel } from "./contentTypeLabel";
import type { EvidenceLevel } from "@/domain/foundry/module/program-authorship";
import { EVIDENCE_DISPLAY_ORDER, LEARNER_RUNG_LABEL } from "./evidenceLadderCopy";

/**
 * Foundry → My Learning (Slice 3.1B-3I re-placement).
 *
 * Foundry answers "what did I learn and understand?" — so the PRIMARY artifact is the learner's
 * OWN Shared Understanding answer, NOT the Private Reflection (that now lives canonically in
 * Center). Reuses the owner-scoped GET /api/bty/foundry/history (linked_user_id = caller). Each
 * row links to the exact Center reflection via ?tab=center&view=reflections&entry=<entryId>.
 * Explicit DTO allow-list — never the raw row; never Host review notes.
 */

type Locale = "en" | "ko";

/** Explicit client DTO allow-list — the private responseText is deliberately NOT read here. */
type MyLearningItem = {
  entryId: string;
  eventId: string;
  eventTitle: string;
  /** R4-R2G — all four types; null = unknown stored discriminator (rendered as a neutral dash). */
  contentType: FoundryContentType | null;
  completedAt: string;
  sharedUnderstanding: string | null;
  /**
   * What the learner decided to DO (Slice 3.2R-R1.1). null when the published journey asked for
   * no decision — then the section is ABSENT, never an empty box. Never BTY's proposed sentence.
   */
  decisionResponse: string | null;
};

/**
 * A follow-up on this record that can still take a later check-in (Slice 3.2R-R3-R1).
 *
 * THE ID IS CARRIED, NOT RECONSTRUCTED. A record may hold both a 7- and a 30-day obligation, and
 * matching one by event, title or checkpoint would eventually open the wrong question. The server
 * sends the durable `followupId` and this surface passes exactly that back.
 */
type CheckInAgainTarget = {
  followupId: string;
  followUpDays: number;
  outcome: string;
};

/**
 * A follow-up on this record that has NO answer yet (Slice 3.2R-R3-R2).
 *
 * A SEPARATE LIST, NOT A FLAG ON THE ONE ABOVE. Today now stops asking about an unanswered
 * follow-up after its 7-day attention window, so this is the route that keeps it reachable — and
 * it must never borrow the other CTA's words. "Check in again" and "You reported earlier" are
 * both false for someone who has not reported at all. Keeping them as two typed lists means this
 * component cannot conflate them even by accident: there is no status string here to branch on.
 *
 * The SERVER decides membership (it owns the clock, the reader timezone and the BTY-day frame).
 * This surface renders what it was handed and infers nothing.
 */
type OpenFollowUpTarget = {
  followupId: string;
  followUpDays: number;
};

/**
 * Reviewed Action Plan card (Slice 3.1B-3N-5D.1). An approved Field Action = a reviewer
 * reviewed & ACCEPTED the learner's submitted PLAN. Deliberately carries NO reviewer identity,
 * NO audit internals, NO private reflection — and the copy never implies Applied/Observed.
 */
type ReviewedPlanCard = {
  contractId: string;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  moduleTitle: string | null;
  moduleVersion: number | null;
  reviewedAt: string | null;
};

const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  decisionLabel: string;
  evidenceLabel: string;
  evidenceHint: string;
  sharedLabel: string;
  noShared: string;
  viewInCenter: string;
  completedOn: string;
  video: string;
  document: string;
  empty: string;
  emptyHint: string;
  backDefault: string;
  loading: string;
  reviewedTitle: string;
  reviewedStatus: string;
  labelWho: string;
  labelWhat: string;
  labelHow: string;
  labelWhen: string;
  reviewedOn: string;
  moduleVersion: (v: number) => string;
  /** Slice 3.2R-R3-R1 — the return route to a follow-up that can still take a later report. */
  checkInAgain: string;
  checkInAgainAt: (days: number) => string;
  /** Slice 3.2R-R3-R2 — the return route to a follow-up with no answer yet. Never "again". */
  followUp: string;
  followUpAt: (days: number) => string;
  /**
   * Deferred Completion Claim V1 — the one permanent door for a training finished without an
   * account. It lives HERE, in the surface that owns completed learning, rather than in Me or on
   * the Learn landing: one door, in the place the result will appear.
   */
  claimTitle: string;
  claimHint: string;
  claimLabel: string;
  claimCta: string;
  claimWorking: string;
  claimDone: string;
  claimBad: string;
}> = {
  en: {
    title: "My Learning",
    subtitle: "What you understood, in your own words.",
    decisionLabel: "What I decided",
    evidenceLabel: "Since this training",
    // Deliberately does NOT say "nothing here is overdue": naming the anxiety in order to deny it
    // is what plants it. States what the strip is, and lets the absence of urgency speak.
    evidenceHint: "This fills in over time, as things happen at work.",
    sharedLabel: "What I understood",
    noShared: "No shared understanding was recorded for this training.",
    viewInCenter: "View my private reflection in Center",
    completedOn: "Completed",
    video: "Video",
    document: "PDF",
    claimTitle: "Add a training you finished",
    claimHint: "Finished a training without signing in? Enter the completion code you were given.",
    claimLabel: "Completion code",
    claimCta: "Add it",
    claimWorking: "Adding…",
    claimDone: "Added to your account.",
    claimBad: "That code did not work. Check it and submit it again.",
    empty: "No completed trainings yet.",
    emptyHint: "When you finish a training, it appears here with what you understood.",
    // Default parent = the Learn/Required-learning origin. An explicit `backLabel` overrides this
    // per origin (B3A.2D-R1) — e.g. the Me-tab origin passes "Me" so a personal-history surface
    // returns to Me, never leaking "Required learning" as its parent.
    backDefault: "Required learning",
    loading: "Loading…",
    reviewedTitle: "Reviewed action plans",
    reviewedStatus: "Action plan reviewed & accepted",
    labelWho: "Who",
    labelWhat: "What",
    labelHow: "How",
    labelWhen: "When",
    reviewedOn: "Reviewed",
    moduleVersion: (v) => `Module v${v}`,
    checkInAgain: "Check in again",
    // Only used when a record carries more than one checkpoint, so the two CTAs are tellable apart.
    checkInAgainAt: (days) => `Check in again · ${days}-day follow-up`,
    // No "again", no "still", no "overdue". There is no earlier answer to refer back to and no
    // deadline to press on: the checkpoint arrived, and this is the way in — whenever the learner
    // gets to it. The parallel "· N-day follow-up" suffix is the shipped multi-checkpoint pattern.
    followUp: "Follow up",
    followUpAt: (days) => `Follow up · ${days}-day follow-up`,
  },
  ko: {
    title: "내 학습",
    subtitle: "내가 이해한 내용을 나의 말로.",
    decisionLabel: "내가 결정한 것",
    evidenceLabel: "이 교육 이후",
    evidenceHint: "시간이 지나면서 실제 현장에서 일어난 일들이 하나씩 채워집니다.",
    sharedLabel: "내가 이해한 것",
    noShared: "이 교육에는 공유 이해 답변이 없습니다.",
    viewInCenter: "Center에서 나의 비공개 성찰 보기",
    completedOn: "완료",
    video: "영상",
    document: "PDF",
    claimTitle: "완료한 학습 가져오기",
    claimHint: "로그인 없이 학습을 마치셨나요? 그때 받은 완료 코드를 입력하세요.",
    claimLabel: "완료 코드",
    claimCta: "가져오기",
    claimWorking: "가져오는 중…",
    claimDone: "학습을 내 계정에 연결했습니다.",
    claimBad: "코드가 맞지 않습니다. 다시 확인해 주세요.",
    empty: "아직 완료한 교육이 없습니다.",
    emptyHint: "교육을 마치면 여기에서 이해한 내용을 볼 수 있습니다.",
    backDefault: "필수 학습",
    loading: "불러오는 중…",
    reviewedTitle: "검토·승인된 행동 계획",
    reviewedStatus: "행동 계획이 검토되고 승인되었습니다",
    labelWho: "누구",
    labelWhat: "무엇",
    labelHow: "어떻게",
    labelWhen: "언제",
    reviewedOn: "검토됨",
    moduleVersion: (v) => `모듈 v${v}`,
    checkInAgain: "다시 확인하기",
    checkInAgainAt: (days) => `다시 확인하기 · ${days}일 후 확인`,
    // "다시"(again) is deliberately absent — there is no earlier answer.
    followUp: "확인하기",
    followUpAt: (days) => `확인하기 · ${days}일 후 확인`,
  },
};

function formatDate(iso: string, loc: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function FoundryMyLearning({
  locale,
  onBack,
  backLabel,
  focusEntryId = null,
  onOpenFollowUp,
}: {
  locale: string;
  onBack: () => void;
  /** Origin-aware parent name (B3A.2D-R1). Me-origin passes "Me"; Learn-origin omits it → the
   *  measured "Required learning" default. Explicit per call — never inferred from tab/history. */
  backLabel?: string;
  /**
   * THE RECORD TODAY POINTED AT (Slice R4-R5C1). An Apply this week card names the learner's own
   * commitment sentence; this is the `foundry_event_training_progress.id` behind it, which is the
   * same id these rows key on (`entryId`). Brought into view and outlined so the learner lands on
   * their sentence instead of a list. Presentation only — no state, no write — and an unknown or
   * stale id focuses nothing. Same prop shape as `CenterRealityFeed`'s `focusEntryId`.
   */
  focusEntryId?: string | null;
  /**
   * Slice 3.2R-R3-R1 — open THIS follow-up's response surface IN-SHELL. A button + callback, never
   * an `<a href>`: a row already inside the app is an app-shell command, and the raw-href form is
   * what 3.2G-R2 had to replace after the cold first tap was swallowed by the WKWebView navigation
   * policy. Absent → the CTA does not render at all, rather than rendering a dead control.
   */
  onOpenFollowUp?: (followupId: string) => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const backText = `← ${backLabel ?? t.backDefault}`;
  const [items, setItems] = useState<MyLearningItem[] | null>(null);
  /*
    THE DOOR BACK IN (Deferred Completion Claim V1). A learner who finished without signing in was
    given a code and nothing else; this is the only place in the app that spends it. The raw code
    is held for the length of one submit and never stored.
  */
  const [claimInput, setClaimInput] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "working" | "done" | "bad">("idle");
  const focusRef = useRef<HTMLLIElement | null>(null);

  /*
    Bring the named record into view once the list exists — `block: "center"`, no smooth behaviour,
    matching `CenterRealityFeed`. A stale id matches no row, so `focusRef` stays null and nothing
    scrolls; the list is still perfectly usable.
  */
  useEffect(() => {
    if (!focusEntryId || !items) return;
    const el = focusRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
  }, [focusEntryId, items]);
  const [reviewedPlans, setReviewedPlans] = useState<ReviewedPlanCard[]>([]);
  // entryId → established rungs. Absent = not loaded / unavailable → the strip simply does not
  // render for that row. Evidence is secondary; its absence must never blank a completion.
  const [evidence, setEvidence] = useState<Map<string, EvidenceLevel[]>>(new Map());
  // entryId → follow-ups the SERVER says can still take a later check-in (Slice 3.2R-R3-R1).
  // Absent/empty = no CTA. This surface never decides eligibility; it renders what it was told.
  const [checkInAgain, setCheckInAgain] = useState<Map<string, CheckInAgainTarget[]>>(new Map());
  // entryId → follow-ups the SERVER says are still awaiting a FIRST answer (Slice 3.2R-R3-R2).
  // Kept apart from the map above so the two CTAs can never be rendered with each other's words.
  const [openFollowUp, setOpenFollowUp] = useState<Map<string, OpenFollowUpTarget[]>>(new Map());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/history", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = (await res.json()) as {
        history?: Array<{ entryId?: string; eventId?: string; eventTitle?: string; contentType?: string; completedAt?: string; sharedUnderstanding?: string | null; decisionResponse?: string | null }>;
      };
      // Allow-list mapping — responseText (Private Reflection) is intentionally NOT read here.
      const mapped: MyLearningItem[] = (data?.history ?? []).map((h) => ({
        entryId: String(h.entryId ?? ""),
        eventId: String(h.eventId ?? ""),
        eventTitle: String(h.eventTitle ?? "Foundry training"),
        contentType: readContentType(h.contentType),
        completedAt: String(h.completedAt ?? ""),
        sharedUnderstanding: h.sharedUnderstanding ? String(h.sharedUnderstanding) : null,
        decisionResponse: h.decisionResponse ? String(h.decisionResponse) : null,
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    }
  }, []);

  /*
    Evidence rungs (Slice 3.2R-R1) — a SEPARATE owner-scoped fetch, for the same reason the
    reviewed plans below are: this list must render the learner's completions even if evidence
    assembly is slow or unavailable. A failed load leaves the map empty and the strip hidden;
    it never blanks a row and never shows an error, because "not established" and "not loaded"
    must not look different to someone reading their own history.
  */
  const loadEvidence = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/evidence/mine", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: Array<{
          entryId?: string;
          established?: string[];
          checkInAgain?: Array<{ followupId?: string; followUpDays?: number; outcome?: string }>;
          openFollowUp?: Array<{ followupId?: string; followUpDays?: number }>;
        }>;
      };
      const next = new Map<string, EvidenceLevel[]>();
      const nextCheckIn = new Map<string, CheckInAgainTarget[]>();
      const nextOpen = new Map<string, OpenFollowUpTarget[]>();
      for (const it of Array.isArray(data?.items) ? data.items : []) {
        const id = String(it.entryId ?? "");
        if (!id) continue;
        // Filter against the canonical order so an unknown value can never render as a rung.
        next.set(
          id,
          (Array.isArray(it.established) ? it.established : []).filter((v): v is EvidenceLevel =>
            (EVIDENCE_DISPLAY_ORDER as readonly string[]).includes(v),
          ),
        );
        // Carried verbatim, identity first: a target with no durable id is dropped rather than
        // reconstructed from anything else on the row.
        const targets = (Array.isArray(it.checkInAgain) ? it.checkInAgain : [])
          .map((c) => ({
            followupId: String(c.followupId ?? ""),
            followUpDays: typeof c.followUpDays === "number" ? c.followUpDays : 0,
            outcome: String(c.outcome ?? ""),
          }))
          .filter((c) => c.followupId !== "");
        if (targets.length > 0) nextCheckIn.set(id, targets);
        // Identity first, same as above: no durable id → no door, rather than a door to a guess.
        const open = (Array.isArray(it.openFollowUp) ? it.openFollowUp : [])
          .map((c) => ({
            followupId: String(c.followupId ?? ""),
            followUpDays: typeof c.followUpDays === "number" ? c.followUpDays : 0,
          }))
          .filter((c) => c.followupId !== "");
        if (open.length > 0) nextOpen.set(id, open);
      }
      setEvidence(next);
      setCheckInAgain(nextCheckIn);
      setOpenFollowUp(nextOpen);
    } catch {
      /* evidence is additive — never surface a failure on this surface */
    }
  }, []);

  // Reviewed Action Plans (Slice 3.1B-3N-5D.1) — a DIFFERENT evidence stage from completion,
  // fetched independently so its failure never affects the completion list. Deduped by contractId.
  const loadReviewedPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/action-contract/reviewed-plans", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setReviewedPlans([]);
        return;
      }
      const data = (await res.json()) as { items?: ReviewedPlanCard[] };
      const seen = new Set<string>();
      const mapped: ReviewedPlanCard[] = (Array.isArray(data?.items) ? data.items : [])
        .map((p) => ({
          contractId: String(p.contractId ?? ""),
          who: p.who ?? null,
          what: p.what ?? null,
          how: p.how ?? null,
          stepWhen: p.stepWhen ?? null,
          moduleTitle: p.moduleTitle ?? null,
          moduleVersion: typeof p.moduleVersion === "number" ? p.moduleVersion : null,
          reviewedAt: p.reviewedAt ?? null,
        }))
        .filter((p) => p.contractId && !seen.has(p.contractId) && seen.add(p.contractId));
      setReviewedPlans(mapped);
    } catch {
      setReviewedPlans([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadReviewedPlans();
    void loadEvidence();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
        void loadReviewedPlans();
        void loadEvidence();
      }
    };
    const onFocus = () => {
      void load();
      void loadReviewedPlans();
      void loadEvidence();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, loadReviewedPlans, loadEvidence]);

  const submitClaim = useCallback(async () => {
    if (claimState === "working" || !claimInput.trim()) return;
    setClaimState("working");
    try {
      const res = await fetch("/api/bty/foundry/completion-claim", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: claimInput, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) return setClaimState("bad");
      setClaimState("done");
      setClaimInput("");
      // The claimed training belongs in this list now, so the list is what proves it worked.
      await load();
    } catch {
      setClaimState("bad");
    }
  }, [claimInput, claimState, load]);

  return (
    <section data-testid="foundry-my-learning" className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-white/90">{t.title}</h2>
          <p className="text-xs text-white/50">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          data-testid="my-learning-back"
          className="shrink-0 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70"
        >
          {backText}
        </button>
      </div>

      {/*
        ONE DOOR, IN THE PLACE THE RESULT APPEARS. Not on the Learn landing and not in Me: a
        learner looking for a training they finished looks where their finished trainings are, and
        a second entry would be a second thing to keep consistent. Secondary by weight — it sits
        under the heading and above the list, and never competes with the learning itself.
      */}
      <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3" data-testid="my-learning-claim">
        <p className="text-sm font-medium text-white/80">{t.claimTitle}</p>
        <p className="text-xs leading-5 text-white/50">{t.claimHint}</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            value={claimInput}
            onChange={(e) => {
              setClaimInput(e.target.value);
              if (claimState !== "idle") setClaimState("idle");
            }}
            aria-label={t.claimLabel}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            data-testid="my-learning-claim-input"
            className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 font-mono text-sm tracking-[0.1em] text-white placeholder-white/25 outline-none"
          />
          <button
            type="button"
            onClick={() => void submitClaim()}
            disabled={claimState === "working" || claimInput.trim().length === 0}
            data-testid="my-learning-claim-submit"
            className="shrink-0 rounded-lg bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
          >
            {claimState === "working" ? t.claimWorking : t.claimCta}
          </button>
        </div>
        {claimState === "done" ? (
          <p className="text-xs text-[#E5B769]" data-testid="my-learning-claim-done">{t.claimDone}</p>
        ) : claimState === "bad" ? (
          <p className="text-xs text-white/60" data-testid="my-learning-claim-bad">{t.claimBad}</p>
        ) : null}
      </div>

      {items === null ? (
        <p className="text-sm text-white/40" role="status">{t.loading}</p>
      ) : items.length === 0 ? (
        <div data-testid="my-learning-empty" className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-sm text-white/70">{t.empty}</p>
          <p className="mt-1 text-xs text-white/45">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => {
            const focused = !!focusEntryId && it.entryId === focusEntryId;
            return (
            <li
              key={it.entryId}
              ref={focused ? (el) => { focusRef.current = el; } : undefined}
              data-testid="my-learning-item"
              data-entry-id={it.entryId}
              data-focused={focused ? "1" : undefined}
              className={
                "flex flex-col gap-2 rounded-2xl border bg-white/[0.03] px-4 py-3 " +
                (focused ? "border-[#C9A66B]/60 ring-1 ring-[#C9A66B]/40" : "border-white/8")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[0.95rem] font-medium text-white/90">{it.eventTitle}</span>
                <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-white/55">
                  {contentTypeLabel(it.contentType, loc)}
                </span>
              </div>
              <span className="text-xs text-emerald-300/70">
                {t.completedOn} · {formatDate(it.completedAt, loc)}
              </span>
              {/* PRIMARY artifact: the learner's own Shared Understanding (Host-reviewable). */}
              <div className="mt-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#C9A66B]/80">
                  {t.sharedLabel}
                </span>
                {it.sharedUnderstanding ? (
                  <p data-testid="my-learning-shared" className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white/85">
                    {it.sharedUnderstanding}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm leading-6 text-white/40">{t.noShared}</p>
                )}
              </div>
              {/*
                WHAT I DECIDED (Slice 3.2R-R1.1) — rendered ONLY when a decision was actually
                recorded, so a training that never asked for one shows no section rather than an
                empty heading. This is the sentence behind the DECIDED chip below: R1 shipped the
                chip with nothing to open, which is the same gap R8D-R1 closed for the reflection.

                Distinct from "What I understood" above it by SOURCE and by MEANING — that is the
                Shared Understanding answer to the Host's question, this is what the learner
                committed to do next. Neither is a fallback for the other; if a training records
                only one, only one renders.
              */}
              {it.decisionResponse ? (
                <div data-testid="my-learning-decision" className="mt-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                  <span className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#C9A66B]/80">
                    {t.decisionLabel}
                  </span>
                  <p data-testid="my-learning-decision-text" className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white/85">
                    {it.decisionResponse}
                  </p>
                </div>
              ) : null}
              {/*
                SINCE THIS TRAINING (Slice 3.2R-R1) — secondary to the completion above it.

                ESTABLISHED RUNGS ONLY. The first draft rendered all seven with the unearned ones
                dimmed, and that is the mistake 3.2N already named: a training that published no
                observable standard can NEVER reach OBSERVED, so greying it tells the learner they
                failed to be seen when in fact nobody was ever given the standing to look. The
                same is true of PRACTICED with no published practice, and APPLIED with no
                follow-up window. A dimmed rung is a claim about applicability that this component
                has no authority to make.

                So it states what happened, and the hint line carries the rest. Nothing is greyed,
                so there is nothing to feel behind on — no count, no fraction, no bar, no red.
              */}
              {(evidence.get(it.entryId)?.length ?? 0) > 0 ? (
                <div data-testid="my-learning-evidence" className="mt-1">
                  <span className="text-[0.66rem] font-medium uppercase tracking-[0.14em] text-white/35">
                    {t.evidenceLabel}
                  </span>
                  <ul className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {EVIDENCE_DISPLAY_ORDER.filter((level) => (evidence.get(it.entryId) ?? []).includes(level)).map(
                      (level) => (
                        <li
                          key={level}
                          data-testid={`evidence-rung-${level}`}
                          className="flex items-center gap-1.5 rounded-full bg-[#C9A66B]/12 px-2 py-0.5 text-[0.72rem] text-[#C9A66B]/95"
                        >
                          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A66B]/80" />
                          {LEARNER_RUNG_LABEL[loc][level]}
                        </li>
                      ),
                    )}
                  </ul>
                  <p className="mt-1.5 text-[0.68rem] leading-4 text-white/30">{t.evidenceHint}</p>
                </div>
              ) : null}
              {/*
                CHECK IN AGAIN (Slice 3.2R-R3-R1) — the required return route.

                This is the ONLY way back to a follow-up the learner has already answered
                non-terminally: Today drops RESPONDED rows by design, and D2 is explicit that a
                non-terminal answer must not drag the card back into Today. So the way back lives
                where the learner's own record lives.

                IT IS NOT A TASK. One quiet control at the bottom of a record, rendered only when
                the SERVER says this exact obligation can still take a report — no count, no
                badge, no due date, no red. A record with nothing open shows nothing, which is the
                same rule the evidence strip above it follows.
              */}
              {/*
                FOLLOW UP (Slice 3.2R-R3-R2) — the door for a question with no answer yet.

                Today now stops asking after the 7-day attention window, and without this the bound
                would quietly become "you can no longer answer" for the three live obligations that
                are already past it. So the durable obligation gets a durable door, here, where the
                learner's own record lives and nothing expires.

                IT SAYS "FOLLOW UP", NOT "CHECK IN AGAIN". Nothing was reported, so there is no
                "again" and nothing to have reported "earlier". It opens the SAME first-response
                surface the Today card opened, with the same durable followup id — the experience
                on the other side is unchanged, only the way in is new.

                NO DATE, NO BADGE, NO RED — including for a row nineteen days past its checkpoint.
                An obligation that outlived Today's attention is not thereby a failure, and this
                surface has no authority to score one.
              */}
              {onOpenFollowUp
                ? (openFollowUp.get(it.entryId) ?? []).map((target, _i, all) => (
                    <button
                      key={target.followupId}
                      type="button"
                      data-testid="my-learning-open-follow-up"
                      data-followup-id={target.followupId}
                      onClick={() => onOpenFollowUp(target.followupId)}
                      className="self-start rounded-lg border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-3 py-1.5 text-xs font-medium text-[#E5B769]"
                    >
                      {all.length > 1 ? t.followUpAt(target.followUpDays) : t.followUp}
                    </button>
                  ))
                : null}
              {onOpenFollowUp
                ? (checkInAgain.get(it.entryId) ?? []).map((target, _i, all) => (
                    <button
                      key={target.followupId}
                      type="button"
                      data-testid="my-learning-check-in-again"
                      data-followup-id={target.followupId}
                      onClick={() => onOpenFollowUp(target.followupId)}
                      className="self-start rounded-lg border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-3 py-1.5 text-xs font-medium text-[#E5B769]"
                    >
                      {/* The checkpoint is named only when there is more than one to tell apart. */}
                      {all.length > 1 ? t.checkInAgainAt(target.followUpDays) : t.checkInAgain}
                    </button>
                  ))
                : null}
              {/* Private Reflection is NOT shown here — it lives in Center. Deep-link to the exact entry. */}
              <a
                href={`/${loc}/app?tab=center&view=reflections&entry=${encodeURIComponent(it.entryId)}`}
                data-testid="view-reflection-in-center"
                className="self-start text-xs font-medium text-[#C9A66B]/80 underline underline-offset-4"
              >
                {t.viewInCenter} →
              </a>
            </li>
            );
          })}
        </ul>
      )}

      {reviewedPlans.length > 0 ? (
        <div data-testid="reviewed-plans" className="mt-1 flex flex-col gap-3">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">
            {t.reviewedTitle}
          </span>
          <ul className="flex flex-col gap-3">
            {reviewedPlans.map((p) => (
              <li
                key={p.contractId}
                data-testid="reviewed-plan-item"
                className="flex flex-col gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid="reviewed-plan-status"
                    className="rounded-md border border-emerald-400/25 px-2 py-0.5 text-[0.72rem] font-medium text-emerald-200/85"
                  >
                    {t.reviewedStatus}
                  </span>
                  {p.reviewedAt ? (
                    <span className="text-[0.72rem] text-white/45">
                      {t.reviewedOn} · {formatDate(p.reviewedAt, loc)}
                    </span>
                  ) : null}
                </div>
                {p.moduleTitle ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-[0.95rem] font-medium text-white/90">{p.moduleTitle}</span>
                    {p.moduleVersion != null ? (
                      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.66rem] text-white/50">
                        {t.moduleVersion(p.moduleVersion)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <dl className="mt-0.5 flex flex-col gap-1.5">
                  {([
                    [t.labelWho, p.who],
                    [t.labelWhat, p.what],
                    [t.labelHow, p.how],
                    [t.labelWhen, p.stepWhen],
                  ] as const)
                    .filter(([, v]) => (v ?? "").trim() !== "")
                    .map(([label, v]) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <dt className="text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/40">{label}</dt>
                        <dd className="whitespace-pre-wrap break-words text-base leading-6 text-white/85">{v}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
