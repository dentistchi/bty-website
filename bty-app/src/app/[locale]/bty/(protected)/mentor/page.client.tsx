"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/read-json";

const DEAR_ME_URL = process.env.NEXT_PUBLIC_DEAR_ME_URL ?? "https://dear-me.pages.dev";

type TopicId = "clinical" | "patient" | "team" | "financial" | "selflove";

const TOPICS: { id: TopicId; label: string; subtitle: string }[] = [
  { id: "clinical", label: "Clinical Skills", subtitle: "임상 기술" },
  { id: "patient", label: "Patient Management", subtitle: "환자 관리" },
  { id: "team", label: "Team Relations", subtitle: "팀 관계" },
  { id: "financial", label: "Financial Advice", subtitle: "재무 조언" },
  { id: "selflove", label: "Self-Love", subtitle: "자기 사랑" },
];

type Message = {
  role: "user" | "chi";
  text: string;
  safetyValve?: boolean;
};

const DR_CHI_OPENINGS: Record<TopicId, string> = {
  clinical: "요즘 환자 보면서 뭐가 제일 힘드니?",
  patient: "환자 관리할 때 어떤 순간이 가장 막막해?",
  team: "팀 안에서 요즘 어떤 게 가장 고민이야?",
  financial: "재무 쪽에서 어떤 게 가장 부담돼?",
  selflove: "요즘 자기 자신에게 어떤 느낌이 드니?",
};

export default function MentorPage() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setSending(true);

    try {
      const history = [...messages, { role: "user" as const, text }];
      const r = await fetchJson<{ message?: string; safety_valve?: boolean }>("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic ?? "clinical",
          message: text,
          messages: history.map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      const reply = typeof r.json?.message === "string" ? r.json.message : "무슨 말씀인지 다시 해주실래요?";
      setMessages((prev) => [
        ...prev,
        {
          role: "chi",
          text: reply,
          safetyValve: Boolean(r.json?.safety_valve),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "chi",
          text: "연결이 잠깐 불안정했네요. 다시 말해주실래요?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const startTopic = (t: TopicId) => {
    setTopic(t);
    setMessages([
      {
        role: "chi",
        text: DR_CHI_OPENINGS[t],
      },
    ]);
  };

  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main
        className="min-h-screen"
        style={{
          background: "linear-gradient(180deg, #F5F0E8 0%, #EDE6DB 50%, #E8DFD2 100%)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
          <Nav locale={locale} pathname={pathname} />
          <header className="text-center mb-8">
            <h1
              className="text-2xl sm:text-3xl font-semibold text-mentor-ink"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Dr. Chi&apos;s Mentor
            </h1>
            <p className="text-mentor-ink-soft mt-1 text-sm">
              서재에서 차 한 잔 마시며 대화해요.
            </p>
          </header>

          {!topic ? (
            <div className="flex-1">
              <p className="text-center text-mentor-ink-soft text-sm mb-6">
                오늘 어떤 주제로 대화해볼까요?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => startTopic(t.id)}
                    className={cn(
                      "rounded-2xl border border-mentor-wood-soft/30 p-5 sm:p-6 text-left",
                      "bg-mentor-paper/80 hover:bg-mentor-paper",
                      "shadow-sm hover:shadow-md transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-mentor-wood-soft/40"
                    )}
                  >
                    <span
                      className="font-medium text-mentor-ink block"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {t.label}
                    </span>
                    <span className="text-xs text-mentor-ink-soft mt-0.5 block">
                      {t.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex-1 rounded-2xl border border-mentor-wood-soft/20",
                "bg-mentor-paper/90 shadow-lg overflow-hidden flex flex-col"
              )}
            >
              <div className="p-4 border-b border-mentor-wood-soft/20 bg-white/30">
                <p className="text-sm text-mentor-ink-soft">
                  {TOPICS.find((t) => t.id === topic)?.label} · {TOPICS.find((t) => t.id === topic)?.subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTopic(null);
                    setMessages([]);
                  }}
                  className="text-xs text-mentor-wood hover:underline mt-1"
                >
                  다른 주제 선택하기
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 min-h-[280px]">
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
                        "max-w-[88%] rounded-xl px-5 py-4 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-mentor-wood/10 text-mentor-ink border border-mentor-wood-soft/20 rounded-br-sm"
                          : "bg-white/70 text-mentor-ink border-l-4 border-mentor-wood-soft/50 rounded-bl-sm"
                      )}
                    >
                      {m.role === "chi" && (
                        <span
                          className="text-xs font-medium text-mentor-wood block mb-1.5"
                          style={{ fontFamily: "Georgia, serif" }}
                        >
                          Dr. Chi
                        </span>
                      )}
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.safetyValve && (
                        <a
                          href={DEAR_ME_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl",
                            "bg-dear-sage/20 text-dear-charcoal border border-dear-sage/40",
                            "hover:bg-dear-sage/30 transition-colors font-medium text-sm"
                          )}
                        >
                          Dear Me에서 마음 돌보기 →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-xl rounded-bl-sm px-5 py-4 bg-white/50 text-mentor-ink-soft text-sm border-l-4 border-mentor-wood-soft/30">
                      <span className="animate-pulse">생각하고 있어요…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-4 border-t border-mentor-wood-soft/20 bg-white/30">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                    placeholder="말씀해 주세요..."
                    className={cn(
                      "flex-1 rounded-xl px-4 py-3 text-sm",
                      "border border-mentor-wood-soft/30 bg-white",
                      "placeholder:text-mentor-ink-soft/60",
                      "focus:outline-none focus:ring-2 focus:ring-mentor-wood-soft/30 focus:border-mentor-wood-soft"
                    )}
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!input.trim() || sending}
                    className={cn(
                      "rounded-xl px-5 py-3 font-medium text-sm",
                      "bg-mentor-wood text-white hover:bg-mentor-wood-soft",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-colors"
                    )}
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          )}

          <footer className="mt-6 pt-4 border-t border-mentor-wood-soft/20 text-center text-sm text-mentor-ink-soft space-x-3">
            <Link href="/bty" className="text-mentor-wood hover:underline">
              훈련장으로
            </Link>
            <span>·</span>
            <Link href="/bty/integrity" className="text-mentor-wood hover:underline">
              역지사지 시뮬레이터
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
