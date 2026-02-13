"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { cn } from "@/lib/utils";

/**
 * 역지사지 시뮬레이터 (Integrity Mirror)
 * 채팅 형태: 사용자 갈등 입력 → Dr. Chi "만약 입장이 반대라면 어떨까요?" 하드코딩
 */

type Message = { role: "user" | "chi"; text: string };

const DR_CHI_REPLY = "만약 입장이 반대라면 어떨까요?";
const DR_CHI_INTRO =
  "겪었던 갈등을 한 줄로 적어보세요. Dr. Chi가 역지사지 질문으로 도와드릴게요.";

export default function IntegrityMirrorPage() {
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const send = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    // 하드코딩: Dr. Chi 응답
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { role: "chi", text: DR_CHI_REPLY },
      ]);
      setSending(false);
    }, 600);
  };

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
          <Nav locale="ko" pathname="/bty/integrity" />
          <header className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-dojo-purple-dark">
              역지사지 시뮬레이터
            </h1>
            <p className="text-dojo-ink-soft mt-1 text-sm">
              Dr. Chi와 함께 갈등 상황을 돌려보세요.
            </p>
          </header>

          <div
            className={cn(
              "flex-1 rounded-2xl border border-dojo-purple-muted bg-dojo-white",
              "shadow-sm overflow-hidden flex flex-col"
            )}
          >
            <div className="p-4 border-b border-dojo-purple-muted bg-dojo-purple/5">
              <p className="text-sm text-dojo-ink-soft">{DR_CHI_INTRO}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
              {chatMessages.length === 0 && (
                <div className="text-center py-8 text-dojo-ink-soft text-sm">
                  갈등 상황을 입력하고 전송해보세요.
                </div>
              )}
              {chatMessages.map((m, i) => (
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
                    Dr. Chi가 생각 중…
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
                  placeholder="예: 직원에게 말했는데 상대가 불쾌해했어요"
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
                  전송
                </button>
              </div>
            </div>
          </div>

          <footer className="mt-6 pt-4 border-t border-dojo-purple-muted text-center text-sm">
            <Link href="/bty" className="text-dojo-purple hover:underline">
              훈련장으로 돌아가기
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
