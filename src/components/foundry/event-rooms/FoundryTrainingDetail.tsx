"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * ONE COMPLETED TRAINING, REVIEWED. Slice My Learning — Canonical Training History V1.
 *
 * ★ PROGRESSIVE DISCLOSURE, BECAUSE A LEARNING HISTORY GETS LONG. Someone with a hundred completed
 * trainings must still open a calm screen. So nothing here shows a question until it is asked for:
 *
 *     detail      the title, the date, and a row per thing there is to see   (this screen)
 *     material    the training text                                          (one tap)
 *     review      the questions as a list of ticks and one flag              (one tap)
 *     question    the question, their answer, the right one, why             (one more tap)
 *
 * Each level answers one thing and offers the next, and NOTHING is expanded before it is asked
 * for — not the training text, not the questions, not an answer. Dumping any of it onto the detail
 * would make the common case, "I just want to see what I did", scroll past a wall of content.
 *
 * ★ IT NEVER INVENTS A VERDICT, OR A GAP. A training with no quiz shows no quiz section rather
 * than an empty `0 / 0`, and a training that never asked for a reflection shows no reflection
 * section rather than telling the learner they did not write one. An absence nobody asked for is
 * not news.
 *
 * ★ PRIVATE REFLECTION IS NOT SHOWN HERE. The server sends only whether one exists. Reading it
 * happens in Center, which is the surface that owns it, reached as an in-shell destination — so
 * the tap stays inside BTY in Teams rather than opening a browser.
 */

type Choice = { id: string; label: string };
type Question = {
  id: string;
  text: string;
  choices: Choice[];
  selectedChoiceId: string | null;
  correctChoiceId: string;
  explanation: string | null;
};
type Detail = {
  title: string;
  completedAt: string | null;
  content: { materialText?: string } | null;
  quiz: { correctCount: number; totalCount: number; scorePercent: number; questions: Question[] } | null;
  hasReflection: boolean;
  /** Follow-up doors for this record, decided server-side by the surface that owns the rule. */
  checkInAgain?: { followupId: string; followUpDays: number; outcome: string }[];
  openFollowUp?: { followupId: string; followUpDays: number }[];
};

const COPY = {
  en: {
    back: "Back to My Learning",
    completed: "Completed",
    loading: "Opening…",
    unavailable: "This training can't be opened right now.",
    training: "Training",
    trainingSub: "What I learned",
    trainingEmpty: "This training's material is no longer available.",
    quizReview: "Quiz review",
    quizSub: (total: number, correct: number) =>
      `${total} question${total === 1 ? "" : "s"} · ${correct} correct`,
    reflection: "Private reflection",
    reflectionSub: "View in Center",
    followUpOpen: "Follow-up",
    followUpAgain: "Check in again",
    followUpAt: (d: number) => `${d}-day checkpoint`,
    question: (n: number) => `Question ${n}`,
    review: "Review",
    oneToReview: (n: number) => `${n} item${n === 1 ? "" : "s"} to review`,
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    noAnswer: "No answer",
    backToReview: "Back to quiz review",
  },
  ko: {
    back: "내 학습으로 돌아가기",
    completed: "완료",
    loading: "여는 중…",
    unavailable: "지금은 이 학습을 열 수 없습니다.",
    training: "학습 내용",
    trainingSub: "내가 배운 것",
    trainingEmpty: "이 학습의 자료를 더 이상 볼 수 없습니다.",
    quizReview: "퀴즈 다시 보기",
    quizSub: (total: number, correct: number) => `${total}문항 · ${correct}개 정답`,
    reflection: "비공개 기록",
    reflectionSub: "Center에서 보기",
    followUpOpen: "후속 확인",
    followUpAgain: "다시 확인하기",
    followUpAt: (d: number) => `${d}일 후 확인`,
    question: (n: number) => `${n}번 문항`,
    review: "다시 보기",
    oneToReview: (n: number) => `다시 볼 문항 ${n}개`,
    yourAnswer: "내가 고른 답",
    correctAnswer: "정답",
    noAnswer: "답변 없음",
    backToReview: "퀴즈 목록으로",
  },
} as const;

