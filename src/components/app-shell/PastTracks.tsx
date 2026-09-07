"use client";

import { useCallback, useEffect, useState } from "react";
import TrackConversation from "@/components/app-shell/TrackConversation";

/**
 * Me → PAST TRACKS. Retrieval, and only retrieval.
 *
 * ★ WHY THIS EXISTS. Today lets a person remove a settled Track, and every earlier slice made sure
 * the underlying record survives that: the announcement, the response, the question, the whole
 * conversation. But nothing showed it to them afterwards. For most Tracks that was recoverable —
 * new activity lifts a removed card back onto Today — and for one kind it was not: a Track whose
 * Host account has been deleted can never receive new activity, so removing it hid a preserved
 * conversation permanently. Preserving a row nobody can reach is not preservation.
 *
 * ★ TODAY AND PAST ARE A PARTITION, NOT TWO LISTS. Both ask `isTrackOnToday` and take opposite
 * answers, in the service. A Track is in exactly one of the two surfaces at any moment, and moving
 * between them is a consequence of activity rather than a write: nothing here archives, closes,
 * dismisses, restores, or touches ownership, responses, handled state or activity versions.
 *
 * ★ ONE DOOR, TWO SECTIONS. A person looking for "that thing about the intake steps" does not first
 * decide whether they were the Host or the recipient. Splitting this into two Me rows would be two
 * labels for one job.
 *
 * ★ RETRIEVAL-FIRST, BUT A LIVE CONVERSATION IS NOT FROZEN.
 *
 * The first cut made every card here read-only. That was wrong, and for the same reason this
 * surface exists: it created a second dead end. Continuous Conversation shipped so that a Track is
 * a two-way thread, and somebody who deliberately goes looking for a live one must not find it
 * behind glass. So the composer stays for a live Track and goes only where the product genuinely
 * cannot deliver another message:
 *
 *   Host account deleted  -> read-only. The server refuses the write with `host_unavailable`;
 *                            this stops offering the control before anybody uses it.
 *   run closed            -> read-only. The Host ended it.
 *   otherwise             -> writable, using the same thread path Today uses.
 *
 * ★ WHAT PAST STILL DOES NOT OFFER: the swipe tray, first-response buttons, Handle, dismissal, or
 * any lifecycle control. Only the CONVERSATION continues. There is no Restore, no Un-dismiss and no
 * Reopen — a Track moves between Today and Past because of activity, never because somebody pressed
 * something.
 *
 * ★ AND SENDING DOES NOT DRAG YOUR OWN CARD BACK. The activity versions are side-specific: a
 * recipient's Today rises on HOST-authored activity, a Host's on RECIPIENT-authored activity. So
 * writing from Past raises the OTHER person's version and leaves yours alone — you return to Today
 * when there is something new for YOU to process, not because you chose to speak.
 */

type Locale = "en" | "ko";

type PastRecipient = {
  announcementId: string;
  recipientId: string;
  hostFraming: string;
  hostDisplay: string | null;
  sourceUrl: string | null;
  response: "ACKNOWLEDGED" | "QUESTION" | "HELP_NEEDED" | null;
  respondedAt: string | null;
  unreadCount: number;
  messageCount: number;
  hostAvailable?: boolean;
  status?: "active" | "closed";
};

type PastHost = {
  id: string;
  hostFraming: string;
  createdAt: string;
  previewText: string | null;
  sourceUrl: string | null;
  status: "active" | "closed";
  funnel: { announcedTo: number; gotIt: number; question: number; needHelp: number; noResponse: number; notYetActivated: number };
  responders: {
    acknowledged: readonly Responder[];
    question: readonly Responder[];
    needHelp: readonly Responder[];
    noResponse: readonly Responder[];
  };
};
type Responder = { recipientId: string; display: string | null; messageCount: number };

