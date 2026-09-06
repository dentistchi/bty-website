"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadMessage, ThreadRole } from "@/domain/announcement/announcementThread";
import { THREAD_MESSAGE_MAX } from "@/domain/announcement/announcementThread";

/**
 * The conversation under one Track, for whichever of its two people is looking at it.
 *
 * ★ ORDINARY WORKPLACE LANGUAGE, AND NO BTY CONCEPT TO LEARN.
 *
 * The words on screen are "Conversation", "Host", "You", "Write a reply…" and "Send". There is no
 * "thread", no "recipient record", no "announcement state", no "disposition" and no unread jargon —
 * somebody asked you something and you are answering them, which is a thing people already know how
 * to do. The only number shown anywhere is a plain count of new messages.
 *
 * ★ ONE COMPONENT, BOTH SIDES, BECAUSE IT IS ONE CONVERSATION.
 *
 * The Host and the recipient see the same messages in the same order; the only difference is which
 * of them is "You", and the SERVER decides that — `role` comes back from the route, which derives it
 * from announcement ownership. This component never compares user ids and has none to compare.
 *
 * ★ IT SHOWS ONLY ONE PERSON'S CONVERSATION, ALWAYS. It is addressed by a recipient id and the
 * route refuses every id the caller is not a party to, so there is no arrangement — not a prop, not
 * a bug, not a crafted id — in which two recipients' messages could appear together.
 *
 * ★ NOTHING IS SHOWN AS SENT BEFORE THE SERVER SAYS SO. No optimistic message. A reply a person
 * believes they sent, that never arrived, is the one failure this surface must not manufacture.
 */

type Locale = "en" | "ko";

const COPY = {
  en: {
    conversation: "Conversation",
    host: "Host",
    you: "You",
    placeholder: "Write a reply…",
    send: "Send",
    sending: "Sending…",
    empty: "No messages yet.",
    loadFailed: "Couldn't load the conversation.",
    sendFailed: "Couldn't send that.",
    tooLong: "That's too long to send.",
    retry: "Retry",
    newCount: (n: number) => `${n} new`,
  },
  ko: {
    conversation: "대화",
    host: "보낸 사람",
    you: "나",
    placeholder: "답장을 입력하세요…",
    send: "보내기",
    sending: "보내는 중…",
    empty: "아직 메시지가 없습니다.",
    loadFailed: "대화를 불러오지 못했습니다.",
    sendFailed: "보내지 못했습니다.",
    tooLong: "내용이 너무 깁니다.",
    retry: "다시 시도",
    newCount: (n: number) => `새 메시지 ${n}개`,
  },
} as const;

/**
 * A small, quiet count of what the other side said since this person last looked.
 *
 * Exported because both Track surfaces show it on their resting card, and a badge that is drawn
 * twice in two shapes is two things a reader has to learn.
 *
 * ★ NOT ON THE TEAMS APP BAR. That icon belongs to the Teams client and this application does not
 * control it; a count drawn here is the only one that can be honest.
 */
export function NewMessageBadge({ n, locale }: { n: number; locale: Locale }) {
  if (n <= 0) return null;
  return (
    <span
      data-testid="track-unread-badge"
      data-unread={n}
      className="inline-flex items-center rounded-full bg-[#C9A66B]/[0.15] px-2 py-0.5 text-[0.72rem] font-medium text-[#E5B769]"
    >
      {COPY[locale].newCount(n)}
    </span>
  );
}

