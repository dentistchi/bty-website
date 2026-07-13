"use client";

import { useEffect, useState } from "react";

type Locale = "en" | "ko";

type KeepCopy = {
  eyebrow: string;
  prompt: string;
  placeholder: string;
  save: string;
  saving: string;
  held: string;
  again: string;
  // Center ↔ Today loop V1 — the RETURN (night) framing. When Center opens and a
  // keep already exists for today, Center remembers the same anchor rather than
  // confirming a save. A mirror ("I remember what held you today"), not a coach.
  remember: string;
  rememberSub: string;
};

/**
 * Self-contained copy (mirrors the shell's local-dictionary pattern). Quiet,
 * non-evaluative, BTY-native. No numbers, no streaks, no completion language.
 */
const COPY: Record<Locale, KeepCopy> = {
  en: {
    eyebrow: "Relationship with Self",
    prompt: "Write one line you want to carry honestly today.",
    placeholder: "One honest line…",
    save: "Keep this for today",
    saving: "Keeping…",
    held: "Held for today.",
    again: "Write another line",
    remember: "Today you carried",
    rememberSub: "I remember what held you today.",
  },
  ko: {
    eyebrow: "나와의 관계",
    prompt: "오늘 정직하게 가지고 갈 한 줄을 남겨주세요.",
    placeholder: "정직한 한 줄…",
    save: "오늘 붙잡기",
    saving: "붙잡는 중…",
    held: "오늘의 한 줄을 붙잡았습니다.",
    again: "다른 한 줄 남기기",
    remember: "오늘 당신이 품고 온 한 줄",
    rememberSub: "오늘 당신을 붙잡아 준 것을, 기억합니다.",
  },
};

function resolveTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Center Daily Keep — a quiet room where the user writes and saves ONE self-owned
 * line for today. The server is the source of truth: GET on mount surfaces today's
 * keep (held state) if one exists; POST persists a new line. No localStorage, no
 * metrics, no reply, no LLM. Fail-soft everywhere — a read/save failure simply
 * leaves the writing surface usable, with no error drama.
 */
export default function CenterKeepRoom({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [mode, setMode] = useState<"loading" | "writing" | "held">("loading");
  const [input, setInput] = useState("");
  const [heldLine, setHeldLine] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Center ↔ Today loop V1: true when Center OPENED onto an already-held anchor (the
  // return / night path) — remembrance framing. False when the line was authored in
  // this very session (the save path) — the existing quiet confirmation. Presentation
  // only; the server keep is the single source of truth either way.
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    let alive = true;
    const tz = resolveTz();
    void fetch(`/api/bty/center/keep${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { line?: string | null; keptToday?: boolean } | null) => {
        if (!alive) return;
        if (data?.keptToday && typeof data.line === "string" && data.line.trim()) {
          setHeldLine(data.line);
          setInput(data.line);
          setReturned(true); // opened onto an existing anchor → the return / night path
          setMode("held");
        } else {
          setMode("writing");
        }
      })
      .catch(() => {
        if (alive) setMode("writing");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    const line = input.trim();
    if (!line || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bty/center/keep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ line, locale }),
      });
      if (res.ok) {
        setHeldLine(line);
        setReturned(false); // authored this session → quiet confirmation, not remembrance
        setMode("held");
      }
      // Fail-soft: on a non-ok response, stay in writing mode (button re-enables). No error surface.
    } catch {
      // swallow — quiet room, no visible error.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-center-keep=""
      className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center"
    >
      <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
        {t.eyebrow}
      </span>

      {mode === "loading" && (
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/25" aria-hidden>
          ·
        </p>
      )}

      {mode === "writing" && (
        <div className="flex w-full max-w-[20rem] flex-col items-center">
          <p className="mb-4 max-w-[18rem] text-[0.95rem] leading-6 text-white/60">{t.prompt}</p>
          <textarea
            data-center-keep-input=""
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            rows={2}
            maxLength={280}
            aria-label={t.prompt}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-[0.95rem] leading-6 text-white/90 placeholder:text-white/25 focus:border-[#C9A66B]/40 focus:outline-none"
          />
          <button
            type="button"
            data-center-keep-save=""
            onClick={save}
            disabled={!input.trim() || saving}
            className="mt-4 rounded-full border border-[#C9A66B]/40 px-6 py-2.5 text-sm font-medium text-[#C9A66B] transition-colors enabled:hover:bg-[#C9A66B]/10 disabled:opacity-40"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      )}

      {mode === "held" && (
        <div
          data-center-keep-held=""
          data-center-remember={returned ? "" : undefined}
          className="flex w-full max-w-[20rem] flex-col items-center"
        >
          {/* Return / night path: Center remembers the SAME anchor Today carried. A quiet
              "Today you carried" lead + the anchor shown plainly (mirroring Today's Held in
              Center) + a remembrance closer. Not a save confirmation, not an evaluation. */}
          {returned ? (
            <>
              <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                {t.remember}
              </span>
              {heldLine ? (
                <p className="max-w-[18rem] text-[1.05rem] leading-7 text-white/85">{heldLine}</p>
              ) : null}
              <p className="mt-4 text-[0.85rem] leading-6 text-white/45">{t.rememberSub}</p>
            </>
          ) : (
            <>
              {heldLine ? (
                <p className="mb-4 max-w-[18rem] text-[1.05rem] leading-7 text-white/85">
                  “{heldLine}”
                </p>
              ) : null}
              <p className="text-[0.85rem] leading-6 text-white/45">{t.held}</p>
            </>
          )}
          <button
            type="button"
            onClick={() => setMode("writing")}
            className="mt-5 text-xs font-medium tracking-wide text-white/35 underline-offset-4 hover:text-white/60 hover:underline"
          >
            {t.again}
          </button>
        </div>
      )}
    </div>
  );
}
