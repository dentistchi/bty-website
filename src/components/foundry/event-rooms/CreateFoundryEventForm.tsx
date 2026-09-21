"use client";

import { useCallback, useRef, useState } from "react";
import { parseQuizCsv } from "@/domain/foundry/events/quickTrainingQuizCsv";
import type { Quiz } from "@/domain/foundry/events/quickTrainingQuiz";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";

/**
 * Create form. First the host chooses what participants will do — "Watch a video"
 * or "Read a document" — in plain language (no content-type jargon). Video keeps
 * the original YouTube flow untouched. Document collects a PDF, an optional intro,
 * and one reflection question; on submit it reads the page count locally, uploads
 * the PDF to the private bucket, then creates the event. System-fixed XP (no XP
 * input). On success the parent routes straight into the control room.
 */
type Mode = "video" | "document";
type FieldError = null | "title" | "youtube" | "prompt" | "pdf" | "docPrompt";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

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
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<FieldError>(null);
  const [youtubeMsg, setYoutubeMsg] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // --- Video (YouTube) submit — unchanged behavior. ---
  const submitVideo = useCallback(async () => {
    if (title.trim().length < 1) return setError("title");
    if (youtube.trim().length < 1) {
      setYoutubeMsg(null);
      return setError("youtube");
    }
    if (prompt.trim().length < 1) return setError("prompt");

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
          completion_prompt: prompt.trim(), ...(quiz ? { quiz, quiz_source: "csv" } : {}),
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
      else setError("title");
    } catch {
      setError("title");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [title, youtube, prompt, onCreated, t]);

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
    if (docPrompt.trim().length < 1) return setError("docPrompt");

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
          completion_prompt: docPrompt.trim(),
          staging_ticket: upData.ticket, ...(quiz ? { quiz, quiz_source: "csv" } : {}),
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
      } else setError("title");
    } catch {
      setError("title");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setProgressMsg(null);
    }
  }, [title, pdfFile, docPrompt, intro, onCreated, t]);

  const onSubmit = useCallback(() => {
    if (submittingRef.current) return;
    if (mode === "document") void submitDocument();
    else void submitVideo();
  }, [mode, submitDocument, submitVideo]);

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

  const modeButton = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      aria-pressed={mode === m}
      className={
        "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors " +
        (mode === m
          ? "border-[#C9A66B]/70 bg-[#C9A66B]/15 text-white"
          : "border-white/[0.12] bg-white/[0.03] text-white/60 hover:text-white/90")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="btyFadeIn flex flex-col gap-6">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
        {t.createEyebrow}
      </span>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-white/70">{t.chooseActivity}</span>
        <div className="flex gap-3">
          {modeButton("video", t.activityVideo)}
          {modeButton("document", t.activityDocument)}
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

        {mode === "video" ? (
          <>
            {textField(t.youtubeLabel, youtube, setYoutube, t.youtubePlaceholder, "youtube", 400, youtubeMsg ?? t.youtubeError)}
            {textField(t.promptLabel, prompt, setPrompt, t.promptPlaceholder, "prompt", 300, t.promptError)}
          </>
        ) : (
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

            {textField(t.docPromptLabel, docPrompt, setDocPrompt, t.docPromptPlaceholder, "docPrompt", 300, t.promptError)}
          </>
        )}

        <label className="flex flex-col gap-2 rounded-xl border border-white/[0.1] p-4">
          <span className="text-sm font-medium text-white/80">퀴즈 추가 <span className="font-normal text-white/45">(선택)</span></span>
          <span className="text-xs text-white/50">퀴즈 파일 올리기 · question, option_a, option_b, option_c, option_d, correct_option, explanation</span>
          <input type="file" accept=".csv,text/csv" aria-label="퀴즈 파일 올리기" onChange={(e) => { const file=e.target.files?.[0]; if (!file) return; void file.text().then((text) => { try { setQuiz(parseQuizCsv(text)); setQuizError(null); } catch { setQuiz(null); setQuizError("CSV 형식을 확인해 주세요."); } }); }} className="text-sm text-white/70" />
          {quiz ? <div className="flex flex-col gap-2 text-xs text-white/65"><span>문제 검토 · {quiz.questions.length}문제</span>{quiz.questions.map((q) => <label key={q.id} className="flex flex-col gap-1"><input value={q.text} onChange={(e) => setQuiz((old) => old ? { ...old, questions: old.questions.map((x) => x.id === q.id ? { ...x, text: e.target.value } : x) } : old)} className="rounded border border-white/15 bg-white/[0.04] px-2 py-1 text-white" /></label>)}</div> : null}
          {quizError ? <span className="text-xs text-red-300">{quizError}</span> : null}
        </label>

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
