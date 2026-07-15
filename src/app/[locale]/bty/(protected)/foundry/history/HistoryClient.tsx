"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Foundry History + Living Thread — the room where a finished training is not lost.
 *
 * Deliberately NOT a scoreboard: no streak, score, percentage, badge, achievement
 * language, spinner, toast, or chat UI. History renders first; the Living Thread
 * (only when there is enough real longitudinal evidence) arrives quietly afterward.
 * Every line shown is the user's own — no fabricated titles, dates, or meaning.
 * English-only surface (the app language).
 */

type Reflection = {
  whatEmerged: string;
  whereYouStretched: string;
  livingSentence: string;
  nextInvitation: string;
};

type HistoryItem = {
  eventId: string;
  eventTitle: string;
  completedAt: string;
  responseText: string;
  responseExcerpt: string;
  aiReflection: Reflection | null;
  aiReflectionLine: string | null;
  completionState: "pass" | "review" | "incomplete" | null;
};

type Thread = {
  thread: string;
  supportingMoments: { eventId: string; excerpt: string }[];
  nextQuestion: string | null;
};

type HistoryResponse = {
  ok?: boolean;
  history?: HistoryItem[];
  thread?: Thread | null;
  threadStatusCopy?: string | null;
  threadNeedsGeneration?: boolean;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const COMPLETION_WORD: Record<NonNullable<HistoryItem["completionState"]>, string> = {
  pass: "Stayed with the whole of it",
  review: "Moved through it in your own way",
  incomplete: "Made an early pass",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{children}</p>;
}

export default function HistoryClient({ locale }: { locale: string }) {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [statusCopy, setStatusCopy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const threadRequested = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/bty/foundry/history", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as HistoryResponse | null;
        if (!alive || !data?.ok) {
          if (alive) setLoaded(true);
          return;
        }
        setItems(data.history ?? []);
        setThread(data.thread ?? null);
        setStatusCopy(data.threadStatusCopy ?? null);
        setLoaded(true);

        // The thread is eligible but not yet generated — produce it AFTER history
        // is on screen (never blocks the list; no spinner, quiet fill-in).
        if (data.threadNeedsGeneration && !threadRequested.current) {
          threadRequested.current = true;
          const t = await fetch("/api/bty/foundry/history/thread", { method: "POST", cache: "no-store" });
          const td = (await t.json().catch(() => null)) as { ok?: boolean; thread?: Thread | null } | null;
          if (alive && td?.ok && td.thread) setThread(td.thread);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const titleById = new Map(items.map((i) => [i.eventId, i] as const));

  return (
    <main className="min-h-screen bg-bty-navy text-white">
      <div className="mx-auto max-w-xl px-5 pt-8 pb-16">
        <header className="mb-8">
          <a href={`/${locale}/bty/foundry`} className="text-xs text-white/40 hover:text-white/70">
            ← Foundry
          </a>
          <h1 className="mt-3 text-2xl font-semibold text-white">What you have faced here</h1>
          <p className="mt-2 text-sm text-white/55">
            The trainings you finished, kept in your own words.
          </p>
        </header>

        {/* Reserved area — no spinner; a calm placeholder holds the layout still. */}
        {!loaded ? (
          <p className="text-sm leading-6 text-white/35">Gathering what you have left here…</p>
        ) : (
          <>
            {/* Living Thread — only when the evidence genuinely supports it. */}
            {thread ? (
              <section className="mb-9 rounded-2xl border border-[#C9A66B]/25 bg-white/[0.02] px-5 py-5">
                <Eyebrow>A living thread</Eyebrow>
                <p className="mt-3 text-base leading-relaxed text-white">{thread.thread}</p>
                <ul className="mt-4 flex flex-col gap-3 list-none p-0 m-0">
                  {thread.supportingMoments.map((m, i) => {
                    const it = titleById.get(m.eventId);
                    return (
                      <li key={`${m.eventId}-${i}`} className="border-l-2 border-white/15 pl-3">
                        <div className="text-xs text-white/45">
                          {it ? `${fmtDate(it.completedAt)} · ${it.eventTitle}` : ""}
                        </div>
                        <div className="mt-0.5 text-sm italic leading-6 text-white/80">“{m.excerpt}”</div>
                      </li>
                    );
                  })}
                </ul>
                {thread.nextQuestion ? (
                  <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-[#C9A66B]">
                    {thread.nextQuestion}
                  </p>
                ) : null}
              </section>
            ) : statusCopy && items.length > 0 ? (
              <p className="mb-8 text-sm leading-6 text-white/45">{statusCopy}</p>
            ) : null}

            {/* History list — calm, one line of weight each; open for the detail. */}
            {items.length > 0 ? (
              <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                {items.map((it) => {
                  const open = openId === it.eventId;
                  return (
                    <li key={it.eventId} className="rounded-xl border border-white/10 bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : it.eventId)}
                        aria-expanded={open}
                        className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
                      >
                        <span className="text-xs text-white/40">{fmtDate(it.completedAt)}</span>
                        <span className="text-sm font-semibold text-white/90">{it.eventTitle}</span>
                        {it.responseExcerpt ? (
                          <span className="mt-0.5 text-sm leading-6 text-white/55">“{it.responseExcerpt}”</span>
                        ) : null}
                        {it.aiReflectionLine ? (
                          <span className="mt-1 text-sm italic leading-6 text-white/45">{it.aiReflectionLine}</span>
                        ) : null}
                      </button>

                      {open ? (
                        <div className="border-t border-white/10 px-4 py-4">
                          {it.completionState ? (
                            <p className="text-xs text-white/40">{COMPLETION_WORD[it.completionState]}</p>
                          ) : null}
                          {it.responseText ? (
                            <div className="mt-3">
                              <Eyebrow>Your reflection</Eyebrow>
                              <p className="mt-1.5 text-sm leading-6 text-white/80">{it.responseText}</p>
                            </div>
                          ) : null}
                          {it.aiReflection ? (
                            <div className="mt-4 flex flex-col gap-2.5">
                              <Eyebrow>A living reflection</Eyebrow>
                              <p className="text-sm leading-6 text-white/75">{it.aiReflection.whatEmerged}</p>
                              <p className="text-sm leading-6 text-white/75">{it.aiReflection.whereYouStretched}</p>
                              <p className="text-sm italic leading-6 text-white">“{it.aiReflection.livingSentence}”</p>
                              <p className="text-sm leading-6 text-white/75">{it.aiReflection.nextInvitation}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-white/45">{statusCopy ?? "No completed reflections yet."}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