const COPY = {
  en: {
    title: "Past Tracks",
    back: "Me",
    fromOthers: "From others",
    youTracked: "You tracked",
    empty: "No past Tracks yet.",
    loading: "Loading…",
    failed: "Couldn't load past Tracks.",
    retry: "Retry",
    host: "Host",
    hostGone: "Host account removed. This Track is read-only.",
    closed: "Closed",
    openConversation: "Open conversation",
    hideConversation: "Hide conversation",
    answeredGotIt: "You said: Got it",
    answeredQuestion: "You asked a question",
    answeredHelp: "You asked for help",
    noAnswer: "You didn't answer this one",
    sent: (n: number) => `Sent to ${n}`,
  },
  ko: {
    title: "지난 Track",
    back: "나",
    fromOthers: "받은 Track",
    youTracked: "내가 Track한 항목",
    empty: "아직 지난 Track이 없습니다.",
    loading: "불러오는 중…",
    failed: "지난 Track을 불러오지 못했습니다.",
    retry: "다시 시도",
    host: "Host",
    hostGone: "Host 계정이 삭제되어 이 Track은 기록으로만 남아 있습니다.",
    closed: "종료됨",
    openConversation: "대화 열기",
    hideConversation: "대화 닫기",
    answeredGotIt: "확인함이라고 답했습니다",
    answeredQuestion: "질문을 남겼습니다",
    answeredHelp: "도움을 요청했습니다",
    noAnswer: "이 Track에는 답하지 않았습니다",
    sent: (n: number) => `${n}명에게 보냄`,
  },
} as const;

const CARD = "flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4";

/**
 * ★ THE ONE DERIVATION, FROM THE CANONICAL FIELDS — never a second status system.
 *
 * A conversation is frozen exactly when the product cannot deliver another message: the Host's
 * account is gone, or the run was closed. Anything else is live and stays writable.
 */
function isFrozen(card: { hostAvailable?: boolean; status?: "active" | "closed" }): boolean {
  return card.hostAvailable === false || card.status === "closed";
}

