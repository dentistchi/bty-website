"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { tourCopy, type TeamsTourStep } from "./teamsTourSteps";

const copy = {
  en: {
    chapters: { today: "Today", learn: "Learn", practice: "Practice", me: "Me" },
    skip: "Exit tour", continue: "Continue", resumeTitle: "Continue your BTY tour",
    resumeBody: "Return to the chapter’s main screen to continue, or choose another tab above.", resume: "Return to chapter",
  },
  ko: {
    chapters: { today: "오늘", learn: "배우기", practice: "연습", me: "나" },
    skip: "둘러보기 종료", continue: "계속", resumeTitle: "BTY 둘러보기 이어가기",
    resumeBody: "이 탭의 첫 화면으로 돌아가 계속하거나, 위에서 다른 탭을 선택하세요.", resume: "첫 화면으로 돌아가기",
  },
} as const;

const EDGE = 12;
const GAP = 16;
const PANEL_WIDTH = 344;

type TourLayout = {
  anchor: { top: number; left: number; width: number; height: number } | null;
  panel: { left: number; width: number; maxHeight: number; top?: number; bottom?: number };
  arrow: { left: number; top: number } | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

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
  const panel = useRef<HTMLElement>(null);
  const activeTarget = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const [canUseTarget, setCanUseTarget] = useState(false);
  const [inScope, setInScope] = useState(true);

  useEffect(() => {
    const root = shell.current;
    const callout = panel.current;
    if (!root || !callout) return;

    let frame = 0;
    let anchor: HTMLElement | null = null;
    let revealAfterContentChange = false;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);

    function measure() {
      const scope = root?.querySelector(step.scope);
      setInScope(Boolean(scope));
      const next = scope ? step.anchors
        .map((selector) => root?.querySelector<HTMLElement>(selector))
        .find(Boolean) ?? null : null;
      const control = step.click ? root?.querySelector<HTMLButtonElement>(step.click) : null;
      setCanUseTarget(Boolean(control && !control.disabled));
      const reveal = next !== anchor || revealAfterContentChange;
      revealAfterContentChange = false;
      if (next !== anchor) {
        if (anchor) resize?.unobserve(anchor);
        anchor = next;
        activeTarget.current = anchor;
        if (anchor) resize?.observe(anchor);
      }
      if (!callout) return;
      if (reveal) anchor?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });

      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const width = Math.min(PANEL_WIDTH, Math.max(1, viewportWidth - EDGE * 2));
      const rect = anchor?.getBoundingClientRect();
      if (!rect) {
        setLayout({
          anchor: null,
          arrow: null,
          panel: {
            left: viewportLeft + (viewportWidth - width) / 2,
            top: viewportTop + EDGE,
            width,
            maxHeight: Math.max(1, viewportHeight - EDGE * 2),
          },
        });
        return;
      }
      const right = viewportLeft + viewportWidth;
      const bottom = viewportTop + viewportHeight;
      const center = rect.left + rect.width / 2;
      const left = clamp(center - width / 2, viewportLeft + EDGE, right - width - EDGE);
      const scrollBounds = anchor?.closest("main")?.getBoundingClientRect();
      const clipTop = clamp(scrollBounds?.top ?? viewportTop, viewportTop, bottom);
      const clipBottom = clamp(scrollBounds?.bottom ?? bottom, clipTop, bottom);
      const targetTop = clamp(rect.top, clipTop, clipBottom);
      const targetBottom = clamp(rect.bottom, clipTop, clipBottom);
      const targetVisible = targetBottom > targetTop && rect.width > 0;
      const above = targetTop - viewportTop - GAP - EDGE;
      const below = bottom - targetBottom - GAP - EDGE;
      const panelHeight = callout.scrollHeight;
      const preferAbove = Boolean(step.tab);
      const placeAbove = preferAbove
        ? above >= panelHeight || above > below
        : below < panelHeight && above > below;
      const available = placeAbove ? above : below;
      if (reveal && targetVisible && scrollBounds && available < Math.min(144, panelHeight) &&
        rect.height < viewportHeight * 0.55) {
        anchor?.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "instant" });
        schedule();
        return;
      }
      const edge = placeAbove ? targetTop - GAP : targetBottom + GAP;
      const vertical = placeAbove ? { bottom: window.innerHeight - edge } : { top: edge };
      setLayout({
        anchor: targetVisible
          ? { top: targetTop - 4, left: rect.left - 4, width: rect.width + 8, height: targetBottom - targetTop + 8 }
          : null,
        panel: { left, width, maxHeight: Math.max(1, available), ...vertical },
        arrow: targetVisible
          ? { left: clamp(center, left + 20, left + width - 20) - 5, top: edge - 5 }
          : null,
      });
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }

    measure();
    resize?.observe(root);
    resize?.observe(callout);
    const mutations = typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
        // Async content can move the target without resizing it.
        revealAfterContentChange = true;
        schedule();
      })
      : null;
    mutations?.observe(root.querySelector("main") ?? root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    const viewport = window.visualViewport;
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [shell, step]);

  const ready = layout !== null;
  useLayoutEffect(() => {
    if (ready) heading.current?.focus({ preventScroll: true });
  }, [ready]);

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
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" data-bty-tour-step={step.id}>
      {layout?.anchor && (
        <div aria-hidden className="fixed rounded-xl border-2 border-[#E3BA74] shadow-[0_0_0_9999px_rgba(3,10,21,0.58)]" style={layout.anchor} />
      )}
      {layout?.arrow && (
        <div aria-hidden className="fixed h-2.5 w-2.5 rotate-45 border border-[#C9A66B]/60 bg-[#152A44]" style={layout.arrow} />
      )}
      <section
        ref={panel}
        role="dialog"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        className="pointer-events-auto fixed space-y-3 overflow-y-auto rounded-2xl border border-[#C9A66B]/60 bg-[#152A44] p-4 text-white shadow-2xl"
        style={layout ? layout.panel : { visibility: "hidden", width: PANEL_WIDTH }}
      >
        <div className="space-y-1.5">
          <nav aria-label={locale === "ko" ? "둘러보기 목차" : "Tour chapters"} className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {(Object.keys(t.chapters) as TeamsTourStep["chapter"][]).map((chapter) => (
              <button
                key={chapter}
                type="button"
                aria-current={chapter === step.chapter ? "step" : undefined}
                className={chapter === step.chapter ? "min-h-7 font-semibold text-[#E3BA74]" : "min-h-7 text-white/70 hover:text-white"}
                onClick={() => onChapter(chapter)}
              >
                {t.chapters[chapter]}
              </button>
            ))}
          </nav>
          <h2 ref={heading} tabIndex={-1} id={headingId} className="text-base font-semibold focus:outline-none">
            {inScope ? message.title : t.resumeTitle}
          </h2>
          <p id={bodyId} className="text-sm leading-5 text-white/85">{inScope ? message.body : t.resumeBody}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={!inScope ? () => onChapter(step.chapter) : step.id === "finish" ? dismiss : onAction}
            className="min-h-10 rounded-lg bg-[#E3BA74] px-3 py-2 text-sm font-semibold text-[#0B1F3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {!inScope ? t.resume : (step.skipDestination || step.optionalClick) && !canUseTarget ? t.continue : message.action}
          </button>
          {step.id !== "finish" && (
            <button type="button" onClick={dismiss} className="min-h-10 rounded-lg px-2 py-2 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              {t.skip}
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
