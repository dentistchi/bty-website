"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "http://localhost:4000";
const TYPING_TIMEOUT_10S = 10_000;
const TYPING_TIMEOUT_25S = 25_000;

export function DearMeChat() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("BTY가 생각 중");
  const [showRetry, setShowRetry] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [maturitySignal, setMaturitySignal] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeout10Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeout25Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMaturitySignal = useCallback((signal: string) => {
    setMaturitySignal(signal);
    setTimeout(() => setMaturitySignal(null), 3000);
  }, []);

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping || !user) return;

      setLastUserMessage(trimmed);
      setReply(null);
      setErrorMsg(null);
      setShowRetry(false);
      setIsTyping(true);
      setTypingText("BTY가 생각 중");
      clearTimers();
      abortRef.current = new AbortController();

      timeout10Ref.current = setTimeout(() => {
        setTypingText("잠깐만요, 더 정확히 정리해서 답할게요");
      }, TYPING_TIMEOUT_10S);

      timeout25Ref.current = setTimeout(() => {
        setShowRetry(true);
      }, TYPING_TIMEOUT_25S);

      let hadError = false;
      let wasAborted = false;
      try {
        const res = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            role: "staff" as const,
            message: trimmed,
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "오류가 발생했어요");
        }

        setReply(data.reply ?? "말해줘서 고마워요.");

        if (data.maturitySignal) {
          showMaturitySignal(data.maturitySignal);
        }
      } catch (err) {
        wasAborted = err instanceof Error && err.name === "AbortError";
        if (!wasAborted) {
          hadError = true;
          setErrorMsg("연결이 잠깐 끊겼어요. 다시 한 번 보내볼까요?");
          setShowRetry(true);
        }
      } finally {
        clearTimers();
        abortRef.current = null;
        if (!wasAborted) {
          setIsTyping(false);
          if (!hadError) setShowRetry(false);
          setMessage("");
        }
      }
    },
    [isTyping, user, showMaturitySignal, clearTimers]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(message);
    },
    [message, sendMessage]
  );

  const handleRetry = () => {
    if (lastUserMessage) {
      abortRef.current?.abort();
      setErrorMsg(null);
      sendMessage(lastUserMessage);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[60vh]">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="오늘, 나에게 해주고 싶은 말은?"
          rows={5}
          disabled={isTyping}
          className={`
            w-full rounded-2xl border-2 border-sanctuary-peach/60
            bg-white/90 px-6 py-5 text-lg placeholder:text-sanctuary-text-soft/70
            focus:border-sanctuary-sage focus:outline-none focus:ring-2 focus:ring-sanctuary-sage/30
            resize-none transition-all
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        />
        <button
          type="submit"
          disabled={isTyping || !message.trim()}
          className="mt-4 w-full py-4 rounded-2xl font-medium text-lg bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isTyping ? "생각 중…" : "보내기"}
        </button>
      </form>

      {isTyping && (
        <div className="mt-8 w-full max-w-2xl rounded-2xl border border-sanctuary-lavender/50 bg-sanctuary-blush/40 px-6 py-5 text-sanctuary-text-soft flex items-center gap-0.5">
          <span>{typingText}</span>
          <span className="chat-typing-dots inline-flex">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      )}

      {reply && !errorMsg && (
        <div className="mt-8 w-full max-w-2xl rounded-2xl border border-sanctuary-lavender/50 bg-sanctuary-blush/40 px-6 py-5 text-sanctuary-text leading-relaxed whitespace-pre-wrap">
          {reply}
        </div>
      )}

      {errorMsg && (
        <div className="mt-8 w-full max-w-2xl space-y-2">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
            {errorMsg}
          </div>
          {showRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="text-sanctuary-sage font-medium hover:underline"
            >
              다시 보내기
            </button>
          )}
        </div>
      )}

      {showRetry && !errorMsg && (
        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 text-sanctuary-sage font-medium hover:underline"
        >
          다시 보내기
        </button>
      )}

      {/* Maturity signal - floating, fades out after 3s */}
      {maturitySignal && (
        <div
          role="status"
          className="fixed bottom-12 left-1/2 z-50 px-6 py-4 rounded-2xl bg-sanctuary-sage/95 text-sanctuary-text shadow-lg animate-maturity-popup"
          aria-live="polite"
        >
          {maturitySignal}
        </div>
      )}
    </div>
  );
}
