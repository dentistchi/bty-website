"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTrain } from "@/contexts/TrainContext";
import { getMessages } from "@/lib/i18n";

import TRAIN_EN from "@/content/train-28days.en.json";

type ChatMsg = { role: "user" | "assistant"; content: string };

function CoachChat({ day, locale }: { day: number; locale: string }) {
  const isKo = locale === "ko";
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const systemContext = `Day ${day} of a 28-day self-esteem training program. Help the user apply today's lesson in the smallest, most practical way.`;
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemContext },
            ...next.map((m) => ({ role: m.role, content: m.content })),
          ],
          mode: "center",
          lang: isKo ? "ko" : "en",
        }),
      });
      const data: { message?: string; error?: string } = await r.json().catch(() => ({}));
      const reply = data.message ?? (isKo ? "잠시 후 다시 시도해 주세요." : "Try again in a moment.");
      setMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: isKo ? "연결에 실패했어요." : "Connection failed." }]);
    } finally {
      setSending(false);
    }
  }, [input, msgs, sending, day, isKo]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {isKo ? "코치 대화" : "Coach chat"}
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>
        {isKo ? `Day ${day} 레슨을 오늘 실천하려면 어떻게 할까요?` : `How can you apply Day ${day}'s lesson today?`}
      </div>
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10, minHeight: 120, maxHeight: 320 }}
        role="log"
        aria-label={isKo ? "코치 대화 내역" : "Coach conversation"}
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <div style={{ opacity: 0.5, fontSize: 13 }}>
            {isKo
              ? `"Day ${day}: 오늘 가장 작은 10분 실천을 도와줘."`
              : `"Day ${day}: Help me do the smallest 10-minute version of today's practice."`}
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: 12,
              background: m.role === "user" ? "#1e40af" : "#f3f4f6",
              color: m.role === "user" ? "white" : "#111",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: "flex-start", opacity: 0.5, fontSize: 13 }}>
            {isKo ? "답변 생성 중…" : "Thinking…"}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={isKo ? "메시지 입력…" : "Type a message…"}
          rows={2}
          style={{ flex: 1, borderRadius: 8, border: "1px solid #ddd", padding: "6px 10px", fontSize: 13, resize: "none" }}
          aria-label={isKo ? "코치에게 메시지 입력" : "Message to coach"}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!input.trim() || sending}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontSize: 13, opacity: !input.trim() || sending ? 0.5 : 1 }}
          aria-label={isKo ? "전송" : "Send"}
        >
          {isKo ? "전송" : "Send"}
        </button>
      </div>
    </div>
  );
}

