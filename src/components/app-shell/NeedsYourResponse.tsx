"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AnnouncementResponse } from "@/domain/announcement/trackedAnnouncement";
import TrackConversation, { NewMessageBadge } from "./TrackConversation";

/**
 * Today → Needs your response. Slice A1.
 *
 * ITS OWN LANE, DELIBERATELY. This is not Required Learning, not Practice, not Apply this week and
 * not Saved for later, and it must not borrow any of their language. Someone chose to ask YOU
 * something and is waiting — that is a different obligation from a training you were assigned and
 * from a thing you chose not to lose, and collapsing them would make all three mean less.
 *
 * WHAT IS SHOWN, AND WHAT CANNOT BE. The Host's own framing, and a link. NEVER the captured Teams
 * message: the source may be a private-channel post, and being selected into a BTY audience proves
 * nothing about whether Teams would let you read the original. The link is safe precisely because
 * Teams still decides — it opens Teams, which applies its own access rules.
 *
 * THREE VISIBLE BUTTONS. No swipe, no dropdown, no confirmation dialog: a hidden gesture must never
 * be the only way to do a required thing, and the choices are the whole interaction. Answering is
 * WRITE-ONCE, so the controls go away once a response is settled — there is no undo in V1 and the
 * surface must not imply one.
 */

type Item = {
  announcementId: string;
  /** THIS person's own row — the address of their own private conversation, and nobody else's. */
  recipientId: string;
  hostFraming: string;
  hostDisplay: string | null;
  sourceUrl: string | null;
  response: AnnouncementResponse | null;
  respondedAt: string | null;
  /** Messages from the Host this person has not opened. Their own replies never count. */
  unreadCount: number;
  messageCount: number;
};

type Locale = "en" | "ko";

const COPY = {
  en: {
    title: "Needs your response",
    openInTeams: "Open in Teams",
    gotIt: "Got it",
    question: "I have a question",
    help: "I need help applying this",
    questionPrompt: "What would you like clarified?",
    questionSend: "Send",
    answeredGotIt: "You said: Got it",
    openConversation: "Open conversation",
    hideConversation: "Hide conversation",
    newCount: (n: number) => ` · ${n} new`,
    answeredQuestion: "You asked a question",
    answeredHelp: "You asked for help",
    failed: "Couldn't save that.",
    loadFailed: "Couldn't load what needs your response.",
    retry: "Retry",
  },
  ko: {
    title: "답변이 필요합니다",
    openInTeams: "Teams에서 열기",
    gotIt: "확인했습니다",
    question: "질문이 있습니다",
    help: "적용에 도움이 필요합니다",
    questionPrompt: "무엇을 명확히 하고 싶으신가요?",
    questionSend: "보내기",
    answeredGotIt: "답변: 확인했습니다",
    openConversation: "대화 열기",
    hideConversation: "대화 접기",
    newCount: (n: number) => ` · 새 메시지 ${n}개`,
    answeredQuestion: "질문을 남기셨습니다",
    answeredHelp: "도움을 요청하셨습니다",
    failed: "저장하지 못했습니다.",
    loadFailed: "답변이 필요한 항목을 불러오지 못했습니다.",
    retry: "다시 시도",
  },
} as const;

