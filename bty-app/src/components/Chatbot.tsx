"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Message = { role: "user" | "assistant"; content: string };

export function Chatbot() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/en") ? "en" : "ko";
  const t = getMessages(locale).chat;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isBty = pathname.includes("/bty");
  const introMessage =
    locale === "ko"
      ? isBty
        ? "이제 다른 사람의 입장을 생각해볼까요? 오늘의 연습을 함께해요."
        : "지금 상태도 괜찮아요. 여기는 안전한 곳이에요."
      : isBty
        ? "How about thinking from the other person's side? Let's practice together."
        : "You're okay as you are. This is a safe place.";

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const mode = pathname.includes("/bty") ? "bty" : "today-me";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          mode,
        }),
      });
      const data = await res.json();
      const reply = data.message || (locale === "ko" ? "말해줘서 고마워요. 여기선 뭐든 괜찮아요." : "Thanks for sharing. You’re okay as you are.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: locale === "ko" ? "잠시 뒤에 다시 말걸어 주세요. 실패해도 괜찮아요." : "Try again in a moment. It’s okay to fail.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg",
          "bg-dojo-purple text-white hover:bg-dojo-purple-dark",
          "flex items-center justify-center transition-transform",
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
            "fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] max-w-md rounded-2xl border border-dojo-purple-muted",
            "bg-dojo-white shadow-xl flex flex-col max-h-[70vh]"
          )}
        >
          <div className="p-3 border-b border-dojo-purple-muted flex items-center justify-between">
            <span className="text-sm font-medium text-dojo-purple-dark">{t.title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-dojo-ink-soft hover:text-dojo-ink p-1"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
            {messages.length === 0 && (
              <p className="text-sm text-dojo-ink-soft">{introMessage}</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm max-w-[85%]",
                  m.role === "user"
                    ? "ml-auto bg-dojo-purple text-dojo-white"
                    : "bg-dojo-purple-muted/50 text-dojo-ink"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="rounded-xl px-3 py-2 text-sm bg-dojo-purple-muted/50 text-dojo-ink-soft w-fit">
                {t.thinking}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-dojo-purple-muted flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              className={cn(
                "flex-1 rounded-xl border border-dojo-purple-muted px-4 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-dojo-purple/30"
              )}
            />
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium",
                "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
                "disabled:opacity-50"
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
