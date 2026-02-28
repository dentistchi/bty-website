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
 * 역지사지 시뮬레이터 (Integrity Mirror)
 * PROJECT_BACKLOG §7 2차 확장: 연습 플로우 2~5단계 (안내 → 시나리오 → 피드백 → 완료).
 * 단계: guide(안내) → scenario(시나리오·피드백) → done(완료).
 */

type Step = "guide" | "scenario" | "done";
type Message = { role: "user" | "chi"; text: string };

export default function IntegrityMirrorPage() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/ko") ? "ko" : "en";
  const t = getMessages(locale).integrity;

  const [step, setStep] = useState<Step>("guide");
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
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "chi", text: t.reply }]);
      setSending(false);
    }, 600);
  };

  const hasFeedback = messages.some((m) => m.role === "chi");

  if (step === "guide") {
    return (
      <AuthGate>
        <ThemeBody theme="dojo" />
        <main className="min-h-screen bg-dojo-white">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
            <Nav locale={locale} pathname={`/${locale}/bty/integrity`} />
            <header className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-semibold text-dojo-purple-dark">
                {t.title}
              </h1>
              <p className="text-dojo-ink-soft mt-1 text-sm">{t.subtitle}</p>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <p className="text-dojo-ink leading-relaxed mb-8 max-w-md">
                {t.guideMessage}
              </p>
              <button
                type="button"
                onClick={() => setStep("scenario")}
                className={cn(
                  "rounded-xl px-8 py-4 font-semibold text-white",
                  "bg-dojo-purple hover:bg-dojo-purple-dark transition-colors"
                )}
              >
                {t.startPractice}
              </button>
            </div>
            <footer className="pt-6 border-t border-dojo-purple-muted text-center text-sm">
              <Link
                href={locale === "ko" ? "/ko/bty" : "/en/bty"}
                className="text-dojo-purple hover:underline"
              >
                {t.backToDojo}
              </Link>
            </footer>
          </div>
        </main>
      </AuthGate>
    );
  }

  if (step === "done") {
    return (
      <AuthGate>
        <ThemeBody theme="dojo" />
        <main className="min-h-screen bg-dojo-white">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
            <Nav locale={locale} pathname={`/${locale}/bty/integrity`} />
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-dojo-purple-dark mb-3">
                {t.doneTitle}
              </h2>
              <p className="text-dojo-ink-soft text-sm mb-8 max-w-sm">
                {t.doneSub}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href={locale === "ko" ? "/ko/bty/mentor" : "/en/bty/mentor"}
                  className={cn(
                    "rounded-xl px-6 py-3 font-medium text-white",
                    "bg-dojo-purple hover:bg-dojo-purple-dark transition-colors"
                  )}
                >
                  {t.doneCtaMentor}
                </Link>
                <Link
                  href={locale === "ko" ? "/ko/bty" : "/en/bty"}
                  className={cn(
                    "rounded-xl px-6 py-3 font-medium",
                    "border border-dojo-purple-muted text-dojo-purple",
                    "hover:bg-dojo-purple/10 transition-colors"
                  )}
                >
                  {t.doneCtaDojo}
                </Link>
              </div>
            </div>
          </div>
        </main>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
          <Nav locale={locale} pathname={`/${locale}/bty/integrity`} />
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

            <div className="p-4 border-t border-dojo-purple-muted space-y-3">
              {hasFeedback && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setStep("done")}
                    className={cn(
                      "rounded-xl px-5 py-2.5 text-sm font-medium",
                      "bg-dojo-purple/10 text-dojo-purple border border-dojo-purple-muted",
                      "hover:bg-dojo-purple/20 transition-colors"
                    )}
                  >
                    {t.doneCtaComplete}
                  </button>
                </div>
              )}
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
            <Link
              href={locale === "ko" ? "/ko/bty" : "/en/bty"}
              className="text-dojo-purple hover:underline"
            >
              {t.backToDojo}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
