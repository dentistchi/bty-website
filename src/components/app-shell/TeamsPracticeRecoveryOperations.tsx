"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * ADMIN OPERATIONS, INSIDE TEAMS. Slice Teams-Native System-Block Recovery V1.
 *
 * ★ WHY IT LIVES HERE AT ALL. BTY is operated inside Teams, so the one operator action this
 * product has must be reachable there. The alternative was a standalone web page an operator would
 * have to leave Teams to reach, or a curl command — and an action that only exists as a curl
 * command is not a product action.
 *
 * ★ IT IS ABSENT BY DEFAULT, AND THAT IS THE DESIGN. It renders nothing unless the runtime is
 * Teams, the caller is a platform admin, AND there is something to recover. A learner never sees an
 * admin placeholder, an empty state or a disabled button — the section does not exist for them.
 * Every failure path collapses to the same absence rather than to an error they cannot act on.
 *
 * ★ IT RECOVERS, IT DOES NOT GENERATE. Recovery and generation are separate decisions, so nothing
 * here starts an attempt, navigates into Practice, or touches admission. The most it does is let
 * the draft become eligible again.
 *
 * ★ ONE BUTTON PER EXACT ATTEMPT. There is no "recover latest": between an operator reading this
 * list and tapping, a new failure can occur, and a stale tap must not clear a block nobody has
 * looked at. Each row carries its own `draftId` + `blockedAttemptId`.
 */

type Recoverable = {
  draftId: string;
  blockedAttemptId: string;
  outcome: string | null;
  terminalReasonCode: string | null;
  failedDeploySha: string | null;
  currentDeploySha: string;
};

const ENDPOINT = "/api/admin/practice-generation/recover-system-block";
/** A named operator assertion, never a claim about a particular historical defect. */
const RECOVERY_REASON_CODE = "operator_verified_system_block_repaired";
const LOWER_SHA40 = /^[0-9a-f]{40}$/;

function isActionableUnderCurrentBuild(item: Recoverable): boolean {
  return typeof item.failedDeploySha === "string"
    && LOWER_SHA40.test(item.failedDeploySha)
    && item.failedDeploySha !== item.currentDeploySha;
}

const COPY = {
  en: {
    heading: "Admin operations",
    lead: "Practice generation was stopped by a system error.",
    ready: "A newer BTY build is running.",
    recover: "Recover",
    working: "Recovering…",
    details: "Details",
    attempt: "Attempt",
    failedBuild: "Failed build",
    currentBuild: "Current build",
    confirm: "Mark this system block as recovered?",
    confirmNote: "The failed attempt will remain in history. Only continue if the system issue has been verified as repaired.",
    cancel: "Cancel",
    done: "Recovery complete. Practice is ready.",
    recorded: "Recovery recorded.",
    failed: "That could not be completed. Nothing was changed.",
  },
  ko: {
    heading: "운영 작업",
    lead: "시스템 오류로 연습 생성이 중단되었습니다.",
    ready: "현재는 더 새로운 BTY 버전이 실행 중입니다.",
    recover: "다시 시도 허용",
    working: "처리 중…",
    details: "상세",
    attempt: "시도",
    failedBuild: "실패한 빌드",
    currentBuild: "현재 빌드",
    confirm: "이 시스템 차단을 복구 처리할까요?",
    confirmNote: "실패 기록은 그대로 남습니다. 문제가 수정되었음을 확인한 경우에만 진행하세요.",
    cancel: "취소",
    done: "복구했습니다. 연습을 다시 시도할 수 있습니다.",
    recorded: "복구 기록을 남겼습니다.",
    failed: "완료하지 못했습니다. 변경된 것은 없습니다.",
  },
} as const;

const short = (sha: string | null) => (sha ? `${sha.slice(0, 8)}…` : "—");