function timeLabel(iso: string, locale: Locale): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days <= 0) {
    return at.toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (locale === "ko") return days === 1 ? "어제" : `${days}일 전`;
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export default function TrackConversation({
  recipientId,
  locale,
  /** The other person's name, when one is known. Never an email, and never invented. */
  counterpartName,
  onChanged,
}: {
  recipientId: string;
  locale: string;
  counterpartName?: string | null;
  onChanged?: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];

  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [role, setRole] = useState<ThreadRole | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<"failed" | "too_long" | null>(null);

  /**
   * ★ THE IDEMPOTENCY NONCE IS MINTED PER DRAFT, NOT PER REQUEST.
   *
   * A per-request key would make a double-tapped Send two different keys and therefore two
   * messages, which is the exact thing the key exists to prevent. It is minted once for the text
   * currently in the box and only replaced after the server has accepted that text — so every
   * retry of the SAME words carries the SAME key, and the second one returns the first message.
   */
  const nonce = useRef<string>("");
  if (!nonce.current) nonce.current = newNonce();

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/bty/announcements/recipients/${encodeURIComponent(recipientId)}/thread`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        setState("error");
        return;
      }
      const d = (await res.json().catch(() => null)) as
        | { ok?: boolean; role?: ThreadRole; messages?: ThreadMessage[] }
        | null;
      if (d?.ok !== true || !Array.isArray(d.messages)) {
        setState("error");
        return;
      }
      setMessages(d.messages);
      setRole(d.role ?? null);
      setState("ready");
      /*
        Opening the conversation moved this person's read cursor server-side, so the badge the
        parent is still drawing is now stale. Telling the parent is what makes it disappear —
        nothing is recomputed locally, the parent re-reads its own owner-scoped list.
      */
      onChanged?.();
    } catch {
      setState("error");
    }
  }, [recipientId, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > THREAD_MESSAGE_MAX) {
      setSendError("too_long");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(
        `/api/bty/announcements/recipients/${encodeURIComponent(recipientId)}/thread`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body, clientMessageId: nonce.current }),
        },
      );
      if (!res.ok) {
        setSendError("failed");
        return;
      }
      // Accepted. This text is settled, so the next thing typed is a new act and gets a new key.
      nonce.current = newNonce();
      setDraft("");
      await load();
    } catch {
      setSendError("failed");
    } finally {
      setSending(false);
    }
  }, [draft, sending, recipientId, load]);

  if (state === "loading") return null;

  if (state === "error") {
    return (
      <div className="flex flex-col gap-2" data-testid="track-conversation-error">
        <p className="text-[0.8rem] text-white/60">{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/70"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  const list = messages ?? [];

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
      data-testid="track-conversation"
      data-recipient={recipientId}
      data-role={role ?? ""}
    >
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.1em] text-white/50">{t.conversation}</p>

      {list.length === 0 ? (
        <p className="text-[0.8rem] text-white/50" data-testid="track-conversation-empty">
          {t.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="track-conversation-messages">
          {list.map((m) => {
            /*
              WHO SAID IT, decided from the SERVER'S role for this reader and the SERVER'S role for
              the message. Two facts the client was given, never two it worked out.
            */
            const mine = role !== null && m.authorRole === role;
            return (
              <div
                key={m.id}
                className="flex flex-col gap-0.5"
                data-testid="track-message"
                data-author={m.authorRole}
                data-mine={mine ? "1" : "0"}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[0.75rem] font-medium text-white/70">
                    {mine ? t.you : (m.authorDisplay ?? counterpartName ?? (m.authorRole === "HOST" ? t.host : t.you))}
                  </span>
                  <span className="text-[0.7rem] text-white/50">{timeLabel(m.createdAt, loc)}</span>
                </div>
                {/* Plain text. Rendered as a text node — there is no HTML path in or out of this. */}
                <p className="whitespace-pre-wrap break-words text-[0.86rem] leading-6 text-white/80">{m.body}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={`reply-${recipientId}`}>
          {t.placeholder}
        </label>
        <textarea
          id={`reply-${recipientId}`}
          data-testid="track-reply-input"
          value={draft}
          maxLength={THREAD_MESSAGE_MAX}
          placeholder={t.placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setSendError(null);
          }}
          className="min-h-[3.5rem] rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm text-white/90 placeholder:text-white/50"
        />
        <button
          type="button"
          data-testid="track-reply-send"
          disabled={sending || draft.trim().length === 0}
          onClick={() => void send()}
          className="min-h-[2.75rem] self-start rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
        >
          {sending ? t.sending : t.send}
        </button>
        {sendError ? (
          <p className="text-[0.78rem] text-white/60" data-testid="track-reply-error">
            {sendError === "too_long" ? t.tooLong : t.sendFailed}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** An opaque nonce. It names nothing and is scoped server-side under (recipient, author). */
function newNonce(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* falls through to the arithmetic form below */
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
