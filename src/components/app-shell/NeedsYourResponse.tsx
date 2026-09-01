"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnnouncementResponse } from "@/domain/announcement/trackedAnnouncement";

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
  hostFraming: string;
  hostDisplay: string | null;
  sourceUrl: string | null;
  response: AnnouncementResponse | null;
  respondedAt: string | null;
};

type Locale = "en" | "ko";

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    title: "Needs your response",
    openInTeams: "Open in Teams",
    gotIt: "Got it",
    question: "I have a question",
    help: "I need help applying this",
    questionPrompt: "What would you like clarified?",
    questionSend: "Send",
    answeredGotIt: "You said: Got it",
    answeredQuestion: "You asked a question",
    answeredHelp: "You asked for help",
    failed: "Couldn't save that.",
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
    answeredQuestion: "질문을 남기셨습니다",
    answeredHelp: "도움을 요청하셨습니다",
    failed: "저장하지 못했습니다.",
    retry: "다시 시도",
  },
};

export default function NeedsYourResponse({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [items, setItems] = useState<Item[] | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/announcements/mine", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const d = (await res.json()) as { items?: Item[] };
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  // Nothing to answer is not a state worth a card — the lane simply is not there.
  if (!items || items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-testid="needs-your-response">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.title}</h2>

      {items.map((it) => {
        const answered = it.response !== null;
        return (
          <article
            key={it.announcementId}
            data-testid="announcement-item"
            data-answered={answered ? "1" : "0"}
            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
          >
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
              <p className="text-[0.8rem] text-white/45" data-testid="announcement-answered">
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
                  className="min-h-[4.5rem] rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white/90"
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="announcement-got-it"
                  disabled={busy === it.announcementId}
                  onClick={() => void respond(it.announcementId, "ACKNOWLEDGED")}
                  className="rounded-lg bg-[#C9A66B] px-3.5 py-2 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
                >
                  {t.gotIt}
                </button>
                <button
                  type="button"
                  data-testid="announcement-question"
                  disabled={busy === it.announcementId}
                  onClick={() => setAsking(it.announcementId)}
                  className="rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-white/80 disabled:opacity-60"
                >
                  {t.question}
                </button>
                <button
                  type="button"
                  data-testid="announcement-help"
                  disabled={busy === it.announcementId}
                  onClick={() => void respond(it.announcementId, "HELP_NEEDED")}
                  className="rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-white/80 disabled:opacity-60"
                >
                  {t.help}
                </button>
              </div>
            )}

            {failed === it.announcementId ? (
              <p className="flex items-center gap-2 text-[0.78rem] text-white/55" data-testid="announcement-error">
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
