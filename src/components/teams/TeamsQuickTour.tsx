"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { tourCopy, type TeamsTourStep } from "./teamsTourSteps";

const copy = {
  en: {
    chapters: { today: "Today", learn: "Learn", practice: "Practice", me: "Me" },
    skip: "Exit tour", continue: "Continue", resumeTitle: "Continue your BTY tour",
    resumeBody: "Return to this chapter’s main screen to continue.", resume: "Return to chapter",
  },
  ko: {
    chapters: { today: "오늘", learn: "배우기", practice: "연습", me: "나" },
    skip: "둘러보기 종료", continue: "계속", resumeTitle: "BTY 둘러보기 이어가기",
    resumeBody: "이 탭의 첫 화면으로 돌아가 둘러보기를 이어갈 수 있어요.", resume: "첫 화면으로 돌아가기",
  },
} as const;

type Highlight = { top: number; left: number; width: number; height: number };

export function TeamsQuickTour({
  locale,
  step,
  shell,
  onAction,
  onDismiss,
  onChapter,
}: {
  locale: "en" | "ko";
  step: TeamsTourStep;
  shell: RefObject<HTMLDivElement | null>;
  onAction: () => void;
  onDismiss: () => void;
  onChapter: (chapter: TeamsTourStep["chapter"]) => void;
}) {
  const t = copy[locale];
  const headingId = useId();
  const bodyId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const activeTarget = useRef<HTMLElement | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [canUseTarget, setCanUseTarget] = useState(false);
  const [inScope, setInScope] = useState(true);

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step.id]);

  useLayoutEffect(() => {
    const root = shell.current;
    const main = root?.querySelector("main");
    if (!root || !main) return;
    const appRoot = root;
    const scrollArea = main;

    let frame = 0;
    let revealPending = true;
    let revealAttempts = 0;
    let anchor: HTMLElement | null = null;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);

    function measure() {
      const scope = appRoot.querySelector(step.scope);
      setInScope(Boolean(scope));
      const control = step.click ? appRoot.querySelector<HTMLButtonElement>(step.click) : null;
      setCanUseTarget(Boolean(scope && control && !control.disabled));
      const next = scope
        ? step.anchors.map((selector) => appRoot.querySelector<HTMLElement>(selector)).find(Boolean) ?? null
        : null;

      if (next !== anchor) {
        if (anchor) resize?.unobserve(anchor);
        anchor = next;
        revealAttempts = 0;
        revealPending = true;
        activeTarget.current = anchor;
        if (anchor) resize?.observe(anchor);
      }

      if (!anchor) {
        setHighlight(null);
        return;
      }

      const isInMain = scrollArea.contains(anchor);
      const area = isInMain ? scrollArea.getBoundingClientRect() : appRoot.getBoundingClientRect();
      let target = anchor.getBoundingClientRect();
      if (revealPending && target.height > 0 && area.height > 0) {
        const clipped = target.top < area.top || target.bottom > area.bottom;
        if (isInMain && clipped && revealAttempts < 2) {
          revealAttempts += 1;
          scrollArea.scrollTo?.({
            top: scrollArea.scrollTop + target.top - area.top - 12,
            behavior: "instant",
          });
          target = anchor.getBoundingClientRect();
          if (revealAttempts < 2) {
            schedule();
          }
        }
        revealPending = clipped && revealAttempts === 1;
      }

      const top = Math.max(area.top, target.top - 3);
      const bottom = Math.min(area.bottom, target.bottom + 3);
      const left = Math.max(area.left, target.left - 3);
      const right = Math.min(area.right, target.right + 3);
      const ring = target.width > 0 && target.height > 0 && bottom > top && right > left
        ? { top, left, width: right - left, height: bottom - top }
        : null;
      setHighlight((previous) => previous?.top === ring?.top && previous?.left === ring?.left &&
        previous?.width === ring?.width && previous?.height === ring?.height ? previous : ring);
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    }

    measure();
    schedule();
    resize?.observe(scrollArea);
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      // Allow a delayed replacement to enter view once. Manual scrolling never re-arms reveal.
      if (revealAttempts < 2) revealPending = true;
      schedule();
    });
    mutations?.observe(scrollArea, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    window.addEventListener("resize", schedule);
    scrollArea.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", schedule);
      scrollArea.removeEventListener("scroll", schedule, true);
    };
  }, [shell, step]);

  const dismiss = useCallback(() => {
    const target = activeTarget.current;
    if (target?.matches("button, a[href]")) target.focus({ preventScroll: true });
    else shell.current?.querySelector<HTMLElement>('[data-bty-tab][aria-current="page"]')?.focus({ preventScroll: true });
    onDismiss();
  }, [onDismiss, shell]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      dismiss();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [dismiss]);

  const message = tourCopy(step, locale);
  const optionalControlUnavailable = (step.skipDestination || step.optionalClick) && !canUseTarget;
  const action = !inScope ? t.resume : optionalControlUnavailable ? t.continue : message.action;
  const performAction = !inScope ? () => onChapter(step.chapter) : step.id === "finish" ? dismiss : onAction;

  return (
    <>
      {highlight && createPortal(
        <div
          aria-hidden
          data-bty-tour-highlight=""
          className="pointer-events-none fixed z-[60] rounded-xl border-2 border-[#E3BA74]"
          style={highlight}
        />,
        document.body,
      )}
      <section
        role="dialog"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        data-bty-tour-step={step.id}
        className="mx-auto flex h-[min(12.5rem,44dvh)] w-full max-w-xl shrink-0 flex-col gap-1.5 overflow-hidden rounded-t-xl border border-[#C9A66B]/55 bg-[#152A44] px-4 py-2 text-white"
      >
        <nav aria-label={locale === "ko" ? "둘러보기 목차" : "Tour chapters"} className="flex shrink-0 gap-4 text-xs">
          {(Object.keys(t.chapters) as TeamsTourStep["chapter"][]).map((chapter) => (
            <button
              key={chapter}
              type="button"
              aria-current={chapter === step.chapter ? "step" : undefined}
              disabled={chapter === step.chapter}
              className="min-h-8 font-medium text-white/75 hover:text-white disabled:font-semibold disabled:text-[#E3BA74]"
              onClick={() => onChapter(chapter)}
            >
              {t.chapters[chapter]}
            </button>
          ))}
        </nav>
        <div ref={body} className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
          <h2 ref={heading} tabIndex={-1} id={headingId} className="text-base font-semibold focus:outline-none">
            {inScope ? message.title : t.resumeTitle}
          </h2>
          <p id={bodyId} className="text-sm leading-5 text-white/85">{inScope ? message.body : t.resumeBody}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3">
          <button
            type="button"
            onClick={performAction}
            className="min-h-10 rounded-lg bg-[#E3BA74] px-3 py-1.5 text-sm font-semibold text-[#0B1F3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {action}
          </button>
          {step.id !== "finish" && (
            <button type="button" onClick={dismiss} className="min-h-10 rounded-lg px-2 py-1.5 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              {t.skip}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
