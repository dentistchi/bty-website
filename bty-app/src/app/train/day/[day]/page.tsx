"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTrain } from "@/contexts/TrainContext";

import TRAIN_EN from "@/content/train-28days.en.json";

function clampDay(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

export default function TrainDayPage() {
  const params = useParams<{ day: string }>();
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
      <aside style={{ borderRight: "1px solid #eee", padding: 16, overflow: "auto" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>28-Day Training</div>
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
      <main style={{ padding: 24, overflow: "auto" }}>
        <div style={{ opacity: 0.6, marginBottom: 6 }}>{lesson?.date ?? ""}</div>
        <h1 style={{ margin: 0, marginBottom: 8 }}>Day {day}</h1>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{lesson?.title ?? ""}</div>

        {!isUnlocked && (
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12, marginBottom: 18 }}>
            Locked until tomorrow 5am (and previous day completion).
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={onClickComplete}
            disabled={!isUnlocked || isCompleted}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              opacity: !isUnlocked || isCompleted ? 0.5 : 1,
              cursor: !isUnlocked || isCompleted ? "not-allowed" : "pointer",
            }}
          >
            {isCompleted ? "Completed" : "Mark today as complete"}
          </button>

          <button
            onClick={() => setShowCompletionSummary(false)}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            Coach chat
          </button>
          <button
            onClick={() => setShowCompletionSummary(true)}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            Completion summary
          </button>
        </div>

        <article style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {lessonText || "Lesson content missing."}
        </article>
      </main>

      {/* RIGHT: Chat / Completion Summary */}
      <aside style={{ borderLeft: "1px solid #eee", padding: 16, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setShowCompletionSummary(false)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "white" : "black",
              color: showCompletionSummary ? "black" : "white",
            }}
          >
            Coach chat
          </button>
          <button
            onClick={() => setShowCompletionSummary(true)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "black" : "white",
              color: showCompletionSummary ? "white" : "black",
            }}
          >
            Completion summary
          </button>
        </div>

        {!showCompletionSummary ? (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Coach chat</div>
            <div style={{ opacity: 0.7, marginBottom: 12 }}>
              (placeholder) Later: inject lesson context + store conversation.
            </div>
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              Prompt idea: "Today is Day {day}. Help me do the smallest 10-minute version of the practice."
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Completion summary</div>
            {!completionSummary ? (
              <div style={{ opacity: 0.7 }}>
                No summary yet. Click "Mark today as complete" (or we can generate on demand).
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

                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
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
