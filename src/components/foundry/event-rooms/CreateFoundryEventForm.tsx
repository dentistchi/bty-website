"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import { parseQuizCsv } from "@/domain/foundry/events/quickTrainingQuizCsv";
import type { Quiz, QuizSourceKind } from "@/domain/foundry/events/quickTrainingQuiz";
import {
  blankQuizDraft,
  draftFromQuiz,
  quizFromDraft,
  type QuizDraft,
} from "@/domain/foundry/events/quickTrainingQuizDraft";
import { QuizEditor } from "./QuizEditor";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";

/**
 * Quick Training create form.
 *
 * FIRST: what participants will DO — watch a video, read a document, or read a short text — in
 * plain language, never content-type jargon. Video keeps the original YouTube flow untouched.
 * Document collects a PDF and uploads it before creating. Text goes to the EXISTING
 * written-guidance runtime (`content_type: 'written_guidance'`); it is not a second text system.
 *
 * SECOND: whether there is a quiz, stated as two named choices rather than an optional box.
 * The choice changes what the learner is asked at the end, so it is asked, not implied:
 *
 *   No quiz   → the completion question stays, required, exactly as it always has been.
 *   Add quiz  → the completion question is HIDDEN and not sent. Submitting the quiz is the
 *               completion check, and the server stores no completion prompt for that training.
 *               `response_text` is never fabricated.
 *
 * THIRD, only with a quiz: how the questions are made — Manual, CSV, or generated from study
 * content. All three produce the same `QuizDraft` and land in the SAME editor, which is the
 * whole point: what a manager can fix must not depend on how the quiz arrived. Nothing is
 * published from the CSV or the model directly.
 *
 * System-fixed XP (no XP input). On success the parent routes straight into the control room.
 */
type Mode = "video" | "document" | "text";
type FieldError = null | "title" | "youtube" | "prompt" | "pdf" | "docPrompt" | "text" | "textPrompt" | "quiz";
type QuizMethod = "manual" | "csv" | "generated";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MATERIAL_TEXT_MAX = 2000;

