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
  next: string;
};

export function PdfReader({
  fileUrl,
  initialPage,
  onHeartbeat,
  copy,
}: {
  fileUrl: string;
  initialPage: number;
  onHeartbeat: (beat: ReadingHeartbeat) => void;
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
  const goNext = useCallback(() => setPage((p) => Math.min(numPages || p, p + 1)), []);

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
        <button
          type="button"
          onClick={goNext}
          disabled={numPages > 0 && page >= numPages}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {copy.next}
        </button>
      </div>
    </div>
  );
}
