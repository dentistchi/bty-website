"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

/**
 * Foundry PDF Study Room — in-app reader.
 *
 * Renders the PDF inside the BTY room (never navigates the participant to a raw
 * storage url). Page navigation + indicator, mobile fit-to-width scaling, resume
 * from the last saved page. It tracks HONEST engagement — active reading time is
 * accumulated only while the tab is visible — and reports batched heartbeats to
 * the parent (which persists them server-side). The reader never decides
 * completion; the server does. Text/annotation layers are disabled: a study room
 * needs a clean, fast page render, not selection/links.
 */

// Self-hosted worker (copied to /public by scripts/copy-pdf-worker.mjs), version
// matched to the installed pdfjs-dist — no external CDN, CSP-safe.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// pdfjs 5 relies on Promise.withResolvers; polyfill for older iOS Safari (<17.4).
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== "function") {
  (Promise as unknown as { withResolvers: () => unknown }).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

const HEARTBEAT_MS = 10_000;

export type ReadingHeartbeat = {
  lastPage: number;
  viewedPages: number[];
  activeMsDelta: number;
};

export type PdfReaderCopy = {
  loading: string;
  unavailable: string;
  unavailableHint: string;
  pageOf: (page: number, total: number) => string;
  prev: string;
  /** Non-final page: advance to the next PDF page. */
  nextPage: string;
  /** Final page, once the server-gated reading requirement is met. */
  continueToReflection: string;
};

export function PdfReader({
  fileUrl,
  initialPage,
  onHeartbeat,
  readingComplete,
  onContinue,
  copy,
}: {
  fileUrl: string;
  initialPage: number;
  onHeartbeat: (beat: ReadingHeartbeat) => void;
  /** Server-authoritative: the reading requirement is met (reflection is unlocked). */
  readingComplete: boolean;
  /** Move on from the reader to the reflection step (parent scrolls it into view). */
  onContinue: () => void;
  copy: PdfReaderCopy;
}) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(Math.max(1, initialPage || 1));
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(360);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Engagement accumulators (persist across renders, reset per heartbeat).
  const viewedAllRef = useRef<Set<number>>(new Set());
  const pendingPagesRef = useRef<Set<number>>(new Set());
  const activeMsRef = useRef(0);
  const lastPageRef = useRef(page);

  const options = useMemo(() => ({}), []);

  // Fit the page to the container width (mobile-first, no horizontal overflow).
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      if (w > 0) setWidth(Math.min(w, 900));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Mark a page as viewed (both the cumulative set and the pending-beat set).
  const markViewed = useCallback((p: number) => {
    if (p < 1) return;
    viewedAllRef.current.add(p);
    pendingPagesRef.current.add(p);
    lastPageRef.current = p;
  }, []);

  useEffect(() => {
    markViewed(page);
  }, [page, markViewed]);

  const flush = useCallback(() => {
    const pending = Array.from(pendingPagesRef.current);
    const activeMsDelta = activeMsRef.current;
    if (pending.length === 0 && activeMsDelta === 0) return;
    pendingPagesRef.current = new Set();
    activeMsRef.current = 0;
    onHeartbeat({ lastPage: lastPageRef.current, viewedPages: pending, activeMsDelta });
  }, [onHeartbeat]);

  // Active-time ticker (1s): count time ONLY while the tab is visible.
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        activeMsRef.current += 1000;
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Batched heartbeat + a final flush on unmount / tab hide.
  useEffect(() => {
    const beat = window.setInterval(flush, HEARTBEAT_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  // IMPORTANT: `numPages` MUST be a dependency. With an empty dep array this closure
  // captured numPages=0 from the first render (before the PDF loaded), so
  // `numPages || p` collapsed to `p` and Next never advanced — the participant was
  // stuck on 1/2 even though the button looked enabled (its disabled check reads the
  // fresh render-scope numPages). Recreate on load so the clamp uses the real total.
  const goNext = useCallback(
    () => setPage((p) => (numPages > 0 ? Math.min(numPages, p + 1) : p)),
    [numPages],
  );

  if (failed) {
    return (
      <div className="rounded-2xl bg-white/5 px-5 py-8 text-center">
        <p className="text-sm font-medium text-white">{copy.unavailable}</p>
        <p className="mt-2 text-xs text-white/60">{copy.unavailableHint}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="overflow-x-auto rounded-2xl bg-white">
        <Document
          file={fileUrl}
          options={options}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            setPage((p) => Math.min(Math.max(1, p), n));
          }}
          onLoadError={() => setFailed(true)}
          onSourceError={() => setFailed(true)}
          loading={
            <div className="flex h-64 items-center justify-center text-sm text-[#0B1F3A]/60">
              {copy.loading}
            </div>
          }
          error={
            <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-[#0B1F3A]/70">
              {copy.unavailable}
            </div>
          }
        >
          <Page
            pageNumber={page}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={
              <div className="flex h-64 items-center justify-center text-sm text-[#0B1F3A]/50">
                {copy.loading}
              </div>
            }
          />
        </Document>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={page <= 1}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {copy.prev}
        </button>
        <span className="text-xs tabular-nums text-white/70">{copy.pageOf(page, numPages || 1)}</span>
        {(() => {
          const loading = numPages === 0;
          const isLastPage = numPages > 0 && page >= numPages;
          // On the last page the control becomes "Continue to reflection" ONLY when
          // the server has confirmed the reading requirement (readingComplete). Until
          // then it is a visibly-disabled "Next page" (never an enabled no-op tap).
          const canContinue = isLastPage && readingComplete;
          const label = canContinue ? copy.continueToReflection : copy.nextPage;
          const disabled = loading || (isLastPage && !canContinue);
          return (
            <button
              type="button"
              onClick={canContinue ? onContinue : goNext}
              disabled={disabled}
              style={{ touchAction: "manipulation" }}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {label}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
