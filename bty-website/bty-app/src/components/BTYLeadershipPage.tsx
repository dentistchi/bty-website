"use client";

import { useState, useCallback, useRef } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Modal } from "@/components/ui/Modal";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "http://localhost:4000";
const TYPING_TIMEOUT_10S = 10_000;
const TYPING_TIMEOUT_25S = 25_000;

const SUGGESTED_PROMPTS = [
  "I feel frustrated with my team.",
  "I am unsure about a financial decision.",
  "There is tension between offices.",
];

function LeadershipChatModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("BTY is thinking");
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
      setTypingText("BTY is thinking");
      clearTimers();
      abortRef.current = new AbortController();

      timeout10Ref.current = setTimeout(() => {
        setTypingText("Hold on, organizing a better response");
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
            role: "leader" as const,
            message: trimmed,
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");

        setReply(data.reply ?? "Thank you for sharing.");
        if (data.maturitySignal) showMaturitySignal(data.maturitySignal);
      } catch (err) {
        wasAborted = err instanceof Error && err.name === "AbortError";
        if (!wasAborted) {
          hadError = true;
          setErrorMsg("Connection dropped briefly. Try sending again?");
          setShowRetry(true);
        }
      } finally {
        clearTimers();
        abortRef.current = null;
        if (!wasAborted) {
          setIsTyping(false);
          if (!hadError) setShowRetry(false);
        }
      }
    },
    [isTyping, user, showMaturitySignal, clearTimers]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(message);
    setMessage("");
  };

  const handleRetry = () => {
    if (lastUserMessage) {
      abortRef.current?.abort();
      setErrorMsg(null);
      sendMessage(lastUserMessage);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setMessage(prompt);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leadership Reflection"
      className="max-w-2xl w-full"
    >
      <div className="flex max-h-[85vh]">
        {/* Suggested prompts sidebar */}
        <aside className="hidden sm:flex flex-col w-56 border-r border-dojo-purple-muted bg-dojo-purple-muted/20 p-4 gap-2 rounded-l-2xl">
          <p className="text-xs font-medium text-dojo-ink-soft uppercase tracking-wider mb-1">
            Suggested prompts
          </p>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className="text-left text-sm p-3 rounded-xl border border-dojo-purple-muted hover:bg-dojo-purple-muted/40 text-dojo-ink transition-colors"
            >
              {prompt}
            </button>
          ))}
        </aside>

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="p-4 border-b border-dojo-purple-muted">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-dojo-purple-dark">
                  Leadership Reflection
                </h2>
                <p className="text-xs text-dojo-ink-soft mt-0.5">
                  Mature decision-making under pressure.
                </p>
              </div>
              <span className="text-xs text-dojo-purple-dark/70 font-medium px-2.5 py-1 rounded-md bg-dojo-purple-muted/30 border border-dojo-purple-muted/50">
                Advanced Reflection Active
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 min-h-[200px] space-y-3">
            {reply && !errorMsg && (
              <div className="rounded-xl bg-dojo-purple-muted/30 p-4 text-dojo-ink text-sm leading-relaxed whitespace-pre-wrap">
                {reply}
              </div>
            )}
            {isTyping && (
              <div className="rounded-xl bg-dojo-purple-muted/30 px-4 py-3 text-dojo-ink-soft text-sm flex items-center gap-0.5">
                <span>{typingText}</span>
                <span className="chat-typing-dots inline-flex">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}
            {errorMsg && (
              <div className="space-y-2">
                <div className="rounded-xl bg-red-50 text-red-700 p-4 text-sm">
                  {errorMsg}
                </div>
              </div>
            )}
            {showRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-sm font-medium text-dojo-purple hover:underline"
              >
                Send again
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-dojo-purple-muted">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your situation…"
                disabled={isTyping}
                className="flex-1 rounded-xl border border-dojo-purple-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dojo-purple/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isTyping || !message.trim()}
                className="px-5 py-3 rounded-xl bg-dojo-purple text-white font-medium text-sm hover:bg-dojo-purple-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Maturity signal - floats, fades out after 3s */}
      {maturitySignal && (
        <div
          role="status"
          className="absolute bottom-4 left-1/2 z-10 px-5 py-3 rounded-xl bg-dojo-purple-dark/95 text-white text-sm shadow-lg animate-maturity-popup"
          aria-live="polite"
          style={{ animationDuration: "3s" }}
        >
          {maturitySignal}
        </div>
      )}
    </Modal>
  );
}

export function BTYLeadershipPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <Nav locale="ko" pathname="/bty" />
        <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-dojo-purple-dark">
            BTY Leadership Practice
          </h1>
          <p className="mt-4 text-dojo-ink-soft text-lg">
            Mature decision-making under pressure.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-10 px-8 py-4 rounded-2xl bg-dojo-purple text-white font-medium text-lg hover:bg-dojo-purple-dark transition-colors shadow-md hover:shadow-lg"
          >
            Start Leadership Reflection
          </button>
        </div>

        <LeadershipChatModal open={modalOpen} onClose={() => setModalOpen(false)} />

        <footer className="absolute bottom-6 left-0 right-0 text-center text-sm text-dojo-ink-soft">
          <a href="/" className="text-dojo-purple hover:underline">
            Dear Me
          </a>
          <span className="mx-2">·</span>
          <a href="/bty/mentor" className="text-dojo-purple hover:underline">
            Dr. Chi Mentor
          </a>
          <span className="mx-2">·</span>
          <a href="/bty/journey" className="text-dojo-purple hover:underline">
            28일 여정
          </a>
        </footer>
      </main>
    </AuthGate>
  );
}
