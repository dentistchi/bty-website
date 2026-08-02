"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Host authoring entry on the Practice situations surface (Slice 3.2I-R5B2-R1).
 *
 * Founder device evidence: a Host opening Practice → Practice situations saw only completed
 * Practice cards and "Practice again". There was no way in. `ArenaRoom` is a learner runtime — it
 * takes a locale and two strings, has no role input, and none of its branches render an authoring
 * control. The authoring flow was mounted in exactly ONE place, `FoundryEventRooms` under the
 * LEARN tab, reached per-Training through the control room. So the entry was not hidden, clipped
 * or suppressed by list state: it was on another tab.
 *
 * This is that entry, on the surface the Host actually looks at. It creates nothing itself and
 * introduces no second authoring path — it resolves which Training to author for and hands that id
 * to the existing flow, which owns create-or-open exactly as it does from Learn.
 *
 * WHY A TRAINING MUST BE CHOSEN. `createOrOpenArenaDraftShell` is scoped to (owner, sourceEventId),
 * and `GET /arena-drafts` answers `event_id_required` without one — there is no cross-Training
 * draft list to open "the current draft" from. With one Training the choice is already made and a
 * single tap goes straight through; with several, guessing would silently author against the wrong
 * Training, so the Host is asked.
 *
 * AUTHORIZATION comes from the canonical Host list itself: `/api/bty/foundry/events` answers 403
 * `foundry_host_required` for a learner. Following the established `FoundryEventRooms` reading, an
 * auth expiry or network error is NOT read as "not a Host" — it holds silently, so a Host is never
 * told their own control does not exist because a request failed.
 */

type Locale = "en" | "ko";
type ManagerEventSummary = { id: string; title: string };
type Access = "loading" | "host" | "non_host";

const COPY: Record<Locale, {
  create: string;
  pick: string;
  cancel: string;
  none: string;
  noneHint: string;
  opening: string;
}> = {
  en: {
    create: "Create practice",
    pick: "Which training is this practice for?",
    cancel: "Cancel",
    none: "No training to practice yet.",
    noneHint: "Create a training in Learn first — a practice situation is always built from one.",
    opening: "Opening…",
  },
  ko: {
    create: "연습 만들기",
    pick: "어떤 트레이닝을 위한 연습인가요?",
    cancel: "취소",
    none: "아직 연습을 만들 트레이닝이 없습니다.",
    noneHint: "먼저 배우기에서 트레이닝을 만들어 주세요 — 연습 상황은 항상 트레이닝에서 만들어집니다.",
    opening: "여는 중…",
  },
};

export function PracticeAuthoringEntry({
  locale,
  onOpen,
}: {
  locale: string;
  /** Hands the chosen Training to the existing authoring flow. This component never creates. */
  onOpen: (eventId: string) => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];

  const [access, setAccess] = useState<Access>("loading");
  const [events, setEvents] = useState<ManagerEventSummary[]>([]);
  const [picking, setPicking] = useState(false);
  const openedRef = useRef(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bty/foundry/events", { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { events?: ManagerEventSummary[] };
          if (cancelled) return;
          setEvents(Array.isArray(data.events) ? data.events : []);
          setAccess("host");
          return;
        }
        if (res.status === 403) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (cancelled) return;
          if (body?.error === "foundry_host_required") {
            setAccess("non_host");
            return;
          }
        }
        // Auth expiry, network or server error — a neutral hold, never a false "not a Host".
        setAccess("loading");
      } catch {
        if (!cancelled) setAccess("loading");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** One arrival at the flow per press, however many times the control is tapped. */
  const open = useCallback(
    (eventId: string) => {
      if (openedRef.current) return;
      openedRef.current = true;
      setOpening(true);
      onOpen(eventId);
    },
    [onOpen],
  );

  // A learner sees nothing at all — not a disabled control, not an explanation.
  if (access !== "host") return null;

  if (events.length === 0) {
    return (
      <section
        data-testid="practice-authoring-entry"
        className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
      >
        <span className="text-[0.95rem] font-medium text-white/85">{t.none}</span>
        <span className="text-[0.78rem] leading-5 text-white/50">{t.noneHint}</span>
      </section>
    );
  }

  // One Training is not a decision — go straight through.
  if (events.length === 1 || !picking) {
    return (
      <section data-testid="practice-authoring-entry" className="flex flex-col">
        <button
          type="button"
          data-testid="practice-create-cta"
          disabled={opening}
          onClick={() => (events.length === 1 ? open(events[0].id) : setPicking(true))}
          className="min-h-[3rem] w-full rounded-2xl bg-[#C9A66B] px-4 py-3 text-[0.95rem] font-semibold text-[#0B1F3A] disabled:opacity-60"
        >
          {opening ? t.opening : t.create}
        </button>
      </section>
    );
  }

  return (
    <section
      data-testid="practice-authoring-entry"
      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
      aria-labelledby="practice-authoring-pick"
    >
      <h2 id="practice-authoring-pick" className="text-[0.95rem] font-medium text-white/85">
        {t.pick}
      </h2>
      <ul className="flex flex-col gap-2">
        {events.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={opening}
              onClick={() => open(e.id)}
              className="min-h-[3rem] w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-left text-sm leading-6 text-white/85 disabled:opacity-60"
            >
              {e.title}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setPicking(false)}
        className="self-start px-1 py-1.5 text-xs text-white/50 hover:text-white/80"
      >
        {t.cancel}
      </button>
    </section>
  );
}
