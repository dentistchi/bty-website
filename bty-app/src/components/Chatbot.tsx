"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getMessages } from "@/lib/i18n";
import { fetchJson } from "@/lib/read-json";
import type { Locale } from "@/lib/i18n";

type Message = { role: "user" | "assistant"; content: string };

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
  const abortRef = useRef<AbortController | null>(null);
  const timeout10Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeout25Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const isBtyPage = pathname.includes("/bty");
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
        const r = await fetchJson<{ message?: string }>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...chatMessages, { role: "user", content: trimmed }],
            mode,
          }),
          signal: abortRef.current.signal,
        });
        const reply =
          (r.ok ? r.json?.message : null) ||
          (locale === "ko"
            ? "말해줘서 고마워요. 여기선 뭐든 괜찮아요."
            : "Thanks for sharing. You're okay as you are.");
        setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
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
    [isTyping, chatMessages, pathname, locale, t, clearTimers]
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
          <div className={cn("p-3 border-b", themeColors.border, "flex items-center justify-between")}>
            <span className={cn("text-sm font-medium", themeColors.header)}>{t.title}</span>
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
              <div
                key={i}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm max-w-[85%]",
                  m.role === "user" ? cn("ml-auto", themeColors.userMsg) : themeColors.botMsg
                )}
              >
                {m.content}
              </div>
            ))}
            {typingText && (
              <div className={cn("rounded-xl px-3 py-2 text-sm w-fit flex items-center gap-0.5", themeColors.typing)}>
                <span>{typingText}</span>
                <span className="chat-typing-dots inline-flex">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
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
        </div>
      )}
    </>
  );
}
