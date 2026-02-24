"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Integrity Mirror (역지사지 시뮬레이터)
 * Chat-style: user conflict input → Dr. Chi reply
 */

type Message = { role: "user" | "chi"; text: string };

export default function IntegrityMirrorPage() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/ko") ? "ko" : "en";
  const t = getMessages(locale).integrity;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text }]);
    // 하드코딩: Dr. Chi 응답
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "chi", text: t.reply },
      ]);
      setSending(false);
    }, 600);
  };

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
          <Nav locale={locale} pathname={pathname} />
          <header className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-dojo-purple-dark">
              {t.title}
            </h1>
            <p className="text-dojo-ink-soft mt-1 text-sm">{t.subtitle}</p>
          </header>

          <div
            className={cn(
              "flex-1 rounded-2xl border border-dojo-purple-muted bg-dojo-white",
              "shadow-sm overflow-hidden flex flex-col"
            )}
          >
            <div className="p-4 border-b border-dojo-purple-muted bg-dojo-purple/5">
              <p className="text-sm text-dojo-ink-soft">{t.intro}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
              {messages.length === 0 && (
                <div className="text-center py-8 text-dojo-ink-soft text-sm">
                  {t.emptyHint}
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "bg-dojo-purple text-dojo-white rounded-br-md"
                        : "bg-dojo-purple-muted/40 text-dojo-ink border border-dojo-purple-muted rounded-bl-md"
                    )}
                  >
                    {m.role === "chi" && (
                      <span className="font-medium text-dojo-purple-dark block mb-1">
                        Dr. Chi
                      </span>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-dojo-purple-muted/30 text-dojo-ink-soft text-sm">
                    {t.thinking}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-dojo-purple-muted">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={t.placeholder}
                  className={cn(
                    "flex-1 rounded-xl px-4 py-3 text-sm",
                    "border border-dojo-purple-muted bg-dojo-white",
                    "placeholder:text-dojo-ink-soft/70",
                    "focus:outline-none focus:ring-2 focus:ring-dojo-purple/30 focus:border-dojo-purple"
                  )}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className={cn(
                    "rounded-xl px-5 py-3 font-medium text-sm",
                    "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors"
                  )}
                >
                  {t.send}
                </button>
              </div>
            </div>
          </div>

          <footer className="mt-6 pt-4 border-t border-dojo-purple-muted text-center text-sm">
            <Link href={locale === "ko" ? "/ko/bty" : "/en/bty"} className="text-dojo-purple hover:underline">
              {t.backToDojo}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
