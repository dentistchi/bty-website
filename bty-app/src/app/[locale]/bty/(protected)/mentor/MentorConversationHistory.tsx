"use client";

import { useEffect, useState } from "react";
import { CardSkeleton, EmptyState } from "@/components/bty-arena";

type SessionItem = {
  id: string;
  topic?: string;
  createdAt: string;
};

type ApiResponse =
  | { sessions: SessionItem[] }
  | { error?: string };

const LABELS = {
  ko: {
    title: "대화 이력",
    loading: "불러오는 중…",
    empty: "저장된 대화가 없어요.",
    emptyHint: "대화 기억하기를 켜고 멘토와 대화하면 여기에 쌓여요.",
    error: "이력을 불러오지 못했어요.",
  },
  en: {
    title: "Conversation history",
    loading: "Loading…",
    empty: "No saved conversations.",
    emptyHint: "Turn on “Remember conversation” and chat with the mentor to see them here.",
    error: "Failed to load history.",
  },
} as const;

export default function MentorConversationHistory({
  locale,
  topicLabels,
}: {
  locale: "ko" | "en";
  topicLabels: Record<string, string>;
}) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = LABELS[locale];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/me/conversations?channel=mentor&list=sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        if ("error" in data && data.error) {
          setError(data.error);
          setSessions([]);
        } else if ("sessions" in data && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        } else {
          setSessions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (loading) {
    return (
      <section aria-label={t.title} className="mt-8 pt-6 border-t border-mentor-wood-soft/20">
        <h2 className="text-sm font-medium text-mentor-ink-soft mb-3">{t.title}</h2>
        <CardSkeleton showLabel={false} lines={3} style={{ padding: "16px 20px" }} />
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label={t.title} className="mt-8 pt-6 border-t border-mentor-wood-soft/20">
        <h2 className="text-sm font-medium text-mentor-ink-soft mb-3">{t.title}</h2>
        <p role="alert" className="text-sm text-red-600">
          {t.error}
        </p>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section aria-label={t.title} className="mt-8 pt-6 border-t border-mentor-wood-soft/20">
        <h2 className="text-sm font-medium text-mentor-ink-soft mb-3">{t.title}</h2>
        <EmptyState
          icon="💬"
          message={t.empty}
          hint={t.emptyHint}
          style={{ padding: "20px 16px" }}
        />
      </section>
    );
  }

  return (
    <section aria-label={t.title} className="mt-8 pt-6 border-t border-mentor-wood-soft/20">
      <h2 className="text-sm font-medium text-mentor-ink-soft mb-3">{t.title}</h2>
      <ul className="space-y-2 list-none p-0 m-0">
        {sessions.map((s) => {
          const dateStr =
            s.createdAt &&
            new Date(s.createdAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
          const topicLabel = s.topic ? topicLabels[s.topic] ?? s.topic : null;
          return (
            <li
              key={s.id}
              className="rounded-xl border border-mentor-wood-soft/20 bg-mentor-paper/60 px-4 py-3 text-sm text-mentor-ink"
            >
              <span className="text-mentor-ink-soft">{dateStr}</span>
              {topicLabel && (
                <>
                  <span className="mx-2 text-mentor-wood-soft/80">·</span>
                  <span>{topicLabel}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
