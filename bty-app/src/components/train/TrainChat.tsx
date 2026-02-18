"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "user" | "coach";
type Msg = { id: string; role: Role; text: string; ts: number };

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function storageKey(day: number) {
  return `train_chat_day_${day}`;
}

// (MVP) 코치의 간단한 규칙 기반 응답 — 나중에 API로 교체하면 됨
function coachReply(userText: string, dayTitle?: string) {
  const t = userText.trim();
  if (!t) return "한 문장만이라도 좋아. 지금 떠오르는 걸 적어볼래?";
  if (t.includes("못") || t.includes("안") || t.includes("실패")) {
    return "좋아, 그 말이 나온 이유가 있어. 지금 그 생각이 '사실'인지 '감정'인지 구분해볼까?";
  }
  return `좋아. ${dayTitle ? `오늘 레슨(${dayTitle}) 맥락에서` : ""} 한 가지 더 물어볼게: 지금 이 순간 너에게 가장 필요한 말 한 문장은 뭐야?`;
}

export function TrainChat({
  day,
  dayTitle,
  suggestedPrompts,
}: {
  day: number;
  dayTitle?: string;
  suggestedPrompts: string[];
}) {
  const key = useMemo(() => storageKey(day), [day]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setMessages(JSON.parse(raw));
      else setMessages([]);
    } catch {
      setMessages([]);
    }
  }, [key]);

  // save
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch {}
  }, [key, messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Msg = { id: uid(), role: "user", text: trimmed, ts: Date.now() };
    const coachMsg: Msg = {
      id: uid(),
      role: "coach",
      text: coachReply(trimmed, dayTitle),
      ts: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMsg, coachMsg]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-32px)]">
      <div className="font-semibold mb-3">코치 대화</div>

      <div className="mb-3 space-y-2">
        <div className="text-xs opacity-70">추천 질문</div>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.slice(0, 3).map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-sm px-3 py-1.5 rounded-full border hover:opacity-80"
              type="button"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-xl p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-sm opacity-70">
            오늘의 훈련에 대해 느낀 점을 한 줄만 적어도 시작이야.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm whitespace-pre-wrap ${
                m.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <span
                className={`inline-block max-w-[90%] rounded-xl px-3 py-2 border ${
                  m.role === "user" ? "font-medium" : "opacity-90"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))
        )}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="오늘의 생각을 한 문장으로…"
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
        />
        <button className="px-4 py-2 rounded-xl border text-sm" type="submit">
          전송
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMessages([]);
          try {
            localStorage.removeItem(key);
          } catch {}
        }}
        className="mt-2 text-xs opacity-70 underline underline-offset-2 self-start"
      >
        오늘 대화 초기화
      </button>
    </div>
  );
}
