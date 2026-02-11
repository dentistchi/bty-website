"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Small Wins Stack (작은 승리)
 * - 거창한 목표가 아닌 아주 작은 성공 기록.
 * - 버튼 클릭 시 따뜻한 시각적 피드백 (꽃 피어남).
 */

const SUGGESTED_WINS = [
  "오늘 이불 개기",
  "물 한 잔 마시기",
  "창문 열어 환기하기",
  "손 씻기",
  "스트레칭 1분",
  "한 입 먹기",
  "일어나서 세수하기",
  "양치하기",
];

interface WinRecord {
  id: string;
  label: string;
  at: number;
}

function FlowerBloom({ onComplete }: { onComplete: () => void }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      <div
        className="w-16 h-16 rounded-full bg-sanctuary-flower/90 animate-bloom"
        style={{
          boxShadow: "0 0 24px rgba(232, 180, 184, 0.6)",
        }}
        onAnimationEnd={onComplete}
      />
      <div className="absolute w-20 h-20 rounded-full bg-sanctuary-peach/40 animate-bloom [animation-delay:0.1s]" />
    </div>
  );
}

export function SmallWinsStack() {
  const [wins, setWins] = useState<WinRecord[]>([]);
  const [bloomId, setBloomId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");

  const addWin = useCallback((label: string) => {
    const id = `win-${Date.now()}`;
    setWins((prev) => [{ id, label, at: Date.now() }, ...prev]);
    setBloomId(id);
  }, []);

  const handleSuggested = (label: string) => {
    addWin(label);
  };

  const handleCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    addWin(trimmed);
    setCustomText("");
  };

  return (
    <section
      className={cn(
        "relative rounded-2xl p-6 sm:p-8 overflow-hidden",
        "bg-sanctuary-mint/50 border border-sanctuary-sage/50",
        "shadow-sm"
      )}
      aria-labelledby="small-wins-heading"
    >
      <h2
        id="small-wins-heading"
        className="text-xl font-medium text-sanctuary-text mb-1"
      >
        작은 승리
      </h2>
      <p className="text-sm text-sanctuary-text-soft mb-6">
        거창한 게 아니라, 오늘 한 아주 작은 일을 눌러 기록해보세요.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {SUGGESTED_WINS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => handleSuggested(label)}
            className={cn(
              "relative rounded-xl py-3 px-3 text-sm font-medium",
              "bg-white/80 border border-sanctuary-sage/40",
              "text-sanctuary-text hover:bg-sanctuary-sage/30 hover:border-sanctuary-sage/60",
              "transition-colors overflow-hidden"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleCustom} className="flex gap-2 mb-6">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="직접 입력 (예: 물 한 잔 마시기)"
          className={cn(
            "flex-1 rounded-xl px-4 py-3",
            "bg-white/80 border border-sanctuary-sage/40",
            "placeholder:text-sanctuary-text-soft/70",
            "focus:outline-none focus:ring-2 focus:ring-sanctuary-sage/50",
            "text-sanctuary-text"
          )}
        />
        <button
          type="submit"
          disabled={!customText.trim()}
          className={cn(
            "px-4 py-3 rounded-xl font-medium",
            "bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
        >
          추가
        </button>
      </form>

      {bloomId && (
        <FlowerBloom onComplete={() => setBloomId(null)} />
      )}

      {wins.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-sanctuary-text-soft">
            오늘의 작은 승리 {wins.length}개
          </p>
          <ul className="space-y-1">
            {wins.slice(0, 10).map((w) => (
              <li
                key={w.id}
                className={cn(
                  "flex items-center gap-2 py-2 px-3 rounded-lg",
                  "bg-white/60 border border-sanctuary-sage/30"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full bg-sanctuary-flower flex-shrink-0"
                  aria-hidden
                />
                <span className="text-sanctuary-text">{w.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