export default function NeedsYourResponse({ locale, refreshKey }: { locale: Locale; refreshKey?: number }) {
  const t = COPY[locale];
  const [items, setItems] = useState<Item[] | null>(null);
  /**
   * ★ AN EMPTY LIST AND A FAILED REQUEST ARE NOT THE SAME THING (2026-09-02).
   *
   * This mapped EVERY failure to `setItems([])`, which renders nothing — so when the route was
   * refusing `403 consent_required` for a Teams-first person, this lane simply was not there and
   * the fault was invisible. Only the Host lane, which showed an error, revealed it.
   *
   * A question someone is waiting on must not disappear because a request failed.
   */
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [asking, setAsking] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * WHICH CONVERSATIONS ARE OPEN — an override map, not the state itself.
   *
   * The DEFAULT is derived per card (`unreadCount > 0` auto-expands), so a person who has something
   * waiting never has to discover a control to reach it. This map only records a DELIBERATE toggle,
   * which is why it is keyed and sparse rather than initialised from the list: a later refresh that
   * changes the unread count must not silently re-collapse something the person opened by hand.
   */
  const [convoOverride, setConvoOverride] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    /** One request, and at most ONE retry after re-reading the session for a rotated token. */
    const attempt = async (): Promise<Response | null> => {
      try {
        return await fetch("/api/bty/announcements/mine", { credentials: "include", cache: "no-store" });
      } catch {
        return null;
      }
    };

    let res = await attempt();
    if (res?.status === 401) {
      try {
        await supabase?.auth.getSession();
      } catch {
        /* Handled by the retry's own result. */
      }
      res = await attempt();
    }

    if (!res || !res.ok) {
      setLoadState("error");
      return;
    }

    const d = (await res.json().catch(() => null)) as { items?: Item[] } | null;
    setItems(Array.isArray(d?.items) ? d!.items! : []);
    setLoadState("ready");
  }, []);

  /*
    Re-read on mount AND whenever Today is re-entered. `refreshKey` changes only on a real tab
    press, so this is one request per deliberate return — not an interval, not a visibility
    listener, and not a realtime channel.
  */
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const respond = useCallback(
    async (id: string, response: AnnouncementResponse, text?: string) => {
      setBusy(id);
      setFailed(null);
      try {
        const res = await fetch(`/api/bty/announcements/${encodeURIComponent(id)}/respond`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ response, questionText: text ?? null }),
        });
        if (!res.ok) {
          // Say so rather than looking inert; nothing is optimistically shown as saved.
          setFailed(id);
          return;
        }
        setAsking(null);
        setQuestionText("");
        await load();
      } catch {
        setFailed(id);
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (loadState === "error") {
    return (
      <section className="flex flex-col gap-2" data-testid="needs-your-response-error">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/55">{t.title}</h2>
        <p className="text-[0.8rem] text-white/60">{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/70"
        >
          {t.retry}
        </button>
      </section>
    );
  }

  // Nothing to answer is not a state worth a card — the lane simply is not there.
  if (loadState === "loading" || !items || items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-testid="needs-your-response">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/55">{t.title}</h2>

      {items.map((it) => {
        const answered = it.response !== null;
        /*
          ★ A QUESTION OR A REQUEST FOR HELP IS NEVER FINISHED BY THE FIRST TAP.

          Those two responses are the START of something, so their conversation is always reachable
          — even with zero messages, where HELP_NEEDED correctly opens on an empty thread and the
          person writes the first free-text follow-up themselves. Nothing is fabricated for them.

          ACKNOWLEDGED is an ENDING. It gets a conversation only once one actually exists, i.e. the
          Host wrote to them.
        */
        const continuable = it.response === "QUESTION" || it.response === "HELP_NEEDED";
        const canConverse = continuable || it.messageCount > 0;
        // Unread AUTO-EXPANDS. A deliberate toggle wins over that default, in both directions.
        const convoOpen = convoOverride[it.recipientId] ?? it.unreadCount > 0;
        return (
          <article
            key={it.announcementId}
            data-testid="announcement-item"
            data-answered={answered ? "1" : "0"}
            className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
          >
            {/*
              WHO IS ASKING, when the provider gave BTY a name. Never an email, and never invented:
              a Host whose name could not be read simply is not named here.
            */}
            {it.hostDisplay || it.unreadCount > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.78rem] text-white/55" data-testid="announcement-host">
                  {it.hostDisplay ?? ""}
                </span>
                <NewMessageBadge n={it.unreadCount} locale={locale} />
              </div>
            ) : null}

            <p className="text-[0.95rem] leading-6 text-white/85">{it.hostFraming}</p>

            {it.sourceUrl ? (
              <a
                href={it.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="announcement-source-link"
                className="text-[0.8rem] font-medium text-[#C9A66B]"
              >
                {t.openInTeams}
              </a>
            ) : null}

            {answered ? (
              <p className="text-[0.8rem] text-white/55" data-testid="announcement-answered">
                {it.response === "ACKNOWLEDGED"
                  ? t.answeredGotIt
                  : it.response === "QUESTION"
                    ? t.answeredQuestion
                    : t.answeredHelp}
              </p>
            ) : asking === it.announcementId ? (
              <div className="flex flex-col gap-2" data-testid="announcement-question-form">
                <label className="text-[0.8rem] text-white/60" htmlFor={`q-${it.announcementId}`}>
                  {t.questionPrompt}
                </label>
                <textarea
                  id={`q-${it.announcementId}`}
                  value={questionText}
                  maxLength={1000}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="min-h-[4.5rem] rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm text-white/90"
                />
                <button
                  type="button"
                  data-testid="announcement-question-send"
                  disabled={busy === it.announcementId || questionText.trim().length === 0}
                  onClick={() => void respond(it.announcementId, "QUESTION", questionText)}
                  className="self-start rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
                >
                  {t.questionSend}
                </button>
              </div>
            ) : (
              /*
                ★ ONE STACK, FULL-WIDTH, 44px TARGETS (production defect, 2026-09-02).

                MEASURED at 390px with real touch events: these three wrapped onto two lines, and
                "I have a question" ended up 8px above "I need help applying this". A tap SIX
                pixels below the intended button landed on the one under it and committed
                HELP_NEEDED instantly, with no question text — which is exactly what production
                shows for a person who reports choosing "I have a question": HELP_NEEDED stored,
                question_text NULL. Write-once then made that permanent.

                The mapping was never wrong. The geometry was: a 38px irreversible target sitting
                8px under a benign one, in a wrap order the label lengths decide. Stacking removes
                the wrap (so no label edit can rearrange them), full width removes the horizontal
                near-miss, and 2.75rem is the thumb target this app already uses on the Saved for
                later controls. gap-3 keeps a slip inside the button it started in.
              */
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  data-testid="announcement-got-it"
                  disabled={busy === it.announcementId}
                  onClick={() => void respond(it.announcementId, "ACKNOWLEDGED")}
                  className="min-h-[2.75rem] w-full rounded-lg bg-[#C9A66B] px-3.5 py-2 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
                >
                  {t.gotIt}
                </button>
                <button
                  type="button"
                  data-testid="announcement-question"
                  disabled={busy === it.announcementId}
                  onClick={() => setAsking(it.announcementId)}
                  className="min-h-[2.75rem] w-full rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-white/80 disabled:opacity-60"
                >
                  {t.question}
                </button>
                <button
                  type="button"
                  data-testid="announcement-help"
                  disabled={busy === it.announcementId}
                  onClick={() => void respond(it.announcementId, "HELP_NEEDED")}
                  className="min-h-[2.75rem] w-full rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-white/80 disabled:opacity-60"
                >
                  {t.help}
                </button>
              </div>
            )}

            {/*
              ★ THE CONVERSATION CONTINUES WHERE THE ONE-SHOT ANSWER USED TO STOP.

              ★ MEASURED PRODUCTION FAILURE (2026-09-06). A real recipient with response=QUESTION, a
              Host reply waiting and unread=1 saw only "You asked a question" and had NO way to
              reach it. Two things were wrong, and both are repaired here.

              (1) ACKNOWLEDGED opened a composer it had no business opening. `answered` was the gate,
                  and "Got it" is an ENDING — offering a reply box under it invents a conversation
                  nobody started. It now needs a real message to exist first.

              (2) A conversation that exists was reachable only by scrolling to a component that
                  rendered NOTHING until its fetch resolved. Waiting is now visible, and anything
                  unread AUTO-EXPANDS so the person never has to find a control to be told
                  somebody answered them.

              ★ HANDLED DOES NOT APPEAR HERE, AND CANNOT. `handled_at` is the HOST's workflow state;
              it is not in `RecipientProjection` at all, so no branch on this surface can read it.
              A recipient can always reply, and that reply clears the flag in the same database
              transaction — the Host never has to press Reopen first.
            */}
            {canConverse ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  data-testid="announcement-conversation-toggle"
                  data-open={convoOpen ? "1" : "0"}
                  aria-expanded={convoOpen}
                  onClick={() => setConvoOverride((m) => ({ ...m, [it.recipientId]: !convoOpen }))}
                  className={
                    "min-h-[2.75rem] self-start text-[0.82rem] font-medium " +
                    (it.unreadCount > 0 ? "text-[#E5B769]" : "text-white/60 hover:text-white/80")
                  }
                >
                  {convoOpen ? t.hideConversation : t.openConversation}
                  {it.unreadCount > 0 ? t.newCount(it.unreadCount) : ""}
                </button>

                {/*
                  MOUNTED ONLY WHEN OPEN, DELIBERATELY. Opening is what performs the read — the
                  component's own fetch is the mark-read call — so mounting it collapsed would mark
                  a Host reply read that the person never actually saw.
                */}
                {convoOpen ? (
                  <TrackConversation
                    recipientId={it.recipientId}
                    locale={locale}
                    counterpartName={it.hostDisplay}
                    onChanged={load}
                  />
                ) : null}
              </div>
            ) : null}

            {failed === it.announcementId ? (
              <p className="flex items-center gap-2 text-[0.78rem] text-white/60" data-testid="announcement-error">
                <span>{t.failed}</span>
                <button
                  type="button"
                  onClick={() => setFailed(null)}
                  className="rounded-md border border-white/15 px-2 py-0.5 text-[0.75rem] font-medium text-white/70"
                >
                  {t.retry}
                </button>
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
