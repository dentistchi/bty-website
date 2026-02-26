"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getMessages } from "@/lib/i18n";
import { fetchJson } from "@/lib/read-json";
import type { Locale } from "@/lib/i18n";
import { GuideCharacterAvatar, type GuideAvatarVariant } from "@/components/GuideCharacterAvatar";

type Message = {
  role: "user" | "assistant";
  content: string;
  suggestDearMe?: boolean;
  suggestDojo?: boolean;
  suggestMentor?: boolean;
  mentorPath?: string;
};

const TYPING_TIMEOUT_10S = 10_000;
const TYPING_TIMEOUT_25S = 25_000;

export function Chatbot() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/en") ? "en" : "ko";
  const i18n = getMessages(locale);
  const t = i18n.chat;
  const [open, setOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [rememberChat, setRememberChat] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeout10Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeout25Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (timeout10Ref.current) {
      clearTimeout(timeout10Ref.current);
      timeout10Ref.current = null;
    }
    if (timeout25Ref.current) {
      clearTimeout(timeout25Ref.current);
      timeout25Ref.current = null;
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, typingText, errorMsg]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (prefsLoaded) return;
      try {
        const prefsRes = await fetch("/api/me/conversation-preferences");
        setPrefsLoaded(true);
        if (!prefsRes.ok) return;
        const prefs = await prefsRes.json();
        setRememberChat(Boolean(prefs.rememberChat));
        if (!prefs.rememberChat) return;
        const convRes = await fetch("/api/me/conversations?channel=chat");
        if (!convRes.ok) return;
        const conv = await convRes.json();
        if (!conv.sessionId || !conv.messages?.length) return;
        const loaded: Message[] = conv.messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        setChatMessages(loaded);
        setChatSessionId(conv.sessionId);
        sessionIdRef.current = conv.sessionId;
      } catch {
        setPrefsLoaded(true);
      }
    })();
  }, [open, prefsLoaded]);

  const isBtyPage = pathname.includes("/bty");
  const isDearMePage = pathname.includes("/dear-me");
  const spaceLabel =
    locale === "ko"
      ? isDearMePage
        ? "Dear Me"
        : isBtyPage
          ? "Dojo · 연습"
          : "랜딩"
      : isDearMePage
        ? "Dear Me"
        : isBtyPage
          ? "Dojo"
          : "Home";
  const guideVariant: GuideAvatarVariant = pathname.includes("/dear-me")
    ? "warm"
    : pathname.includes("/bty-arena")
      ? "welcome"
      : "default";
  const introMessage =
    locale === "ko"
      ? isBtyPage
        ? "이제 다른 사람의 입장을 생각해볼까요? 오늘의 연습을 함께해요."
        : "지금 상태도 괜찮아요. 여기는 안전한 곳이에요."
      : isBtyPage
        ? "How about thinking from the other person's side? Let's practice together."
        : "You're okay as you are. This is a safe place.";

  const performSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const sid = sessionIdRef.current ?? crypto.randomUUID();
      if (!sessionIdRef.current) {
        sessionIdRef.current = sid;
        setChatSessionId(sid);
      }

      setLastUserMessage(trimmed);
      setInput("");
      setChatMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setIsTyping(true);
      setTypingText(t.thinking);
      setShowRetry(false);
      setErrorMsg(null);
      clearTimers();

      abortRef.current = new AbortController();

      timeout10Ref.current = setTimeout(() => {
        setTypingText(t.thinking);
      }, TYPING_TIMEOUT_10S);

      timeout25Ref.current = setTimeout(() => {
        setShowRetry(true);
      }, TYPING_TIMEOUT_25S);

      let hadError = false;
      let wasAborted = false;
      try {
        const mode = pathname.includes("/bty") ? "bty" : "today-me";
        const r = await fetchJson<{
          message?: string;
          suggestDearMe?: boolean;
          suggestDojo?: boolean;
          suggestMentor?: boolean;
          mentorPath?: string;
        }>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...chatMessages, { role: "user", content: trimmed }],
            mode,
            lang: locale,
          }),
          signal: abortRef.current.signal,
        });
        const reply =
          (r.ok ? r.json?.message : null) ||
          (locale === "ko"
            ? "말해줘서 고마워요. 여기선 뭐든 괜찮아요."
            : "Thanks for sharing. You're okay as you are.");
        const suggestDearMe = r.ok && r.json?.suggestDearMe === true;
        const suggestDojo = r.ok && r.json?.suggestDojo === true;
        const suggestMentor = r.ok && r.json?.suggestMentor === true;
        const mentorPath = r.ok && r.json?.mentorPath ? String(r.json.mentorPath) : undefined;
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, suggestDearMe, suggestDojo, suggestMentor, mentorPath },
        ]);
        if (rememberChat && sid) {
          try {
            await fetch("/api/me/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel: "chat", sessionId: sid, role: "user", content: trimmed }),
            });
            await fetch("/api/me/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel: "chat", sessionId: sid, role: "assistant", content: reply }),
            });
          } catch {
            // ignore
          }
        }
      } catch (err) {
        wasAborted = err instanceof Error && err.name === "AbortError";
        if (!wasAborted) {
          hadError = true;
          setErrorMsg(locale === "ko" ? "잠시 문제가 생겼어요. 다시 시도해 주세요." : "Something went wrong. Please try again.");
          setShowRetry(true);
        }
      } finally {
        clearTimers();
        abortRef.current = null;
        if (!wasAborted) {
          setIsTyping(false);
          setTypingText(null);
          if (!hadError) setShowRetry(false);
        }
      }
    },
    [isTyping, chatMessages, pathname, locale, t, clearTimers, rememberChat]
  );

  const send = () => {
    performSend(input);
  };

  const retry = () => {
    if (lastUserMessage) {
      abortRef.current?.abort();
      setErrorMsg(null);
      performSend(lastUserMessage);
    }
  };

  const toggleRememberChat = async () => {
    const next = !rememberChat;
    setRememberChat(next);
    try {
      const r = await fetch("/api/me/conversation-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberChat: next }),
      });
      if (!r.ok) setRememberChat(!next);
    } catch {
      setRememberChat(!next);
    }
  };

  const deleteChatHistory = async () => {
    if (locale === "ko" && !confirm("저장된 챗 대화 기록을 모두 삭제할까요?")) return;
    if (locale === "en" && !confirm("Delete all saved chat history?")) return;
    setDeletingChat(true);
    try {
      await fetch("/api/me/conversations?channel=chat", { method: "DELETE" });
      setChatMessages([]);
      setChatSessionId(null);
      sessionIdRef.current = null;
    } finally {
      setDeletingChat(false);
    }
  };

  const themeColors = isBtyPage
    ? {
        button: "bg-dojo-purple hover:bg-dojo-purple-dark text-white",
        border: "border-dojo-purple-muted",
        header: "text-dojo-purple-dark",
        close: "text-dojo-ink-soft hover:text-dojo-ink",
        userMsg: "bg-dojo-purple text-dojo-white",
        botMsg: "bg-dojo-purple-muted/50 text-dojo-ink",
        typing: "bg-dojo-purple-muted/50 text-dojo-ink-soft",
        input: "border-dojo-purple-muted focus:ring-dojo-purple/30",
        submit: "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
        retry: "text-dojo-purple",
      }
    : {
        button: "bg-dear-sage hover:bg-dear-sage-soft text-white",
        border: "border-dear-sage/20",
        header: "text-dear-charcoal",
        close: "text-dear-charcoal-soft hover:text-dear-charcoal",
        userMsg: "bg-dear-sage text-white",
        botMsg: "bg-dear-bg-paper text-dear-charcoal border border-dear-sage/10",
        typing: "bg-dear-bg-paper text-dear-charcoal-soft border border-dear-sage/10",
        input: "border-dear-sage/20 focus:ring-dear-sage/30",
        submit: "bg-dear-sage text-white hover:bg-dear-sage-soft",
        retry: "text-dear-sage",
      };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg",
          themeColors.button,
          "flex items-center justify-center transition-all hover:scale-105",
          open && "rotate-0"
        )}
        aria-label={t.title}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] max-w-md rounded-2xl border",
            themeColors.border,
            "bg-white shadow-xl flex flex-col max-h-[70vh] animate-fadeIn"
          )}
        >
          <div className={cn("p-3 border-b", themeColors.border, "flex items-center justify-between gap-2")}>
            <div className="flex items-center gap-2 min-w-0">
              <GuideCharacterAvatar variant={guideVariant} size="sm" className="flex-shrink-0" />
              <div className="min-w-0 flex flex-col">
                <span className={cn("text-sm font-medium truncate", themeColors.header)}>Dr. Chi</span>
                <span className="text-xs opacity-70 truncate">{spaceLabel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(themeColors.close, "p-1 transition-colors")}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
            {chatMessages.length === 0 && !typingText && !errorMsg && (
              <p className="text-sm text-dear-charcoal-soft">{introMessage}</p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-1">
                    <GuideCharacterAvatar variant={guideVariant} size="sm" className="flex-shrink-0" />
                    <span className="text-xs font-medium opacity-80">Dr. Chi</span>
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    m.role === "user" ? themeColors.userMsg : themeColors.botMsg
                  )}
                >
                  {m.content}
                </div>
                {m.role === "assistant" && m.suggestDearMe && (
                  <Link
                    href={locale === "en" ? "/en/dear-me" : "/ko/dear-me"}
                    className="mt-1.5 inline-block text-sm font-medium underline hover:no-underline"
                    style={isBtyPage ? { color: "var(--dojo-purple)" } : { color: "var(--dear-sage)" }}
                  >
                    {locale === "ko" ? "Dear Me로 가기 →" : "Go to Dear Me →"}
                  </Link>
                )}
                {m.role === "assistant" && m.suggestDojo && !m.suggestMentor && (
                  <Link
                    href={locale === "en" ? "/en/bty" : "/ko/bty"}
                    className="mt-1.5 inline-block text-sm font-medium underline hover:no-underline"
                    style={isBtyPage ? { color: "var(--dojo-purple)" } : { color: "var(--dear-sage)" }}
                  >
                    {locale === "ko" ? "훈련장(Dojo)으로 가기 →" : "Go to Dojo →"}
                  </Link>
                )}
                {m.role === "assistant" && m.suggestMentor && m.mentorPath && (
                  <Link
                    href={m.mentorPath}
                    className="mt-1.5 inline-block text-sm font-medium underline hover:no-underline"
                    style={isBtyPage ? { color: "var(--dojo-purple)" } : { color: "var(--dear-sage)" }}
                  >
                    {locale === "ko" ? "Dr. Chi 멘토와 깊이 대화하기 →" : "Talk with Dr. Chi Mentor →"}
                  </Link>
                )}
              </div>
            ))}
            {typingText && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <GuideCharacterAvatar variant={guideVariant} size="sm" className="flex-shrink-0" />
                  <span className="text-xs font-medium opacity-80">Dr. Chi</span>
                </div>
                <div className={cn("rounded-xl px-3 py-2 text-sm w-fit flex items-center gap-0.5", themeColors.typing)}>
                  <span>{typingText}</span>
                <span className="chat-typing-dots inline-flex">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
                </div>
              </>
            )}
            {errorMsg && (
              <div className="rounded-xl px-3 py-2 text-sm bg-red-50 text-red-700 max-w-[85%] border border-red-100">
                {errorMsg}
              </div>
            )}
            {showRetry && (
              <button
                type="button"
                onClick={retry}
                className={cn("text-sm font-medium hover:underline", themeColors.retry)}
              >
                {locale === "ko" ? "다시 시도" : "Retry"}
              </button>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className={cn("p-3 border-t", themeColors.border, "flex gap-2")}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              className={cn(
                "flex-1 rounded-xl border px-4 py-2 text-sm",
                themeColors.input,
                "focus:outline-none focus:ring-2"
              )}
            />
            <button
              type="submit"
              disabled={isTyping}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                themeColors.submit,
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {t.send}
            </button>
          </form>
          {prefsLoaded && (
            <div className={cn("px-3 pb-3 pt-1 border-t", themeColors.border, "flex flex-wrap items-center gap-2 text-xs")}>
              <label className="flex items-center gap-1.5 cursor-pointer opacity-80">
                <input
                  type="checkbox"
                  checked={rememberChat}
                  onChange={toggleRememberChat}
                  className="rounded border-current opacity-70"
                />
                <span>{locale === "ko" ? "대화 기억하기" : "Remember conversation"}</span>
              </label>
              <span className="opacity-50">·</span>
              <button
                type="button"
                onClick={deleteChatHistory}
                disabled={deletingChat}
                className={cn("hover:underline disabled:opacity-50", themeColors.retry)}
              >
                {locale === "ko" ? "기록 삭제" : "Delete history"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