export function TeamsPracticeRecoveryOperations({ locale }: { locale: "en" | "ko" }) {
  const t = COPY[locale];
  const [items, setItems] = useState<Recoverable[] | null>(null);
  /** Set only once the section has actually been shown, so a failure is never a first impression. */
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState<Recoverable | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(ENDPOINT, { credentials: "include", cache: "no-store" });
      /*
        401/403 is the ordinary answer for everyone who is not an operator, and it is not a failure
        to report. The section simply does not exist for them.
      */
      if (res.status === 401 || res.status === 403) {
        setItems([]);
        return;
      }
      if (!res.ok) {
        // Only a reader who had already been shown the section learns that a refresh failed.
        setItems((prev) => prev ?? []);
        if (revealed) setNote(t.failed);
        return;
      }
      const body = (await res.json()) as { recoverable?: Recoverable[] };
      // The server owns this filter. Retain it at the UI boundary too so malformed transport data
      // can never create a Recover button the POST contract is guaranteed to refuse.
      const next = Array.isArray(body?.recoverable)
        ? body.recoverable.filter(isActionableUnderCurrentBuild)
        : [];
      setItems(next);
      if (next.length > 0) setRevealed(true);
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, [revealed, t.failed]);

  useEffect(() => {
    void load();
    // Discovery runs once per mount of the Me surface; it is not polled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    ONE POST PER CONFIRMATION. `busy` gates re-entry, and there is no retry on failure — a recovery
    that may or may not have been written is not something to fire again automatically.
  */
  const confirmRecover = useCallback(async () => {
    if (!pending || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        /*
          THE BODY NAMES THE FAILURE AND NOTHING ELSE. No granter: the server derives that from the
          session, and a client-supplied one would make the audit record a claim rather than a fact.
        */
        body: JSON.stringify({
          draftId: pending.draftId,
          blockedAttemptId: pending.blockedAttemptId,
          recoveryReasonCode: RECOVERY_REASON_CODE,
          fixedInDeploySha: pending.currentDeploySha,
        }),
      });
      if (!res.ok) {
        setNote(t.failed);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        ok?: unknown;
        governanceState?: unknown;
        canStartGeneration?: unknown;
      } | null;
      // A 2xx only says the transport succeeded. Recovery is acknowledged as ready only when the
      // server's additive governance read positively proves it; unknown is deliberately not ready.
      if (body?.ok !== true) {
        setNote(t.failed);
        return;
      }
      setNote(body.governanceState === "ready" && body.canStartGeneration === true ? t.done : t.recorded);
      setPending(null);
      // Re-read once: the recovered item disappears because the server no longer lists it.
      await load();
    } catch {
      setNote(t.failed);
    } finally {
      setBusy(false);
    }
  }, [pending, busy, load, t.done, t.recorded, t.failed]);

  // Nothing to operate on, or not an operator: the section does not exist.
  if (!items || items.length === 0) {
    return note ? (
      <p className="text-xs text-white/55" data-testid="teams-recovery-note">{note}</p>
    ) : null;
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3" data-testid="teams-recovery-operations">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/55">{t.heading}</span>

      {items.map((item) => {
        const isPending = pending?.blockedAttemptId === item.blockedAttemptId;
        return (
          <div key={item.blockedAttemptId} className="flex flex-col gap-2" data-testid="teams-recovery-item" data-attempt-id={item.blockedAttemptId}>
            <p className="text-sm leading-6 text-white/75">
              {t.lead} <span className="text-white/85">{t.ready}</span>
            </p>

            {isPending ? (
              <div className="flex flex-col gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] p-3" data-testid="teams-recovery-confirm">
                <p className="text-sm text-white/85">{t.confirm}</p>
                <p className="text-xs text-white/50">{t.confirmNote}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    data-testid="teams-recovery-cancel"
                    className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-white/60"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmRecover()}
                    disabled={busy}
                    data-testid="teams-recovery-confirm-cta"
                    className="flex-1 rounded-lg bg-[#C9A66B] px-3 py-2 text-xs font-semibold text-[#0B1F3A] disabled:opacity-60"
                  >
                    {busy ? t.working : t.recover}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setPending(item); setNote(null); }}
                data-testid="teams-recovery-start"
                data-attempt-id={item.blockedAttemptId}
                className="self-start rounded-lg bg-[#C9A66B] px-3 py-2 text-xs font-semibold text-[#0B1F3A]"
              >
                {t.recover}
              </button>
            )}

            {/* Compact operator metadata, on request. No diagnostic code in the primary UI. */}
            <button
              type="button"
              onClick={() => setOpenDetails((cur) => (cur === item.blockedAttemptId ? null : item.blockedAttemptId))}
              data-testid="teams-recovery-details-toggle"
              className="self-start text-[0.7rem] text-white/50 hover:text-white/65"
            >
              {t.details}
            </button>
            {openDetails === item.blockedAttemptId ? (
              <dl className="flex flex-col gap-0.5 text-[0.7rem] text-white/55" data-testid="teams-recovery-details">
                <div><dt className="inline">{t.attempt}: </dt><dd className="inline font-mono">{short(item.blockedAttemptId)}</dd></div>
                <div><dt className="inline">{t.failedBuild}: </dt><dd className="inline font-mono">{short(item.failedDeploySha)}</dd></div>
                <div><dt className="inline">{t.currentBuild}: </dt><dd className="inline font-mono">{short(item.currentDeploySha)}</dd></div>
              </dl>
            ) : null}
          </div>
        );
      })}

      {note ? <p className="text-xs text-white/55" data-testid="teams-recovery-note">{note}</p> : null}
    </section>
  );
}