export function CreateFoundryEventForm({
  locale,
  onCreated,
  onCancel,
}: {
  locale: Locale;
  onCreated: (snapshot: ManagerSnapshot) => void;
  onCancel: () => void;
}) {
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[locale];
  const [mode, setMode] = useState<Mode>("video");
  const [title, setTitle] = useState("");
  const [youtube, setYoutube] = useState("");
  const [prompt, setPrompt] = useState("");
  const [intro, setIntro] = useState("");
  const [docPrompt, setDocPrompt] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [materialText, setMaterialText] = useState("");
  const [textPrompt, setTextPrompt] = useState("");

  // --- Quiz authoring state ---
  const [quizOn, setQuizOn] = useState(false);
  const [quizMethod, setQuizMethod] = useState<QuizMethod>("manual");
  const [quizDraft, setQuizDraft] = useState<QuizDraft>(() => blankQuizDraft());
  /*
    PROVENANCE, NOT THE CURRENT TAB. `source_kind` records where the QUESTIONS came from, so it
    changes only when the draft is REPLACED — by a CSV import or by a generation — and never
    because the manager clicked a different method afterwards. A quiz an AI drafted stays
    `generated` however much the manager then edited it.
  */
  const [quizSource, setQuizSource] = useState<QuizSourceKind>("manual");
  const [quizMsg, setQuizMsg] = useState<string | null>(null);
  const [showQuizErrors, setShowQuizErrors] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [questionCount, setQuestionCount] = useState<5 | 10>(5);
  const [generating, setGenerating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<FieldError>(null);
  const [youtubeMsg, setYoutubeMsg] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [textMsg, setTextMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  /**
   * The quiz part of the create payload, or a refusal. Called first by every submit path, so an
   * incomplete quiz never triggers a PDF upload or a YouTube embed check.
   */
  const resolveQuizPayload = useCallback(():
    | { ok: true; body: Record<string, unknown> }
    | { ok: false } => {
    if (!quizOn) return { ok: true, body: {} };
    const built = quizFromDraft(quizDraft);
    if (!built.ok) {
      setShowQuizErrors(true);
      setQuizMsg(t.quizIncompleteError);
      setError("quiz");
      return { ok: false };
    }
    return { ok: true, body: { quiz: built.quiz, quiz_source: quizSource } };
  }, [quizOn, quizDraft, quizSource, t.quizIncompleteError]);

  /** The completion question, or nothing at all when the quiz is the completion check. */
  const completionBody = useCallback(
    (value: string) => (quizOn ? {} : { completion_prompt: value.trim() }),
    [quizOn],
  );

  const handleCreateFailure = useCallback((reason: string | undefined, fallback: FieldError) => {
    if (reason === "quiz_invalid" || reason === "quiz_insert_failed" || reason === "quiz_source_invalid") {
      setQuizMsg(t.quizIncompleteError);
      setError("quiz");
      return;
    }
    setError(fallback);
  }, [t.quizIncompleteError]);

  // --- Video (YouTube) submit — unchanged behavior apart from the quiz branch. ---
  const submitVideo = useCallback(async () => {
    if (title.trim().length < 1) return setError("title");
    if (youtube.trim().length < 1) {
      setYoutubeMsg(null);
      return setError("youtube");
    }
    if (!quizOn && prompt.trim().length < 1) return setError("prompt");
    const quiz = resolveQuizPayload();
    if (!quiz.ok) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bty/foundry/events", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          youtube_url: youtube.trim(),
          ...completionBody(prompt),
          ...quiz.body,
        }),
      });
      const data = await res.json().catch(() => null);
      const reason = data?.error as string | undefined;
      const ytMsg: Record<string, string> = {
        youtube_url_invalid: t.youtubeError,
        video_not_embeddable: t.youtubeNotEmbeddable,
        video_not_found: t.youtubeNotFound,
        youtube_check_failed: t.youtubeCheckFailed,
      };
      if (res.ok && data?.event) onCreated(data as ManagerSnapshot);
      else if (reason && reason in ytMsg) {
        setYoutubeMsg(ytMsg[reason]);
        setError("youtube");
      } else if (reason === "prompt_required" || reason === "prompt_too_long") setError("prompt");
      else handleCreateFailure(reason, "title");
    } catch {
      setError("title");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [title, youtube, prompt, quizOn, resolveQuizPayload, completionBody, handleCreateFailure, onCreated, t]);

  // --- Document (PDF) submit — read pages, upload, then create. ---
  const submitDocument = useCallback(async () => {
    if (title.trim().length < 1) return setError("title");
    if (!pdfFile) {
      setPdfMsg(t.pdfError);
      return setError("pdf");
    }
    if (pdfFile.size > MAX_PDF_BYTES) {
      setPdfMsg(t.pdfTooLargeError);
      return setError("pdf");
    }
    if (!quizOn && docPrompt.trim().length < 1) return setError("docPrompt");
    const quiz = resolveQuizPayload();
    if (!quiz.ok) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setProgressMsg(t.reading);
    try {
      // 1) Optional preliminary page-count read (UX hint only — the SERVER derives
      //    the canonical count from the bytes; this is never authoritative).
      let pageCountHint = 0;
      try {
        const buf = await pdfFile.arrayBuffer();
        const { pdfjs } = await import("react-pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        pageCountHint = doc.numPages;
        await doc.destroy();
      } catch {
        pageCountHint = 0; // server still verifies + derives; a bad local read is non-fatal
      }

      // 2) Upload the PDF; the server verifies the bytes and returns a signed ticket.
      const fd = new FormData();
      fd.append("file", pdfFile);
      if (pageCountHint > 0) fd.append("page_count_hint", String(pageCountHint));
      const upRes = await fetch("/api/bty/foundry/events/upload", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        body: fd,
      });
      const upData = await upRes.json().catch(() => null);
      if (!upRes.ok || !upData?.ticket) {
        setPdfMsg(
          upData?.error === "file_too_large"
            ? t.pdfTooLargeError
            : upData?.error === "file_not_pdf" || upData?.error === "page_count_unverifiable"
              ? t.pdfReadError
              : t.uploadFailedError,
        );
        setError("pdf");
        return;
      }

      // 3) Create the document event from the signed staging ticket.
      const res = await fetch("/api/bty/foundry/events", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content_type: "document",
          intro: intro.trim() || null,
          ...completionBody(docPrompt),
          staging_ticket: upData.ticket,
          ...quiz.body,
        }),
      });
      const data = await res.json().catch(() => null);
      const reason = data?.error as string | undefined;
      if (res.ok && data?.event) onCreated(data as ManagerSnapshot);
      else if (reason === "prompt_required" || reason === "prompt_too_long") setError("docPrompt");
      else if (
        reason === "ticket_invalid" ||
        reason === "ticket_expired" ||
        reason === "ticket_bad_signature" ||
        reason === "upload_invalid" ||
        reason === "page_count_invalid" ||
        reason === "page_count_too_large"
      ) {
        setPdfMsg(t.pdfReadError);
        setError("pdf");
      } else handleCreateFailure(reason, "title");
    } catch {
      setError("title");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setProgressMsg(null);
    }
  }, [title, pdfFile, docPrompt, intro, quizOn, resolveQuizPayload, completionBody, handleCreateFailure, onCreated, t]);

  // --- Text submit — the EXISTING written-guidance runtime, created from three fields. ---
  const submitText = useCallback(async () => {
    if (title.trim().length < 1) return setError("title");
    if (materialText.trim().length < 1) {
      setTextMsg(t.textError);
      return setError("text");
    }
    if (materialText.trim().length > MATERIAL_TEXT_MAX) {
      setTextMsg(t.textTooLongError);
      return setError("text");
    }
    if (!quizOn && textPrompt.trim().length < 1) return setError("textPrompt");
    const quiz = resolveQuizPayload();
    if (!quiz.ok) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bty/foundry/events", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content_type: "written_guidance",
          material_text: materialText.trim(),
          ...completionBody(textPrompt),
          ...quiz.body,
        }),
      });
      const data = await res.json().catch(() => null);
      const reason = data?.error as string | undefined;
      if (res.ok && data?.event) onCreated(data as ManagerSnapshot);
      else if (reason === "prompt_required" || reason === "prompt_too_long") setError("textPrompt");
      else if (reason === "material_text_required") {
        setTextMsg(t.textError);
        setError("text");
      } else if (reason === "material_text_too_long") {
        setTextMsg(t.textTooLongError);
        setError("text");
      } else handleCreateFailure(reason, "title");
    } catch {
      setError("title");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [title, materialText, textPrompt, quizOn, resolveQuizPayload, completionBody, handleCreateFailure, onCreated, t]);

  const onSubmit = useCallback(() => {
    if (submittingRef.current) return;
    if (mode === "document") void submitDocument();
    else if (mode === "text") void submitText();
    else void submitVideo();
  }, [mode, submitDocument, submitText, submitVideo]);

  /** CSV import POPULATES THE EDITOR. It never creates anything and never publishes. */
  const onCsvFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      void file.text().then((text) => {
        try {
          const parsed: Quiz = parseQuizCsv(text);
          setQuizDraft(draftFromQuiz(parsed));
          setQuizSource("csv");
          setShowQuizErrors(false);
          setQuizMsg(t.quizCsvLoaded(parsed.questions.length));
          if (error === "quiz") setError(null);
        } catch {
          setQuizMsg(t.quizCsvError);
        }
      });
    },
    [error, t],
  );

  /** Generation POPULATES THE EDITOR too — the manager reviews before anything is stored. */
  const onGenerate = useCallback(async () => {
    if (generating || sourceText.trim().length < 1) return;
    setGenerating(true);
    setQuizMsg(null);
    try {
      const res = await fetch("/api/bty/foundry/quiz/generate", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, questionCount, locale }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.quiz) {
        setQuizDraft(draftFromQuiz(data.quiz as Quiz));
        setQuizSource("generated");
        setShowQuizErrors(false);
        setQuizMsg(null);
        if (error === "quiz") setError(null);
        return;
      }
      const code = data?.code as string | undefined;
      if (code === "source_too_short") setQuizMsg(t.quizGenShortError(Number(data?.requiredChars ?? 0)));
      else if (code === "source_ungrounded") setQuizMsg(t.quizGenUngroundedError);
      else if (code === "timeout") setQuizMsg(t.quizGenTimeoutError);
      else if (code === "invalid_output") setQuizMsg(t.quizGenOutputError);
      else setQuizMsg(t.quizGenProviderError);
    } catch {
      setQuizMsg(t.quizGenProviderError);
    } finally {
      setGenerating(false);
    }
  }, [generating, sourceText, questionCount, locale, error, t]);

  const textField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    placeholder: string,
    key: Exclude<FieldError, null>,
    max: number,
    errorMsg: string,
    autoFocus = false,
  ) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-white/70">{label}</span>
      <input
        type="text"
        autoFocus={autoFocus}
        maxLength={max}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error === key) setError(null);
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error === key}
        className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
      />
      {error === key ? <span className="text-xs text-white/50">{errorMsg}</span> : null}
    </label>
  );

  const choiceButton = (selected: boolean, label: string, onClick: () => void, testId?: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testId}
      className={
        "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors " +
        (selected
          ? "border-[#C9A66B]/70 bg-[#C9A66B]/15 text-white"
          : "border-white/[0.12] bg-white/[0.03] text-white/60 hover:text-white/90")
      }
    >
      {label}
    </button>
  );

  const modeButton = (m: Mode, label: string, testId: string) =>
    choiceButton(
      mode === m,
      label,
      () => {
        setMode(m);
        setError(null);
      },
      testId,
    );

  return (
    <div className="btyFadeIn flex flex-col gap-6">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
        {t.createEyebrow}
      </span>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-white/70">{t.chooseActivity}</span>
        <div className="flex gap-3">
          {modeButton("video", t.activityVideo, "material-video")}
          {modeButton("document", t.activityDocument, "material-pdf")}
          {modeButton("text", t.activityText, "material-text")}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {textField(t.nameLabel, title, setTitle, t.namePlaceholder, "title", 80, t.titleError, true)}

        {/*
          KEYED ON THE MATERIAL. The three branches occupy the same position, and without a key
          React reconciles one material's input into the next one's — a file input becoming a
          controlled text input, which React warns about and which would carry the previous
          material's DOM state into the new one. The key makes a material switch a remount.
        */}
        <Fragment key={mode}>
        {mode === "video" ? (
          <>
            {textField(t.youtubeLabel, youtube, setYoutube, t.youtubePlaceholder, "youtube", 400, youtubeMsg ?? t.youtubeError)}
            {!quizOn
              ? textField(t.promptLabel, prompt, setPrompt, t.promptPlaceholder, "prompt", 300, t.promptError)
              : null}
          </>
        ) : mode === "document" ? (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/70">{t.pdfLabel}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  setPdfFile(e.target.files?.[0] ?? null);
                  setPdfMsg(null);
                  if (error === "pdf") setError(null);
                }}
                aria-label={t.pdfLabel}
                aria-invalid={error === "pdf"}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-[#C9A66B] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#0B1F3A]"
              />
              {pdfFile ? <span className="truncate text-xs text-white/50">{pdfFile.name}</span> : null}
              {error === "pdf" ? <span className="text-xs text-white/50">{pdfMsg ?? t.pdfError}</span> : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/70">{t.introLabel}</span>
              <textarea
                maxLength={600}
                rows={2}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder={t.introPlaceholder}
                aria-label={t.introLabel}
                className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
              />
            </label>

            {!quizOn
              ? textField(t.docPromptLabel, docPrompt, setDocPrompt, t.docPromptPlaceholder, "docPrompt", 300, t.promptError)
              : null}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/70">{t.textLabel}</span>
              <textarea
                maxLength={MATERIAL_TEXT_MAX}
                rows={7}
                value={materialText}
                onChange={(e) => {
                  setMaterialText(e.target.value);
                  setTextMsg(null);
                  if (error === "text") setError(null);
                }}
                placeholder={t.textPlaceholder}
                aria-label={t.textLabel}
                aria-invalid={error === "text"}
                data-testid="material-text-input"
                className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
              />
              {error === "text" ? <span className="text-xs text-white/50">{textMsg ?? t.textError}</span> : null}
            </label>

            {!quizOn
              ? textField(t.textPromptLabel, textPrompt, setTextPrompt, t.textPromptPlaceholder, "textPrompt", 300, t.promptError)
              : null}
          </>
        )}
        </Fragment>

        {/* ---- Quiz: is there one at all? ---- */}
        <div className="flex flex-col gap-2 rounded-xl border border-white/[0.1] p-4">
          <span className="text-sm font-medium text-white/80">{t.quizSectionLabel}</span>
          <div className="flex gap-3">
            {choiceButton(!quizOn, t.quizNone, () => {
              setQuizOn(false);
              setQuizMsg(null);
              setShowQuizErrors(false);
              if (error === "quiz") setError(null);
            }, "quiz-none")}
            {choiceButton(quizOn, t.quizAdd, () => {
              setQuizOn(true);
              setQuizMsg(null);
              if (error === "prompt" || error === "docPrompt" || error === "textPrompt") setError(null);
            }, "quiz-add")}
          </div>
          <p className="text-xs leading-5 text-white/50" data-testid="quiz-mode-note">
            {quizOn ? t.quizAddNote : t.quizNoneNote}
          </p>

          {quizOn ? (
            <div className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-white/70">{t.quizMethodLabel}</span>
                <div className="flex flex-wrap gap-2">
                  {choiceButton(quizMethod === "manual", t.quizMethodManual, () => setQuizMethod("manual"), "quiz-method-manual")}
                  {choiceButton(quizMethod === "csv", t.quizMethodCsv, () => setQuizMethod("csv"), "quiz-method-csv")}
                  {choiceButton(
                    quizMethod === "generated",
                    t.quizMethodGenerate,
                    () => setQuizMethod("generated"),
                    "quiz-method-generate",
                  )}
                </div>
              </div>

              {quizMethod === "csv" ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-white/70">{t.quizCsvLabel}</span>
                  <span className="text-xs text-white/45">{t.quizCsvHint}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label={t.quizCsvLabel}
                    data-testid="quiz-csv-input"
                    onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-[#C9A66B] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#0B1F3A]"
                  />
                </label>
              ) : null}

              {quizMethod === "generated" ? (
                <div className="flex flex-col gap-2">
                  {/*
                    THIS BOX IS SOURCE MATERIAL. It is what the employee should study — the only
                    text the questions may be built from — and never a quiz question itself.
                  */}
                  <span className="text-sm text-white/70">{t.quizSourceLabel}</span>
                  <span className="text-xs text-white/45" data-testid="quiz-source-note">
                    {t.quizSourceNote}
                  </span>
                  <textarea
                    rows={6}
                    maxLength={8000}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder={t.quizSourcePlaceholder}
                    aria-label={t.quizSourceLabel}
                    data-testid="quiz-source-input"
                    className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {choiceButton(questionCount === 5, t.quizCount(5), () => setQuestionCount(5))}
                    {choiceButton(questionCount === 10, t.quizCount(10), () => setQuestionCount(10))}
                    <button
                      type="button"
                      disabled={!sourceText.trim() || generating}
                      onClick={() => void onGenerate()}
                      data-testid="quiz-generate"
                      className="rounded-xl bg-[#C9A66B] px-4 py-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
                    >
                      {generating ? t.quizGenerating : t.quizGenerate}
                    </button>
                  </div>
                </div>
              ) : null}

              {quizMsg ? (
                <p className="text-xs text-white/60" data-testid="quiz-message">
                  {quizMsg}
                </p>
              ) : null}

              <QuizEditor
                draft={quizDraft}
                onChange={(next) => {
                  setQuizDraft(next);
                  if (error === "quiz") setError(null);
                }}
                t={t}
                showErrors={showQuizErrors}
              />
            </div>
          ) : null}
        </div>

        {progressMsg ? <span className="text-xs text-white/50">{progressMsg}</span> : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/[0.12] px-4 py-3.5 text-sm font-medium text-white/60 transition-colors hover:text-white/90"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-[#C9A66B] px-4 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
          >
            {submitting ? t.creating : t.create}
          </button>
        </div>
      </form>
    </div>
  );
}
