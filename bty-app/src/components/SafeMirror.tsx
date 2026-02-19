"use client";

import { useState, useRef, useEffect } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { setSafeMirrorPositive } from "@/lib/utils";
import { fetchJson } from "@/lib/read-json";
import type { Messages } from "@/lib/i18n";

const BRIDGE_CHECK_EVENT = "dear-bridge-check";

type Entry = { role: "user" | "assistant"; content: string };

/**
 * The Safe Mirror (안전한 거울) — AI 상담
 * 일기장/편지지에 쓰는 듯한 UI. 사용자 글이 위, AI 답장이 그 밑에 이어지는 형태.
 */

function SafeMirrorLayout({
  entries,
  input,
  setInput,
  isLoading,
  onSubmit,
  t,
  theme = "sanctuary",
}: {
  entries: Entry[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  t: Messages["safeMirror"];
  theme?: "dear" | "sanctuary";
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDear = theme === "dear";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, isLoading]);

  return (
    <div
      role="region"
      aria-labelledby="safe-mirror-heading"
      className={cn(
        !isDear && "rounded-2xl p-6 sm:p-8 bg-sanctuary-blush/60 border border-sanctuary-peach/50 shadow-sm"
      )}
    >
      <h2
        id="safe-mirror-heading"
        className={cn(
          "text-xl font-medium mb-1",
          isDear ? "font-serif text-dear-charcoal" : "text-sanctuary-text"
        )}
      >
        {t.title}
      </h2>
      <p className={cn("text-sm mb-6", isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft")}>
        {t.subtitle}
      </p>

      {/* 편지/일기 본문: 사용자 글 → AI 답장이 순서대로 */}
      <div className="space-y-8 mb-8">
        {entries.length === 0 && !isLoading && (
          <p
            className={cn(
              "text-sm italic",
              isDear ? "text-dear-charcoal-soft/80" : "text-sanctuary-text-soft/80"
            )}
          >
            {t.placeholder}
          </p>
        )}
        {entries.map((entry, i) => (
          <div key={i} className="space-y-1">
            {entry.role === "user" ? (
              <div
                className={cn(
                  "pl-0 border-l-0",
                  isDear
                    ? "text-dear-charcoal"
                    : "text-sanctuary-text"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{entry.content}</p>
              </div>
            ) : (
              <div
                className={cn(
                  "pl-4 border-l-2 rounded-r-sm",
                  isDear
                    ? "border-dear-sage/50 text-dear-charcoal bg-dear-bg/60 py-2 pr-2"
                    : "border-sanctuary-sage/50 text-sanctuary-text bg-white/50 py-2 pr-2"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  {entry.content}
                </p>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div
            className={cn(
              "pl-4 border-l-2 rounded-r-sm py-2",
              isDear
                ? "border-dear-sage/30 text-dear-charcoal-soft"
                : "border-sanctuary-sage/30 text-sanctuary-text-soft"
            )}
          >
            <p className="text-sm animate-soft-pulse">{t.submitting}</p>
          </div>
        )}
      </div>
      <div ref={bottomRef} />

      {/* 입력: 편지지에 쓰는 듯한 텍스트 영역 */}
      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          rows={4}
          className={cn(
            "w-full rounded-xl px-4 py-3 resize-none",
            isDear
              ? "bg-dear-bg border border-dear-charcoal/12 placeholder:text-dear-charcoal-soft/80 text-dear-charcoal focus:ring-dear-sage/50 focus:border-dear-sage"
              : "bg-white/80 border border-sanctuary-peach/60 placeholder:text-sanctuary-text-soft/70 text-sanctuary-text focus:ring-sanctuary-sage/50 focus:border-sanctuary-sage",
            "focus:outline-none focus:ring-2 transition-colors"
          )}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={cn(
            "w-full sm:w-auto px-6 py-3 rounded-xl font-medium transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isDear
              ? "bg-dear-sage text-white hover:bg-dear-sage-soft"
              : "bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage"
          )}
        >
          {isLoading ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}

export function SafeMirror({
  locale = "ko",
  theme = "sanctuary",
  onPositive,
}: {
  locale?: "ko" | "en";
  theme?: "dear" | "sanctuary";
  onPositive?: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const t = getMessages(locale).safeMirror;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setEntries((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsLoading(true);

    try {
      const history = [...entries, { role: "user" as const, content: trimmed }];
      const r = await fetchJson<{ message?: string; error?: string }>("/api/safe-mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!r.ok) throw new Error(r.json?.error ?? r.raw ?? "Request failed");
      const reply = typeof r.json?.message === "string" ? r.json.message : "";
      if (reply) {
        setEntries((prev) => [...prev, { role: "assistant", content: reply }]);
        setSafeMirrorPositive();
        onPositive?.();
        if (typeof window !== "undefined") window.dispatchEvent(new Event(BRIDGE_CHECK_EVENT));
      }
    } catch {
      const fallback =
        locale === "ko"
          ? "지금은 답장을 적기 어려워요. 그 마음이 들었다는 것만으로도 충분해요."
          : "I can't write back right now. It's enough that you wrote it down.";
      setEntries((prev) => [...prev, { role: "assistant", content: fallback }]);
      setSafeMirrorPositive();
      onPositive?.();
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BRIDGE_CHECK_EVENT));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeMirrorLayout
      entries={entries}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      t={t}
      theme={theme}
    />
  );
}