function formatDay(iso: string | null, locale: "en" | "ko"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** A section that says what it holds and opens it — the only shape this screen uses. */
function SectionRow({
  label,
  sub,
  onOpen,
  href,
  testId,
}: {
  label: string;
  sub: string;
  onOpen?: () => void;
  /**
   * An in-shell BTY destination. Rendered as a real anchor ON PURPOSE: the Teams containment guard
   * reads anchors, so this row is contained by the same proven path as every other BTY link rather
   * than by a second mechanism that would have to be kept correct separately.
   */
  href?: string;
  testId: string;
}) {
  const inner = (
    <>
      <span className="flex flex-col gap-0.5 text-left">
        <span className="text-sm font-medium text-white/85">{label}</span>
        <span className="text-xs text-white/50">{sub}</span>
      </span>
      {onOpen || href ? (
        <span aria-hidden className="text-white/30">
          ›
        </span>
      ) : null}
    </>
  );
  const className =
    "flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3";
  if (href) {
    return (
      <a href={href} data-testid={testId} className={`${className} transition-colors hover:bg-white/[0.04]`}>
        {inner}
      </a>
    );
  }
  return onOpen ? (
    <button type="button" onClick={onOpen} data-testid={testId} className={`${className} transition-colors hover:bg-white/[0.04]`}>
      {inner}
    </button>
  ) : (
    <div data-testid={testId} className={className}>
      {inner}
    </div>
  );
}

export function FoundryTrainingDetail({
  entryId,
  locale,
  onBack,
  reflectionHref,
  onOpenFollowUp,
}: {
  entryId: string;
  locale: "en" | "ko";
  onBack: () => void;
  /** The learner's Center reflection, as an in-shell BTY destination. */
  reflectionHref: string;
  /** Opens the focused follow-up response surface. Same callback the list used to pass. */
  onOpenFollowUp?: (followupId: string) => void;
}) {
  const t = COPY[locale];
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  /** detail → review → one question. The only navigation this screen has. */
  const [level, setLevel] = useState<"detail" | "material" | "review">("detail");
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setFailed(false);
    setLevel("detail");
    setOpenQuestionId(null);
    const tz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
    })();
    void fetch(`/api/bty/foundry/history/entry/${encodeURIComponent(entryId)}${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (r) => (r.ok ? ((await r.json()) as Detail & { ok: boolean }) : null))
      .then((next) => {
        if (!live) return;
        if (next) setDetail(next);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [entryId]);

  const missedCount = useMemo(
    () => detail?.quiz?.questions.filter((q) => q.selectedChoiceId !== q.correctChoiceId).length ?? 0,
    [detail],
  );

  const closeQuestion = useCallback(() => setOpenQuestionId(null), []);

  const material = (detail?.content?.materialText ?? "").trim();
  const openQuestion = detail?.quiz?.questions.find((q) => q.id === openQuestionId) ?? null;
  const questionNumber = openQuestion
    ? (detail?.quiz?.questions.findIndex((q) => q.id === openQuestion.id) ?? 0) + 1
    : 0;

  // ---- LEVEL 4: one question, the deepest layer and the only one that shows answers. ----
  if (openQuestion) {
    const chose = openQuestion.choices.find((c) => c.id === openQuestion.selectedChoiceId)?.label ?? null;
    const correct = openQuestion.choices.find((c) => c.id === openQuestion.correctChoiceId)?.label ?? "";
    return (
      <section className="flex flex-col gap-3 px-4 py-4" data-testid="training-question-detail">
        <button type="button" onClick={closeQuestion} data-testid="question-detail-back" className="self-start text-xs text-white/45 hover:text-white/70">
          {t.backToReview}
        </button>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.question(questionNumber)}</p>
        <p className="text-sm leading-6 text-white/85">{openQuestion.text}</p>
        <div className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-white/50">
            {t.yourAnswer}: <span className="text-white/75">{chose ?? t.noAnswer}</span>
          </p>
          <p className="text-xs text-white/70">
            {t.correctAnswer}: <span className="text-white/90">{correct}</span>
          </p>
        </div>
        {openQuestion.explanation ? (
          <p className="text-xs leading-5 text-white/50" data-testid="question-detail-explanation">
            {openQuestion.explanation}
          </p>
        ) : null}
      </section>
    );
  }

  // ---- The training itself, on request. Never expanded before it is asked for. ----
  if (level === "material" && material) {
    return (
      <section className="flex flex-col gap-3 px-4 py-4" data-testid="training-material">
        <button type="button" onClick={() => setLevel("detail")} data-testid="training-material-back" className="self-start text-xs text-white/45 hover:text-white/70">
          {t.back}
        </button>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.training}</p>
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/80" data-testid="training-material-text">
          {material}
        </p>
      </section>
    );
  }

  // ---- LEVEL 3: the questions as a list. Ticks and flags, never answers. ----
  if (level === "review" && detail?.quiz) {
    return (
      <section className="flex flex-col gap-3 px-4 py-4" data-testid="training-quiz-review">
        <button type="button" onClick={() => setLevel("detail")} data-testid="quiz-review-back" className="self-start text-xs text-white/45 hover:text-white/70">
          {t.back}
        </button>
        <p className="text-sm text-white/60">{t.quizSub(detail.quiz.totalCount, detail.quiz.correctCount)}</p>
        <ul className="flex flex-col gap-2">
          {detail.quiz.questions.map((q, i) => {
            const ok = q.selectedChoiceId === q.correctChoiceId;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setOpenQuestionId(q.id)}
                  data-testid={`quiz-review-row-${q.id}`}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="text-sm text-white/80">{t.question(i + 1)}</span>
                  <span className="flex items-center gap-2">
                    {ok ? (
                      <span aria-hidden className="text-sm text-white/40">✓</span>
                    ) : (
                      <span className="rounded-md bg-[#C9A66B]/15 px-2 py-0.5 text-[0.7rem] font-medium text-[#E5B769]" data-testid="quiz-review-flag">
                        {t.review}
                      </span>
                    )}
                    <span aria-hidden className="text-white/25">›</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  // ---- LEVEL 2: what this training was, and the doors. No quiz content. ----
  return (
    <section className="flex flex-col gap-3 px-4 py-4" data-testid="training-detail">
      <button type="button" onClick={onBack} data-testid="training-detail-back" className="self-start text-xs text-white/45 hover:text-white/70">
        {t.back}
      </button>

      {failed ? <p className="text-sm text-white/60">{t.unavailable}</p> : null}
      {!detail && !failed ? <p className="text-sm text-white/45">{t.loading}</p> : null}

      {detail ? (
        <>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold text-white/90" data-testid="training-detail-title">{detail.title}</h2>
            <p className="text-xs text-white/50">
              {t.completed} · {formatDay(detail.completedAt, locale)}
            </p>

          </div>

          <SectionRow
            label={t.training}
            sub={material ? t.trainingSub : t.trainingEmpty}
            testId="training-detail-material"
            onOpen={material ? () => setLevel("material") : undefined}
          />

          {/* A training with no quiz has no quiz section. An empty result is a claim about them. */}
          {detail.quiz ? (
            <SectionRow
              label={t.quizReview}
              /*
                THE SCORE LIVES HERE, once. It was also printed at the top of this screen, which
                meant the same three numbers appeared twice on a surface whose whole job is to be
                scannable. Under the row it labels, it is the reason to open that row.
              */
              sub={
                missedCount === 0
                  ? `${detail.quiz.correctCount} / ${detail.quiz.totalCount} · ${detail.quiz.scorePercent}%`
                  : `${detail.quiz.correctCount} / ${detail.quiz.totalCount} · ${detail.quiz.scorePercent}% · ${t.oneToReview(missedCount)}`
              }
              testId="training-detail-quiz"
              onOpen={() => setLevel("review")}
            />
          ) : null}

          {/*
            NO REFLECTION, NO SECTION. This training never asked for one — a quiz-backed Quick
            Training has no reflection step at all — so a row saying "you didn't write a
            reflection" reported a gap that never existed and implied the learner had missed
            something. Absence of a prompt is not an absence to tell someone about.
          */}
          {detail.hasReflection ? (
            <SectionRow
              label={t.reflection}
              sub={t.reflectionSub}
              testId="training-detail-reflection"
              href={reflectionHref}
            />
          ) : null}

          {/*
            THE FOLLOW-UP DOORS, MOVED HERE FROM THE LIST — not removed with it.

            `canCheckInAgain` is about a SETTLED obligation, and the domain states that it belongs
            to My Learning; Today deliberately shows only PENDING ones. So this is the learner's
            only way back to a follow-up they answered NOT_YET and have since acted on. Taking it
            off the list made the list scannable; taking it out of the product would have stranded
            a loop that works.
          */}
          {onOpenFollowUp
            ? [
                ...(detail.openFollowUp ?? []).map((f) => ({ ...f, kind: "open" as const })),
                ...(detail.checkInAgain ?? []).map((f) => ({ ...f, kind: "again" as const })),
              ].map((f) => (
                <SectionRow
                  key={`${f.kind}:${f.followupId}`}
                  label={f.kind === "open" ? t.followUpOpen : t.followUpAgain}
                  sub={t.followUpAt(f.followUpDays)}
                  testId={f.kind === "open" ? "training-detail-open-follow-up" : "training-detail-check-in-again"}
                  onOpen={() => onOpenFollowUp(f.followupId)}
                />
              ))
            : null}

        </>
      ) : null}
    </section>
  );
}
