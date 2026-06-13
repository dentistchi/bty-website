"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTrain } from "@/contexts/TrainContext";
import { getMessages } from "@/lib/i18n";
import TrainDayReflectionSet from "@/components/train/TrainDayReflectionSet";

import TRAIN_BILINGUAL from "@/content/train-28days.en-base.json";

type ChatMsg = { role: "user" | "assistant"; content: string };

function CoachChat({ day, locale }: { day: number; locale: string }) {
  const isKo = locale === "ko";
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const systemContext = `Day ${day} of a 28-day self-esteem training program. Help the user apply today's lesson in the smallest, most practical way.`;
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemContext },
            ...next.map((m) => ({ role: m.role, content: m.content })),
          ],
          mode: "center",
          lang: isKo ? "ko" : "en",
        }),
      });
      const data: { message?: string; error?: string } = await r.json().catch(() => ({}));
      const reply = data.message ?? (isKo ? "잠시 후 다시 시도해 주세요." : "Refresh in a moment.");
      setMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: isKo ? "연결에 실패했어요." : "Connection failed." }]);
    } finally {
      setSending(false);
    }
  }, [input, msgs, sending, day, isKo]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {isKo ? "코치 대화" : "Coach chat"}
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>
        {isKo ? `Day ${day} 레슨을 오늘 실천하려면 어떻게 할까요?` : `How can you apply Day ${day}'s lesson today?`}
      </div>
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10, minHeight: 120, maxHeight: 320 }}
        role="log"
        aria-label={isKo ? "코치 대화 내역" : "Coach conversation"}
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <div style={{ opacity: 0.5, fontSize: 13 }}>
            {isKo
              ? `"Day ${day}: 오늘 가장 작은 10분 실천을 도와줘."`
              : `"Day ${day}: Help me do the smallest 10-minute version of today's practice."`}
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: 12,
              background: m.role === "user" ? "#1e40af" : "#f3f4f6",
              color: m.role === "user" ? "white" : "#111",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: "flex-start", opacity: 0.5, fontSize: 13 }}>
            {isKo ? "답변 생성 중…" : "Thinking…"}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={isKo ? "메시지 입력…" : "Type a message…"}
          rows={2}
          style={{ flex: 1, borderRadius: 8, border: "1px solid #ddd", padding: "6px 10px", fontSize: 13, resize: "none" }}
          aria-label={isKo ? "코치에게 메시지 입력" : "Message to coach"}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!input.trim() || sending}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontSize: 13, opacity: !input.trim() || sending ? 0.5 : 1 }}
          aria-label={isKo ? "전송" : "Send"}
        >
          {isKo ? "전송" : "Send"}
        </button>
      </div>
    </div>
  );
}

function clampDay(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

// Raw section-label literals (source of truth = raw blob, not meta.sectionLabels).
// en uses the actual embedded run "Today's small win" (straight ' U+0027), not
// meta.en "Small win". `note` is excluded — it never appears as a raw heading line.
const SECTION_LABELS = new Set<string>([
  "Morning ritual",
  "Core practice",
  "Why it works",
  "Expected resistance",
  "Breakthrough strategy",
  "Evening reflection",
  "Today's small win",
  "아침 의식",
  "핵심 실천",
  "왜 효과가 있을까?",
  "예상되는 저항",
  "돌파 전략",
  "저녁 성찰",
  "오늘의 작은 승리",
]);

type LessonSegment =
  | { kind: "header"; label: string }
  | { kind: "body"; text: string };

// Splits the raw lesson blob into header/body segments at label-line boundaries
// (trim-only match against SECTION_LABELS). No content mutation: label text is
// surfaced as a header, body lines keep their original newlines so the existing
// renderParagraphs (\n{2,} → <p>) handles them identically. Zero label matches →
// a single body segment (= current flat render).
function parseLessonSections(text: string): LessonSegment[] {
  const segments: LessonSegment[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length > 0) {
      segments.push({ kind: "body", text: buffer.join("\n") });
      buffer = [];
    }
  };
  for (const line of text.split("\n")) {
    if (SECTION_LABELS.has(line.trim())) {
      flush();
      segments.push({ kind: "header", label: line.trim() });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
}

// Single-color outline glyph per section label (currentColor, inherits header
// weight/size). Switch keyed on the raw label literals (en+ko); "Today's small
// win" uses the straight ' U+0027 as embedded in raw. Unmatched label → null
// (header renders text-only, graceful). No external icon lib / webfont.
function SectionIcon({ label }: { label: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (label.trim()) {
    case "Morning ritual":
    case "아침 의식":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      );
    case "Core practice":
    case "핵심 실천":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.2" />
        </svg>
      );
    case "Why it works":
    case "왜 효과가 있을까?":
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
        </svg>
      );
    case "Expected resistance":
    case "예상되는 저항":
      return (
        <svg {...common}>
          <path d="M10.3 4.3 2.5 18a1.5 1.5 0 0 0 1.3 2.2h16.4a1.5 1.5 0 0 0 1.3-2.2L13.7 4.3a1.5 1.5 0 0 0-2.6 0Z" />
          <path d="M12 10v4M12 17.5v.01" />
        </svg>
      );
    case "Breakthrough strategy":
    case "돌파 전략":
      return (
        <svg {...common}>
          <path d="M12 2c2.5 2 4 5 4 8.5 0 1.8-.4 3.3-1 4.5H9c-.6-1.2-1-2.7-1-4.5C8 7 9.5 4 12 2Z" />
          <path d="M9 15c-1.5.8-2.5 2.3-2.5 4 1.2 0 2.3-.5 3-1.3M15 15c1.5.8 2.5 2.3 2.5 4-1.2 0-2.3-.5-3-1.3" />
          <path d="M10.5 20.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5" />
          <circle cx="12" cy="9.5" r="1.3" />
        </svg>
      );
    case "Evening reflection":
    case "저녁 성찰":
      return (
        <svg {...common}>
          <path d="M19 14.8A8 8 0 0 1 9.2 5a7 7 0 1 0 9.8 9.8Z" />
        </svg>
      );
    case "Today's small win":
    case "오늘의 작은 승리":
      return (
        <svg {...common}>
          <path d="M4 20 8.5 8l7.5 7.5L4 20Z" />
          <path d="M14 8.5 15.5 7M17 11l1.8-.6M13 5l.5-2M19 6l1.5-1.2M18.5 14.5 21 15" />
        </svg>
      );
    default:
      return null;
  }
}

