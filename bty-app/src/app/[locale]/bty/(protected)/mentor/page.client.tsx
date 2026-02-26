"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/read-json";

const DEAR_ME_URL = process.env.NEXT_PUBLIC_DEAR_ME_URL ?? "https://dear-me.pages.dev";

type TopicId = "clinical" | "patient" | "team" | "financial" | "selflove";

const TOPICS_KO: { id: TopicId; label: string; subtitle: string }[] = [
  { id: "clinical", label: "Clinical Skills", subtitle: "임상 기술" },
  { id: "patient", label: "Patient Management", subtitle: "환자 관리" },
  { id: "team", label: "Team Relations", subtitle: "팀 관계" },
  { id: "financial", label: "Financial Advice", subtitle: "재무 조언" },
  { id: "selflove", label: "Self-Love", subtitle: "자기 사랑" },
];

const TOPICS_EN: { id: TopicId; label: string; subtitle: string }[] = [
  { id: "clinical", label: "Clinical Skills", subtitle: "Procedures & confidence" },
  { id: "patient", label: "Patient Management", subtitle: "Communication & boundaries" },
  { id: "team", label: "Team Relations", subtitle: "Conflict & leadership" },
  { id: "financial", label: "Financial Advice", subtitle: "Practice & personal" },
  { id: "selflove", label: "Self-Love", subtitle: "Burnout & self-care" },
];

type Message = {
  role: "user" | "chi";
  text: string;
  safetyValve?: boolean;
};

const DR_CHI_OPENINGS_KO: Record<TopicId, string> = {
  clinical: "요즘 환자 보면서 뭐가 제일 힘드신가요?",
  patient: "환자 관리할 때 어떤 순간이 가장 막막하신가요?",
  team: "팀 안에서 요즘 어떤 게 가장 고민이신가요?",
  financial: "재무 쪽에서 어떤 게 가장 부담되시나요?",
  selflove: "요즘 자기 자신에게 어떤 느낌이 드시나요?",
};

const DR_CHI_OPENINGS_EN: Record<TopicId, string> = {
  clinical: "What’s been the hardest part lately when seeing patients?",
  patient: "When do you feel most stuck in patient management?",
  team: "What’s weighing on you most in your team right now?",
  financial: "What feels most stressful about finances at the moment?",
  selflove: "How have you been feeling about yourself lately?",
};

const MENTOR_UI = {
  ko: {
    slogan: "서재에서 차 한 잔 마시며 대화해요.",
    topicPrompt: "오늘 어떤 주제로 대화해볼까요?",
    rememberLabel: "대화 기억하기 (다음 로그인 시 이어보기)",
    deleteHistory: "기록 삭제",
    deleting: "삭제 중…",
    eliteBadge: "상위 5%",
    selectOtherTopic: "다른 주제 선택하기",
    endConversation: "대화 끝내기",
    placeholder: "말씀해 주세요...",
    send: "전송",
    conversationEnded: "대화가 끝났습니다.",
    conversationEndedSub: "오늘 대화 잘 마무리하셨어요. 필요할 때 다시 찾아오세요.",
    goOtherTopic: "다른 주제로",
    goDojo: "훈련장으로 나가기",
    thinking: "생각하고 있어요…",
    dearMeLink: "Dear Me에서 마음 돌보기 →",
    toDojo: "훈련장으로",
    toIntegrity: "역지사지 시뮬레이터",
    goodbyeReply: "오늘 대화 잘 마무리하셨어요. 필요할 때 다시 찾아오세요.",
    seeYouNext: "다음에 또 만나요",
    goToMain: "메인으로",
  },
  en: {
    slogan: "Let’s talk over a cup of tea in the study.",
    topicPrompt: "What would you like to talk about today?",
    rememberLabel: "Remember conversation (resume next login)",
    deleteHistory: "Delete history",
    deleting: "Deleting…",
    eliteBadge: "Top 5%",
    selectOtherTopic: "Select another topic",
    endConversation: "End conversation",
    placeholder: "Type your message...",
    send: "Send",
    conversationEnded: "Conversation ended.",
    conversationEndedSub: "You’ve wrapped up well today. Come back whenever you need.",
    goOtherTopic: "Another topic",
    goDojo: "Back to Dojo",
    thinking: "Thinking…",
    dearMeLink: "Take care of yourself on Dear Me →",
    toDojo: "Dojo",
    toIntegrity: "Integrity simulator",
    goodbyeReply: "Thanks for the conversation today. Come back whenever you need.",
    seeYouNext: "See you next time",
    goToMain: "Go to Main",
  },
} as const;