function clampDay(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

export default function TrainDayPage() {
  const params = useParams<{ locale?: string; day: string }>();
  const locale = (params?.locale === "ko" ? "ko" : "en") as "ko" | "en";
  const t = getMessages(locale).train;
  const day = clampDay(Number(params.day));

  const {
    progress,
    markTodayComplete,
    showCompletionSummary,
    setShowCompletionSummary,
    completionSummary,
    generateCompletionSummary,
  } = useTrain();

  const lesson = (TRAIN_EN as Record<string, { raw?: string; title?: string; sections?: Record<string, string>; date?: string }>)?.[String(day)];
  const lessonText =
    lesson?.raw ||
    [lesson?.title, ...Object.entries(lesson?.sections ?? {}).map(([k, v]) => `${k}\n${v}`)].join("\n\n");

  const isUnlocked = day <= (progress?.todayUnlockedDay ?? 1);
  const isCompleted = (progress?.completedDays ?? []).includes(day);

  const onClickComplete = React.useCallback(() => {
    generateCompletionSummary({ day, lessonText: lessonText ?? "" });
    markTodayComplete(day);
  }, [day, lessonText, generateCompletionSummary, markTodayComplete]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr 420px", height: "100vh" }}>
      {/* LEFT: Sidebar */}
      <aside style={{ borderRight: "1px solid #eee", padding: 16, overflow: "auto" }} role="navigation" aria-label={t.dayListLabel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{t.title}</div>
          <a
            href={`/${locale}/center`}
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none", opacity: 0.8 }}
            aria-label={locale === "ko" ? "Center로 돌아가기" : "Back to Center"}
          >
            ← {locale === "ko" ? "Center" : "Center"}
          </a>
        </div>
        <div style={{ opacity: 0.7, marginBottom: 16 }}>
          Unlocked today: Day {progress?.todayUnlockedDay ?? 1}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => {
            const unlocked = d <= (progress?.todayUnlockedDay ?? 1);
            const completed = (progress?.completedDays ?? []).includes(d);
            return (
              <a
                key={d}
                href={unlocked ? `/train/day/${d}` : undefined}
                onClick={(e) => {
                  if (!unlocked) e.preventDefault();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                  opacity: unlocked ? 1 : 0.45,
                  pointerEvents: unlocked ? "auto" : "auto",
                  textDecoration: "none",
                  color: "inherit",
                  background: d === day ? "#f5f5f5" : "white",
                }}
              >
                <span>Day {d}</span>
                <span>{completed ? "✅" : unlocked ? "" : "🔒"}</span>
              </a>
            );
          })}
        </div>
      </aside>

      {/* CENTER: Lesson */}
      <main style={{ padding: 24, overflow: "auto" }} aria-label={t.lessonLabel}>
        <div style={{ opacity: 0.6, marginBottom: 6 }}>{lesson?.date ?? ""}</div>
        <h1 style={{ margin: 0, marginBottom: 8 }}>Day {day}</h1>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{lesson?.title ?? ""}</div>

        {!isUnlocked && (
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12, marginBottom: 18 }} role="status" aria-label={t.lockedLabel}>
            Locked until tomorrow 5am (and previous day completion).
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }} role="group" aria-label={t.completeGroupLabel}>
          <button
            type="button"
            onClick={onClickComplete}
            disabled={!isUnlocked || isCompleted}
            aria-label={isCompleted ? (locale === "ko" ? "완료됨" : "Completed") : (locale === "ko" ? "오늘 완료로 표시" : "Mark today as complete")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              opacity: !isUnlocked || isCompleted ? 0.5 : 1,
              cursor: !isUnlocked || isCompleted ? "not-allowed" : "pointer",
            }}
          >
            {isCompleted ? (locale === "ko" ? "완료됨" : "Completed") : (locale === "ko" ? "오늘 완료로 표시" : "Mark today as complete")}
          </button>

          <button
            type="button"
            onClick={() => setShowCompletionSummary(false)}
            aria-label={t.coachChatLabel}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {locale === "ko" ? "코치 대화" : "Coach chat"}
          </button>
          <button
            type="button"
            onClick={() => setShowCompletionSummary(true)}
            aria-label={t.completionSummaryLabel}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {locale === "ko" ? "완료 요약" : "Completion summary"}
          </button>
        </div>

        <article style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {lessonText || "Lesson content missing."}
        </article>
      </main>

      {/* RIGHT: Chat / Completion Summary */}
      <aside role="region" aria-label={t.sidebarPanelLabel} style={{ borderLeft: "1px solid #eee", padding: 16, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowCompletionSummary(false)}
            aria-label={t.coachChatLabel}
            aria-pressed={!showCompletionSummary}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "white" : "black",
              color: showCompletionSummary ? "black" : "white",
            }}
          >
            {locale === "ko" ? "코치 대화" : "Coach chat"}
          </button>
          <button
            type="button"
            onClick={() => setShowCompletionSummary(true)}
            aria-label={t.completionSummaryLabel}
            aria-pressed={showCompletionSummary}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "black" : "white",
              color: showCompletionSummary ? "white" : "black",
            }}
          >
            {locale === "ko" ? "완료 요약" : "Completion summary"}
          </button>
        </div>

        {!showCompletionSummary ? (
          <div role="region" aria-label={t.coachChatLabel} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CoachChat day={day} locale={locale} />
          </div>
        ) : (
          <div role="region" aria-label={t.completionSummaryLabel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Completion summary</div>
            {!completionSummary ? (
              <div style={{ opacity: 0.7 }} role="status" aria-label={locale === "ko" ? "완료 요약 없음" : "No completion summary yet"}>
                No summary yet. Click &quot;Mark today as complete&quot; (or we can generate on demand).
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{completionSummary.title}</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {completionSummary.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }} role="group" aria-label={t.reinforcementLabel}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Reinforcement questions (3)</div>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {completionSummary.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
