"use client";

/**
 * Foundry — Dr. Chi chat: session GET runs {@link buildMentorContext} + {@link injectExamplesIntoContext} (server);
 * POST `/api/chat` with `mode: foundry` applies the same RAG pipeline + optional `flag_type` on each response.
 */

import React from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { HealingPhase } from "@/engine/healing/healing-phase.service";
import type { ChatResponseBody } from "@/lib/bty/chat";

type MentorSessionApi = {
  ok: boolean;
  phase: HealingPhase | null;
  contextReady: boolean;
  lastFlagType: string | null;
  unviewedRecommendationCount: number;
  hasRecommendations: boolean;
  error?: string;
};

type ChatRow = {
  role: "user" | "assistant";
  content: string;
  /** Arena flag_type tag for Dr. Chi turns (from API `flag_type`). */
  flagType?: string | null;
};

function phaseLabel(phase: HealingPhase | null, loc: "ko" | "en"): string {
  if (!phase) return loc === "ko" ? "미설정" : "—";
  const map: Record<HealingPhase, [string, string]> = {
    ACKNOWLEDGEMENT: ["인지", "Acknowledgement"],
    REFLECTION: ["성찰", "Reflection"],
    REINTEGRATION: ["재통합", "Reintegration"],
    RENEWAL: ["갱신", "Renewal"],
  };
  return loc === "ko" ? map[phase][0] : map[phase][1];
}

export type MentorChatShellProps = {
  locale: Locale | string;
  /** Route locale segment e.g. `ko` */
  routeLocale: string;
};

export function MentorChatShell({ locale, routeLocale }: MentorChatShellProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const [session, setSession] = React.useState<MentorSessionApi | null>(null);
  const [sessionErr, setSessionErr] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ChatRow[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [chatErr, setChatErr] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setSessionErr(null);
    fetch(`/api/bty/foundry/mentor-session?lang=${encodeURIComponent(loc)}`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as MentorSessionApi;
        if (!cancelled) {
          if (!r.ok || !j.ok) setSessionErr(j.error ?? b.mentorChatShellError);
          else setSession(j);
        }
      })
      .catch(() => {
        if (!cancelled) setSessionErr(b.mentorChatShellError);
      });
    return () => {
      cancelled = true;
    };
  }, [loc, b.mentorChatShellError]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length, sending]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setChatErr(null);
    setSending(true);
    setInput("");
    const nextUser: ChatRow = { role: "user", content: text };
    setRows((prev) => [...prev, nextUser]);

    const payloadMessages = [...rows, nextUser].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "foundry",
          lang: loc,
          messages: payloadMessages,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ChatResponseBody & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "CHAT_FAILED");
      }
      const msg = typeof data.message === "string" ? data.message : "";
      const flagType =
        data.flag_type != null && String(data.flag_type).trim() ? String(data.flag_type).trim() : null;
      setRows((prev) => [
        ...prev,
        { role: "assistant", content: msg || "…", flagType },
      ]);
    } catch {
      setChatErr(b.mentorChatShellError);
      setRows((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }, [input, sending, rows, loc, b.mentorChatShellError]);

  const foundryHref = `/${routeLocale}/bty/foundry`;

  if (!session && !sessionErr) {
    return (
      <section role="status" aria-busy="true" aria-label={b.mentorChatShellLoading}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{b.mentorChatShellLoading}</p>
      </section>
    );
  }

  if (sessionErr || !session) {
    return (
      <section role="alert" aria-label={b.mentorChatShellRegionAria}>
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{sessionErr ?? b.mentorChatShellError}</p>
      </section>
    );
  }

  return (
    <section
      role="region"
      aria-label={b.mentorChatShellRegionAria}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "min(72vh, 640px)",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: "var(--arena-card, #fff)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>{b.mentorChatShellTitle}</h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(13, 148, 136, 0.12)",
              color: "#0f766e",
            }}
          >
            {b.mentorChatShellPhaseBadge}: {phaseLabel(session.phase, loc)}
          </span>
        </div>
        {session.hasRecommendations ? (
          <Link
            href={foundryHref}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "8px 12px",
              borderRadius: 10,
              background: "#0d9488",
              color: "#fff",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {b.mentorChatShellRecsCta}
          </Link>
        ) : null}
      </header>

      <div
        role="log"
        aria-live="polite"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {loc === "ko"
              ? "Dr. Chi와 대화를 시작해 보세요. 세션 맥락은 서버에서 준비됩니다."
              : "Start a conversation with Dr. Chi. Session context is prepared on the server."}
          </p>
        ) : null}
        {rows.map((m, i) => (
          <div
            key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "min(100%, 420px)",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                fontSize: 14,
                lineHeight: 1.5,
                background: m.role === "user" ? "#0d9488" : "#f1f5f9",
                color: m.role === "user" ? "#fff" : "#0f172a",
                borderBottomRightRadius: m.role === "user" ? 4 : 14,
                borderBottomLeftRadius: m.role === "assistant" ? 4 : 14,
              }}
            >
              {m.content}
            </div>
            {m.role === "assistant" && m.flagType ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                {b.mentorChatShellFlagLabel}: <span style={{ fontFamily: "ui-monospace, monospace" }}>{m.flagType}</span>
              </p>
            ) : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {chatErr ? (
        <p role="alert" style={{ margin: 0, padding: "0 16px", fontSize: 12, color: "#b91c1c" }}>
          {chatErr}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid #e2e8f0",
          background: "#fafafa",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={b.mentorChatShellPlaceholder}
          disabled={sending}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            fontSize: 14,
          }}
          aria-label={b.mentorChatShellPlaceholder}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !input.trim()}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            background: sending || !input.trim() ? "#94a3b8" : "#0d9488",
            color: "#fff",
            border: "none",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
          }}
        >
          {b.mentorChatShellSend}
        </button>
      </div>
    </section>
  );
}
