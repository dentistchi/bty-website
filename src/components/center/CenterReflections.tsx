"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Center — My Reflections (Slice 3.1B-3I). The CANONICAL home of the learner's Private
 * Reflections. Reuses the EXISTING owner-scoped read GET /api/bty/foundry/history →
 * listUserFoundryHistory (linked_user_id = authenticated caller). `responseText` is the
 * learner's OWN private reflection and is NEVER Host-visible (Host projections exclude it,
 * server-side). Read-only V1: no edit/delete/AI/Host feedback/analytics. Explicit DTO
 * allow-list — never spread the raw history row.
 */

type Locale = "en" | "ko";

type ReflectionEntry = {
  entryId: string;
  eventTitle: string;
  contentType: "youtube" | "document";
  completedAt: string;
  responseText: string;
};

const COPY: Record<Locale, {
  title: string;
  privacy: string;
  completedOn: string;
  video: string;
  document: string;
  empty: string;
  emptyHint: string;
  loading: string;
}> = {
  en: {
    title: "My reflections",
    privacy: "Only you can see these reflections.",
    completedOn: "Completed",
    video: "Video",
    document: "PDF",
    empty: "No reflections yet.",
    emptyHint: "When you finish a training and write a private reflection, it appears here.",
    loading: "Loading…",
  },
  ko: {
    title: "나의 성찰",
    privacy: "이 성찰은 본인만 볼 수 있습니다.",
    completedOn: "완료",
    video: "영상",
    document: "PDF",
    empty: "아직 성찰이 없습니다.",
    emptyHint: "교육을 마치고 비공개 성찰을 남기면 여기에서 볼 수 있습니다.",
    loading: "불러오는 중…",
  },
};

function formatDate(iso: string, loc: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function CenterReflections({
  locale,
  focusEntryId = null,
}: {
  locale: string;
  /** Owner-scoped deep-link target (?entry=<progressId>) — the timeline focuses this record. */
  focusEntryId?: string | null;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [items, setItems] = useState<ReflectionEntry[] | null>(null);
  const focusRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/history", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = (await res.json()) as {
        history?: Array<{ entryId?: string; eventTitle?: string; contentType?: string; completedAt?: string; responseText?: string }>;
      };
      // Explicit allow-list — never spread the raw row (Host note / AI / shared answer excluded here).
      const mapped: ReflectionEntry[] = (data?.history ?? [])
        .map((h): ReflectionEntry => ({
          entryId: String(h.entryId ?? ""),
          eventTitle: String(h.eventTitle ?? "Foundry training"),
          contentType: h.contentType === "document" ? "document" : "youtube",
          completedAt: String(h.completedAt ?? ""),
          responseText: String(h.responseText ?? ""),
        }))
        .filter((e) => e.responseText.length > 0);
      setItems(mapped);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Scroll the deep-linked entry into view once the list has loaded (owner-scoped; the server
  // already refused any non-owner id, so an unmatched id simply focuses nothing).
  useEffect(() => {
    if (!focusEntryId || !items) return;
    const el = focusRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
  }, [focusEntryId, items]);

  return (
    <section data-testid="center-reflections" className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-white/90">{t.title}</h2>
        <p className="text-xs text-white/45">{t.privacy}</p>
      </div>

      {items === null ? (
        <p className="text-sm text-white/40" role="status">{t.loading}</p>
      ) : items.length === 0 ? (
        <div data-testid="center-reflections-empty" className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-sm text-white/70">{t.empty}</p>
          <p className="mt-1 text-xs text-white/45">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => {
            const focused = !!focusEntryId && it.entryId === focusEntryId;
            return (
              <li
                key={it.entryId}
                ref={focused ? focusRef : undefined}
                data-testid="center-reflection-item"
                data-entry-id={it.entryId}
                data-focused={focused ? "1" : undefined}
                className={
                  "flex flex-col gap-2 rounded-2xl border bg-white/[0.03] px-4 py-3 " +
                  (focused ? "border-[#C9A66B]/60 ring-1 ring-[#C9A66B]/40" : "border-white/8")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[0.95rem] font-medium text-white/90">{it.eventTitle}</span>
                  <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-white/55">
                    {it.contentType === "document" ? t.document : t.video}
                  </span>
                </div>
                <span className="text-xs text-white/45">
                  {t.completedOn} · {formatDate(it.completedAt, loc)}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/85">{it.responseText}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