const END_PHRASES_KO = ["끝내자", "대화 끝", "끝내요", "그만할게", "나갈게", "대화 끝내"];
const END_PHRASES_EN = ["bye", "goodbye", "end conversation", "quit", "exit", "stop", "that's all", "end"];
function isEndConversationMessage(text: string, isEn: boolean): boolean {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const list = isEn ? END_PHRASES_EN : END_PHRASES_KO;
  return list.some((p) => normalized === p || normalized.startsWith(p + " ") || normalized.endsWith(" " + p) || normalized.includes(p));
}

function generateSessionId() {
  return crypto.randomUUID();
}

export default function MentorPage() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const isEn = locale === "en";
  const t = MENTOR_UI[locale];
  const TOPICS = isEn ? TOPICS_EN : TOPICS_KO;

  const [topic, setTopic] = useState<TopicId | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rememberMentor, setRememberMentor] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [isElite, setIsElite] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [conversationEnded, setConversationEnded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMessage = useCallback(
    async (role: "user" | "assistant", content: string) => {
      if (!rememberMentor || !sessionId || !topic) return;
      try {
        await fetch("/api/me/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "mentor",
            sessionId,
            topic,
            role,
            content,
          }),
        });
      } catch {
        // ignore
      }
    },
    [rememberMentor, sessionId, topic]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const [prefsRes, eliteRes] = await Promise.all([
          fetch("/api/me/conversation-preferences"),
          fetch("/api/me/elite"),
        ]);
        const prefs = prefsRes.ok ? await prefsRes.json() : {};
        setRememberMentor(Boolean(prefs.rememberMentor));
        setPrefsLoaded(true);
        if (eliteRes.ok) {
          const elite = await eliteRes.json();
          setIsElite(Boolean(elite.isElite));
        }
      } catch {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!prefsLoaded || !rememberMentor) return;
    (async () => {
      try {
        const r = await fetch("/api/me/conversations?channel=mentor");
        if (!r.ok) return;
        const data = await r.json();
        if (!data.sessionId || !data.messages?.length) return;
        const t = (data.topic && TOPICS.some((x) => x.id === data.topic)) ? data.topic as TopicId : null;
        if (!t) return;
        setSessionId(data.sessionId);
        setTopic(t);
        setMessages(
          data.messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "chi" : "user",
            text: m.content,
          }))
        );
      } catch {
        // ignore
      }
    })();
  }, [prefsLoaded, rememberMentor]);

  const clearInputCompletely = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.blur();
      inputRef.current.value = "";
    }
    setInput("");
    setInputKey((k) => k + 1);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (inputRef.current) inputRef.current.blur();
    setTimeout(() => {
      setInput("");
      setInputKey((k) => k + 1);
      if (inputRef.current) inputRef.current.value = "";
    }, 0);

    setMessages((prev) => [...prev, { role: "user", text }]);

    if (isEndConversationMessage(text, isEn)) {
      setMessages((prev) => [...prev, { role: "chi", text: t.goodbyeReply }]);
      setConversationEnded(true);
      return;
    }

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
          lang: locale,
        }),
      });

      const fallbackReply = isEn ? "Could you say a bit more so we can talk about it?" : "무슨 말씀인지 다시 해주실래요?";
      const reply = typeof r.json?.message === "string" ? r.json.message : fallbackReply;
      setMessages((prev) => [
        ...prev,
        {
          role: "chi",
          text: reply,
          safetyValve: Boolean(r.json?.safety_valve),
        },
      ]);
      await saveMessage("user", text);
      await saveMessage("assistant", reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "chi",
          text: isEn ? "Connection was unstable. Please try again." : "연결이 잠깐 불안정했네요. 다시 말해주실래요?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const startTopic = (topicId: TopicId) => {
    clearInputCompletely();
    setTopic(topicId);
    setSessionId(generateSessionId());
    setConversationEnded(false);
    const opening = isEn ? DR_CHI_OPENINGS_EN[topicId] : DR_CHI_OPENINGS_KO[topicId];
    setMessages([{ role: "chi", text: opening }]);
  };

  const endConversation = () => {
    clearInputCompletely();
    setConversationEnded(true);
  };

  const goToTopicSelection = () => {
    clearInputCompletely();
    setConversationEnded(false);
    setTopic(null);
    setMessages([]);
    setSessionId(null);
  };

  const toggleRemember = async () => {
    const next = !rememberMentor;
    setRememberMentor(next);
    try {
      await fetch("/api/me/conversation-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberMentor: next }),
      });
    } catch {
      setRememberMentor(!next);
    }
  };

  const deleteHistory = async () => {
    if (!confirm(isEn ? "Delete all saved mentor conversation?" : "저장된 멘토 대화 기록을 모두 삭제할까요?")) return;
    setDeleting(true);
    try {
      await fetch("/api/me/conversations?channel=mentor", { method: "DELETE" });
      setTopic(null);
      setMessages([]);
      setSessionId(null);
    } finally {
      setDeleting(false);
    }
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
          <Nav locale={locale as "ko" | "en"} pathname={`/${locale}/bty/mentor`} />
          <header className="text-center mb-8">
            <h1
              className="text-2xl sm:text-3xl font-semibold text-mentor-ink"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Dr. Chi&apos;s Mentor
              {isElite && (
                <span className="ml-2 inline-flex items-center rounded-full bg-mentor-wood/20 px-2.5 py-0.5 text-xs font-medium text-mentor-wood border border-mentor-wood-soft/40">
                  {t.eliteBadge}
                </span>
              )}
            </h1>
            <p className="text-mentor-ink-soft mt-1 text-sm">
              {t.slogan}
            </p>
            {prefsLoaded && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-mentor-ink-soft cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMentor}
                    onChange={toggleRemember}
                    className="rounded border-mentor-wood-soft/50 text-mentor-wood focus:ring-mentor-wood-soft/30"
                  />
                  <span>{t.rememberLabel}</span>
                </label>
                <button
                  type="button"
                  onClick={deleteHistory}
                  disabled={deleting}
                  className="text-mentor-ink-soft hover:text-mentor-wood hover:underline disabled:opacity-50"
                >
                  {deleting ? t.deleting : t.deleteHistory}
                </button>
              </div>
            )}
          </header>

          {!topic ? (
            <div className="flex-1">
              <p className="text-center text-mentor-ink-soft text-sm mb-6">
                {t.topicPrompt}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TOPICS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => startTopic(x.id)}
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
                      {x.label}
                    </span>
                    <span className="text-xs text-mentor-ink-soft mt-0.5 block">
                      {x.subtitle}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link
                  href={`/${locale}/bty`}
                  className={cn(
                    "inline-flex items-center rounded-xl px-5 py-3 text-sm font-medium",
                    "bg-mentor-wood/10 text-mentor-wood border border-mentor-wood-soft/40",
                    "hover:bg-mentor-wood/20 transition-colors"
                  )}
                >
                  {t.goToMain}
                </Link>
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
                  {TOPICS.find((x) => x.id === topic)?.label} · {TOPICS.find((x) => x.id === topic)?.subtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearInputCompletely();
                      setConversationEnded(false);
                      setTopic(null);
                      setMessages([]);
                      setSessionId(null);
                    }}
                    className="text-xs text-mentor-wood hover:underline"
                  >
                    {t.selectOtherTopic}
                  </button>
                  {!conversationEnded && (
                    <button
                      type="button"
                      onClick={endConversation}
                      className="text-xs text-mentor-ink-soft hover:text-mentor-wood hover:underline"
                    >
                      {t.endConversation}
                    </button>
                  )}
                </div>
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
                          {t.dearMeLink}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-xl rounded-bl-sm px-5 py-4 bg-white/50 text-mentor-ink-soft text-sm border-l-4 border-mentor-wood-soft/30">
                      <span className="animate-pulse">{t.thinking}</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {conversationEnded ? (
                <div className="p-6 border-t border-mentor-wood-soft/20 bg-mentor-paper/50 text-center">
                  <p className="text-mentor-ink font-medium mb-4" style={{ fontFamily: "Georgia, serif" }}>
                    {t.conversationEnded}
                  </p>
                  <p className="text-sm text-mentor-ink-soft mb-5">
                    {t.conversationEndedSub}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={goToTopicSelection}
                      className={cn(
                        "rounded-xl px-5 py-3 text-sm font-medium",
                        "bg-mentor-wood/10 text-mentor-wood border border-mentor-wood-soft/40",
                        "hover:bg-mentor-wood/20 transition-colors"
                      )}
                    >
                      {t.goOtherTopic}
                    </button>
                    <Link
                      href={`/${locale}/bty`}
                      className={cn(
                        "rounded-xl px-5 py-3 text-sm font-medium inline-block",
                        "bg-mentor-wood text-white hover:bg-mentor-wood-soft",
                        "transition-colors"
                      )}
                    >
                      {t.goDojo}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-mentor-wood-soft/20 bg-white/30">
                  <div className="flex gap-2">
                    <input
                      key={`mentor-input-${inputKey}`}
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder={t.placeholder}
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
                      {t.send}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-mentor-ink-soft">
                    {t.seeYouNext}
                    <span className="mx-1.5">·</span>
                    <button
                      type="button"
                      onClick={goToTopicSelection}
                      className="text-mentor-wood hover:underline font-medium"
                    >
                      {t.endConversation}
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}

          <footer className="mt-6 pt-4 border-t border-mentor-wood-soft/20 text-center text-sm text-mentor-ink-soft space-x-3">
            <Link href={`/${locale}/bty`} className="text-mentor-wood hover:underline">
              {t.toDojo}
            </Link>
            <span>·</span>
            <Link href={`/${locale}/bty/integrity`} className="text-mentor-wood hover:underline">
              {t.toIntegrity}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