export default function PastTracks({ locale, onBack }: { locale: Locale; onBack: () => void }) {
  const t = COPY[locale];
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [mine, setMine] = useState<PastRecipient[]>([]);
  const [host, setHost] = useState<PastHost[]>([]);
  /** One conversation open at a time — this is a record to look through, not a console. */
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      /*
        Both halves in parallel, and BOTH must arrive. A partial Past list is worse than an error:
        a person searching for something they know exists would conclude it is gone.
      */
      const [a, b] = await Promise.all([
        fetch("/api/bty/announcements/mine?scope=past", { credentials: "include", cache: "no-store" }),
        fetch("/api/bty/announcements/host?scope=past", { credentials: "include", cache: "no-store" }),
      ]);
      if (!a.ok || !b.ok) {
        setState("error");
        return;
      }
      const [ja, jb] = await Promise.all([a.json(), b.json()]);
      // Server order is already newest-first; re-sorting here would be a second ordering rule.
      setMine(Array.isArray(ja?.items) ? ja.items : []);
      setHost(Array.isArray(jb?.items) ? jb.items : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="past-tracks-back"
        onClick={onBack}
        className="min-h-[2.75rem] text-[0.85rem] text-white/60 hover:text-white/85"
      >
        ← {t.back}
      </button>
    </div>
  );

  if (state === "loading") {
    return (
      <section className="flex flex-col gap-3" data-testid="past-tracks">
        {header}
        <p className="text-[0.85rem] text-white/55" data-testid="past-tracks-loading">
          {t.loading}
        </p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="flex flex-col gap-3" data-testid="past-tracks">
        {header}
        <div className="flex flex-col gap-2" data-testid="past-tracks-error">
          <p className="text-[0.85rem] text-white/70">{t.failed}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-[2.75rem] self-start rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/85"
          >
            {t.retry}
          </button>
        </div>
      </section>
    );
  }

  const nothing = mine.length === 0 && host.length === 0;

  return (
    <section className="flex flex-col gap-4" data-testid="past-tracks">
      {header}
      <h2 className="text-[1.15rem] font-semibold text-white/90">{t.title}</h2>

      {/* Truthful and short. No explanation of what a Track is — somebody reading this already knows. */}
      {nothing ? (
        <p className="text-[0.9rem] text-white/55" data-testid="past-tracks-empty">
          {t.empty}
        </p>
      ) : null}

      {mine.length > 0 ? (
        <div className="flex flex-col gap-3" data-testid="past-tracks-from-others">
          <h3 className="text-[0.78rem] font-medium uppercase tracking-wide text-white/55">{t.fromOthers}</h3>
          {mine.map((it) => {
            const gone = it.hostAvailable === false;
            const open = openId === it.recipientId;
            return (
              <article key={it.recipientId} className={CARD} data-testid="past-track-recipient" data-host-gone={gone ? "1" : "0"}>
                <p className="text-[0.78rem] text-white/50">{it.hostDisplay || t.host}</p>
                <p className="text-[0.95rem] leading-6 text-white/85">{it.hostFraming}</p>

                {/* The same historical note the live card shows, from the same fact. */}
                {gone ? (
                  <p className="text-[0.8rem] text-white/55" data-testid="past-track-host-gone">
                    {t.hostGone}
                  </p>
                ) : null}

                <p className="text-[0.8rem] text-white/55" data-testid="past-track-answer">
                  {it.response === "ACKNOWLEDGED"
                    ? t.answeredGotIt
                    : it.response === "QUESTION"
                      ? t.answeredQuestion
                      : it.response === "HELP_NEEDED"
                        ? t.answeredHelp
                        : t.noAnswer}
                </p>

                {it.messageCount > 0 || !isFrozen(it) ? (
                  <>
                    <button
                      type="button"
                      data-testid="past-track-conversation-toggle"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : it.recipientId)}
                      className="min-h-[2.75rem] self-start text-[0.82rem] font-medium text-white/60 hover:text-white/85"
                    >
                      {open ? t.hideConversation : t.openConversation}
                    </button>
                    {open ? (
                      <TrackConversation
                        recipientId={it.recipientId}
                        locale={locale}
                        counterpartName={it.hostDisplay}
                        /*
                          Frozen only where the product genuinely cannot deliver another message.
                          A live Track keeps its composer — retrieval must not become a dead end.
                        */
                        readOnly={isFrozen(it)}
                      />
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {host.length > 0 ? (
        <div className="flex flex-col gap-3" data-testid="past-tracks-you-tracked">
          <h3 className="text-[0.78rem] font-medium uppercase tracking-wide text-white/55">{t.youTracked}</h3>
          {host.map((run) => {
            const everyone = [
              ...run.responders.question,
              ...run.responders.needHelp,
              ...run.responders.acknowledged,
              ...run.responders.noResponse,
            ];
            return (
              <article key={run.id} className={CARD} data-testid="past-track-host">
                <p className="text-[0.95rem] leading-6 text-white/85">{run.hostFraming}</p>
                <p className="text-[0.78rem] text-white/50">
                  {t.sent(run.funnel.announcedTo)}
                  {run.status === "closed" ? ` · ${t.closed}` : ""}
                </p>
                {everyone.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {everyone.map((p) => {
                      const open = openId === p.recipientId;
                      return (
                        <li key={p.recipientId} className="flex flex-col gap-1">
                          <button
                            type="button"
                            data-testid="past-track-responder"
                            aria-expanded={open}
                            /* A conversation that has not started yet can still be started, unless the run is closed. */
                            disabled={p.messageCount === 0 && run.status === "closed"}
                            onClick={() => setOpenId(open ? null : p.recipientId)}
                            className="min-h-[2.75rem] self-start text-left text-[0.82rem] text-white/65 disabled:text-white/55"
                          >
                            {/* A bound person whose provider name could not be read still appears — unnamed, never invented. */}
                            {p.display || t.host}
                          </button>
                          {open ? (
                            <TrackConversation
                              recipientId={p.recipientId}
                              locale={locale}
                              counterpartName={p.display}
                              /* A Host's own run is never ownerless — only closing freezes it. */
                              readOnly={run.status === "closed"}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