export default function TrainDayPage() {
  const params = useParams<{ locale?: string; day: string }>();
  const locale = (params?.locale === "ko" ? "ko" : "en") as "ko" | "en";
  const t = getMessages(locale).train;
  const day = clampDay(Number(params.day));

  const {
    progress,
    markTodayComplete,
    showCompletionSummary,
    setShowCompletionSummary,
    completionSummary,
    generateCompletionSummary,
  } = useTrain();

  type LocStr = { en?: string; ko?: string };
  type BiDay = { day?: number; sourceDate?: string; title?: LocStr; sections?: Record<string, LocStr>; raw?: LocStr };
  const pick = (x?: LocStr): string => x?.[locale] ?? x?.en ?? x?.ko ?? "";
  const lesson = (TRAIN_BILINGUAL as { days: Record<string, BiDay> }).days?.[String(day)];
  const lessonTitle = pick(lesson?.title);
  const lessonText =
    pick(lesson?.raw) ||
    [lessonTitle, ...Object.entries(lesson?.sections ?? {}).map(([k, v]) => `${k}\n${pick(v)}`)].join("\n\n");

  const isUnlocked = day <= (progress?.todayUnlockedDay ?? 1);
  const isCompleted = (progress?.completedDays ?? []).includes(day);

  // Presentation-only readability helpers (no source/shape change — still renders raw blob).
  const renderParagraphs = (text: string): React.ReactNode[] =>
    text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+$/u, ""))
      .filter((p) => p.length > 0)
      .map((p, index) => (
        <p key={index} style={{ whiteSpace: "pre-wrap", margin: 0, marginBottom: 14 }}>
          {p}
        </p>
      ));

  // Section-aware render: label lines become headers (weight + spacing only —
  // no accent/icon/uppercase; that is increment 2), body segments reuse
  // renderParagraphs. Applied per collapse slice so the char-index collapse
  // (lessonHead/lessonTail) is untouched.
  const renderSections = (slice: string): React.ReactNode[] =>
    parseLessonSections(slice).map((seg, i) =>
      seg.kind === "header" ? (
        <div
          key={`h-${i}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 500,
            marginTop: i === 0 ? 0 : 24,
            marginBottom: 8,
          }}
        >
          <SectionIcon label={seg.label} />
          <span>{seg.label}</span>
        </div>
      ) : (
        <React.Fragment key={`b-${i}`}>{renderParagraphs(seg.text)}</React.Fragment>
      )
    );

  // Locale-aware collapse threshold: Korean is ~2x denser per char, so the same
  // content yields far fewer chars in KO — a single 800 threshold hid the toggle on
  // ~24 KO days. KO uses a lower threshold; EN unchanged (no regression).
  const LESSON_COLLAPSE_AT = locale === "ko" ? 450 : 800;
  const lessonBody = lessonText || "Lesson content missing.";
  const lessonIsLong = lessonBody.length > LESSON_COLLAPSE_AT;
  const lessonBreakAt = lessonBody.lastIndexOf("\n", LESSON_COLLAPSE_AT);
  // Minimum head before a clean paragraph break is used; scales with the threshold
  // (EN 800→200 unchanged, KO 450→~113) so the collapsed head stays proportionate.
  const lessonMinHead = Math.round(LESSON_COLLAPSE_AT * 0.25);
  const lessonCutIndex = lessonIsLong
    ? lessonBreakAt > lessonMinHead
      ? lessonBreakAt
      : LESSON_COLLAPSE_AT
    : lessonBody.length;
  const lessonHead = lessonBody.slice(0, lessonCutIndex);
  const lessonTail = lessonBody.slice(lessonCutIndex);

  // ②-full: remember which day's summary we've already requested, so the
  // Completion panel generates once and toggling Coach↔Completion never re-fires.
  const summaryRequestedRef = React.useRef<number | null>(null);

  const onClickComplete = React.useCallback(() => {
    summaryRequestedRef.current = day;
    generateCompletionSummary({ day, lessonText: lessonText ?? "" });
    markTodayComplete(day);
  }, [day, lessonText, generateCompletionSummary, markTodayComplete]);

  // ②-full: on-demand generation when the Completion panel is opened/selected.
  // Guards (per dispatch): do nothing if a summary already exists, or if one was
  // already requested for this day (covers the in-flight / already-attempted case).
  // Deterministic and local — reuses the existing completion-pack path; adds no
  // server mutation. Fails soft: on failure the panel keeps its empty-state copy.
  React.useEffect(() => {
    if (!showCompletionSummary) return;
    if (completionSummary) return;
    if (summaryRequestedRef.current === day) return;
    summaryRequestedRef.current = day;
    generateCompletionSummary({ day, lessonText: lessonText ?? "" });
  }, [showCompletionSummary, completionSummary, day, lessonText, generateCompletionSummary]);

  // ③b: scroll the RIGHT Coach/Completion <aside> into view when the toggle changes
  // on mobile. One ref/effect covers both the center buttons AND the right-aside pills
  // because both drive showCompletionSummary. `didMountRef` skips the first run so page
  // load never auto-scrolls; the media query gates to the single-column stack only, so
  // desktop md+ (three-column) never auto-scrolls.
  const panelAsideRef = React.useRef<HTMLElement | null>(null);
  const didMountRef = React.useRef(false);
  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (typeof window === "undefined") return;
    // Tailwind md = 768px (no screens override) → mobile single-column active at ≤767px.
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelAsideRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [showCompletionSummary]);

  return (
    <div className="grid grid-cols-1 min-h-screen md:h-screen md:grid-cols-[360px_1fr_420px]">
      {/* LEFT: Sidebar */}
      <aside className="order-3 md:order-1" style={{ borderRight: "1px solid #eee", padding: 16, overflow: "auto" }} role="navigation" aria-label={t.dayListLabel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{t.title}</div>
          <a
            href={`/${locale}/center`}
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none", opacity: 0.8 }}
            aria-label={locale === "ko" ? "Center로 돌아가기" : "Back to Center"}
          >
            ← {locale === "ko" ? "Center" : "Center"}
          </a>
        </div>
        <div style={{ opacity: 0.7, marginBottom: 8 }}>
          Unlocked today: Day {progress?.todayUnlockedDay ?? 1}
        </div>
        {/* DECISION6 C2-5 + B-2: review past Dear Me reflections; ?day deep-links History to this day's reflection (pre-select/expand/scroll). */}
        <a
          href={`/${locale}/center/letters?day=${day}`}
          style={{ display: "inline-block", marginBottom: 16, fontSize: 12, color: "#0f766e", textDecoration: "none" }}
          aria-label={locale === "ko" ? "지난 Dear Me 기록 복습" : "Review past Dear Me entries"}
        >
          {locale === "ko" ? "지난 reflection 복습 →" : "Review past reflections →"}
        </a>

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
                <span style={{ fontSize: 12, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {completed ? (
                    <>
                      <span aria-hidden="true">✅</span> {locale === "ko" ? "완료" : "Done"}
                    </>
                  ) : unlocked ? (
                    ""
                  ) : (
                    <>
                      <span aria-hidden="true">🔒</span> {locale === "ko" ? "잠김" : "Locked"}
                    </>
                  )}
                </span>
              </a>
            );
          })}
        </div>
      </aside>

      {/* CENTER: Lesson */}
      <main className="order-1 md:order-2" style={{ padding: 24, overflow: "auto" }} aria-label={t.lessonLabel}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
          Day {day}
        </div>
        <h1 style={{ margin: 0, marginBottom: 20, fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>{lessonTitle}</h1>

        {!isUnlocked && (
          <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12, marginBottom: 18 }} role="status" aria-label={t.lockedLabel}>
            Complete the previous day to unlock this one.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }} role="group" aria-label={t.completeGroupLabel}>
          <button
            type="button"
            onClick={onClickComplete}
            disabled={!isUnlocked || isCompleted}
            aria-label={isCompleted ? (locale === "ko" ? "완료됨" : "Completed") : (locale === "ko" ? "오늘 완료로 표시" : "Mark today as complete")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              opacity: !isUnlocked || isCompleted ? 0.5 : 1,
              cursor: !isUnlocked || isCompleted ? "not-allowed" : "pointer",
            }}
          >
            {isCompleted ? (locale === "ko" ? "완료됨" : "Completed") : (locale === "ko" ? "오늘 완료로 표시" : "Mark today as complete")}
          </button>

          <button
            type="button"
            onClick={() => setShowCompletionSummary(false)}
            aria-label={t.coachChatLabel}
            aria-pressed={!showCompletionSummary}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "white" : "black",
              color: showCompletionSummary ? "black" : "white",
            }}
          >
            {locale === "ko" ? "코치 대화" : "Coach chat"}
          </button>
          <button
            type="button"
            onClick={() => setShowCompletionSummary(true)}
            aria-label={t.completionSummaryLabel}
            aria-pressed={showCompletionSummary}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "black" : "white",
              color: showCompletionSummary ? "white" : "black",
            }}
          >
            {locale === "ko" ? "완료 요약" : "Completion summary"}
          </button>
        </div>

        <article style={{ lineHeight: 1.7 }}>
          {renderSections(lessonHead)}
          {lessonIsLong && (
            <>
              <style>{`
                .lesson-more > summary { cursor: pointer; list-style: none; color: #2563eb; font-size: 14px; padding: 6px 0; }
                .lesson-more > summary::-webkit-details-marker { display: none; }
                .lesson-more > summary .lesson-more-hide { display: none; }
                .lesson-more[open] > summary .lesson-more-show { display: none; }
                .lesson-more[open] > summary .lesson-more-hide { display: inline; }
              `}</style>
              <details className="lesson-more">
                <summary>
                  <span className="lesson-more-show">{locale === "ko" ? "더 보기" : "Show more"}</span>
                  <span className="lesson-more-hide">{locale === "ko" ? "접기" : "Show less"}</span>
                </summary>
                <div style={{ marginTop: 14 }}>{renderSections(lessonTail)}</div>
              </details>
            </>
          )}
        </article>

        {/* DECISION6 C2: Day Reflection Set — additive, below lesson (replaces Unit1
            TrainDayCapture). Independent upsert; never touches markTodayComplete /
            the completion gate (기록 ≠ 완료). renderer raw unchanged. */}
        <TrainDayReflectionSet day={day} locale={locale} />
      </main>

      {/* RIGHT: Chat / Completion Summary */}
      <aside ref={panelAsideRef} className="order-2 md:order-3" role="region" aria-label={t.sidebarPanelLabel} style={{ borderLeft: "1px solid #eee", padding: 16, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowCompletionSummary(false)}
            aria-label={t.coachChatLabel}
            aria-pressed={!showCompletionSummary}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "white" : "black",
              color: showCompletionSummary ? "black" : "white",
            }}
          >
            {locale === "ko" ? "코치 대화" : "Coach chat"}
          </button>
          <button
            type="button"
            onClick={() => setShowCompletionSummary(true)}
            aria-label={t.completionSummaryLabel}
            aria-pressed={showCompletionSummary}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: showCompletionSummary ? "black" : "white",
              color: showCompletionSummary ? "white" : "black",
            }}
          >
            {locale === "ko" ? "완료 요약" : "Completion summary"}
          </button>
        </div>

        {!showCompletionSummary ? (
          <div role="region" aria-label={t.coachChatLabel} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CoachChat day={day} locale={locale} />
          </div>
        ) : (
          <div role="region" aria-label={t.completionSummaryLabel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Completion summary</div>
            {!completionSummary ? (
              <div style={{ opacity: 0.7 }} role="status" aria-label={locale === "ko" ? "완료 요약 없음" : "No completion summary yet"}>
                {locale === "ko" ? "아직 완료 요약이 없습니다." : "No completion summary yet."}
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

                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }} role="group" aria-label={t.reinforcementLabel}>
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
