"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Safe Mirror (안전한 거울)
 * - 사용자 부정적 감정 입력 → AI는 조언 없이 Reframing(재해석)만 제공.
 * - 평가·비교·"Better" 금지. Validation & Reframing only.
 */

const REFRAMING_EXAMPLES: Record<string, string> = {
  fallback:
    "그런 마음이 드는 건 당연해요. 그건 당신이 부족해서가 아니라, 잘하고 싶은 마음이 크기 때문이에요.",
  boss: "상사에게 혼났을 때 속상한 건 당연해요. 그건 당신이 무능해서가 아니라, 잘하고 싶은 마음이 커서 그런 거예요.",
  work: "일이 잘 안 풀릴 때 답답한 건 당연해요. 그건 당신이 부족해서가 아니라, 일을 중요하게 생각하기 때문이에요.",
  relationship: "관계에서 마음이 아픈 건 당연해요. 그건 당신이 문제가 있어서가 아니라, 그 관계를 소중히 여기기 때문이에요.",
  self: "자신이 별로라고 느껴질 때가 있어도 괜찮아요. 그런 생각이 드는 건 당신이 나쁜 사람이라서가 아니라, 스스로를 더 잘 하고 싶어하기 때문이에요.",
};

function getReframing(input: string): string {
  const lower = input.toLowerCase().trim();
  if (lower.includes("상사") || lower.includes("혼나") || lower.includes("무능"))
    return REFRAMING_EXAMPLES.boss;
  if (lower.includes("일") || lower.includes("업무") || lower.includes("회사"))
    return REFRAMING_EXAMPLES.work;
  if (lower.includes("관계") || lower.includes("친구") || lower.includes("가족"))
    return REFRAMING_EXAMPLES.relationship;
  if (lower.includes("나 ") || lower.includes("내가") || lower.includes("자신"))
    return REFRAMING_EXAMPLES.self;
  return REFRAMING_EXAMPLES.fallback;
}

function SafeMirrorLayout({
  input,
  setInput,
  isLoading,
  onSubmit,
  reframing,
}: {
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  reframing: string | null;
}) {
  return (
    <div
      role="region"
      aria-labelledby="safe-mirror-heading"
      className={cn(
        "rounded-2xl p-6 sm:p-8",
        "bg-sanctuary-blush/60 border border-sanctuary-peach/50",
        "shadow-sm"
      )}
    >
      <h2
        id="safe-mirror-heading"
        className="text-xl font-medium text-sanctuary-text mb-1"
      >
        안전한 거울
      </h2>
      <p className="text-sm text-sanctuary-text-soft mb-6">
        지금 느끼는 말을 편하게 적어보세요. 여기선 조언이 아니라, 그 마음을 그대로 비춰드릴게요.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 오늘 상사에게 혼나서 내가 무능하게 느껴져"
          rows={4}
          className={cn(
            "w-full rounded-xl px-4 py-3 resize-none",
            "bg-white/80 border border-sanctuary-peach/60",
            "placeholder:text-sanctuary-text-soft/70",
            "focus:outline-none focus:ring-2 focus:ring-sanctuary-sage/50 focus:border-sanctuary-sage",
            "text-sanctuary-text"
          )}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={cn(
            "w-full sm:w-auto px-6 py-3 rounded-xl font-medium",
            "bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
        >
          {isLoading ? "비춰보는 중…" : "비춰보기"}
        </button>
      </form>

      {reframing && (
        <div
          className={cn(
            "mt-6 p-5 rounded-xl",
            "bg-white/70 border border-sanctuary-lavender/50",
            "animate-soft-pulse"
          )}
        >
          <p className="text-sanctuary-text leading-relaxed">{reframing}</p>
        </div>
      )}
    </div>
  );
}

export function SafeMirror({
  onPositive,
}: {
  /** Called when user gets reframing; receives the reflection text for saving */
  onPositive?: (reflectionText: string) => void;
} = {}) {
  const [input, setInput] = useState("");
  const [reframing, setReframing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setReframing(null);
    setTimeout(() => {
      setReframing(getReframing(trimmed));
      setIsLoading(false);
      onPositive?.(trimmed);
    }, 800);
  };

  return (
    <SafeMirrorLayout
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      reframing={reframing}
    />
  );
}
