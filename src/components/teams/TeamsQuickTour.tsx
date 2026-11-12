"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export type TeamsTourStep = "learn" | "learning" | "today" | "saved" | "saved-list";

const copy = {
  en: {
    skip: "Skip tour",
    learn: {
      title: "Open Learn",
      body: "Today brings together what needs your attention. Tap Learn below to see where assigned training lives.",
      action: "Go to Learn",
    },
    learning: {
      title: "Find your assigned training",
      body: "When someone assigns you training, it appears under Required learning. Open an assignment from that list when you’re ready.",
      action: "Find saved messages",
    },
    today: {
      title: "Return to Today",
      body: "Tap Today below to find messages you’ve saved from Teams.",
      action: "Go to Today",
    },
    saved: {
      title: "Open your saved messages",
      body: "Tap Saved for later to open your list.",
      action: "Open saved list",
    },
    "saved-list": {
      title: "This is your saved list",
      body: "To add a message, open its … menu in Teams and choose Save under BTY. It will appear here.",
      action: "Finish tour",
    },
  },
  ko: {
    skip: "둘러보기 건너뛰기",
    learn: {
      title: "배우기 탭 열기",
      body: "오늘 탭에서 확인하거나 답할 일을 볼 수 있어요. 아래 배우기 탭을 눌러 배정된 교육이 있는 곳을 확인해 보세요.",
      action: "배우기로 이동",
    },
    learning: {
      title: "배정된 교육 찾기",
      body: "교육을 배정받으면 필수 학습 목록에 표시됩니다. 준비가 되면 목록에서 교육을 열 수 있어요.",
      action: "저장한 메시지 찾기",
    },
    today: {
      title: "오늘 탭으로 돌아가기",
      body: "아래 오늘 탭을 눌러 Teams에서 저장한 메시지를 찾아보세요.",
      action: "오늘로 이동",
    },
    saved: {
      title: "저장한 메시지 열기",
      body: "나중에 보기를 눌러 저장 목록을 열어보세요.",
      action: "저장 목록 열기",
    },
    "saved-list": {
      title: "여기가 내 저장 목록입니다",
      body: "Teams에서 메시지의 … 메뉴를 열고 BTY의 저장을 선택하면 이 목록에 추가됩니다.",
      action: "둘러보기 완료",
    },
  },
} as const;

const targets: Record<TeamsTourStep, readonly string[]> = {
  learn: ['[data-bty-tab="learn"]'],
  learning: ['[data-testid="foundry-required-learning"] h2', '[data-testid="learn-header"]'],
  today: ['[data-bty-tab="today"]'],
  saved: ['[data-testid="today-saved-entry"]'],
  "saved-list": ['[data-testid="saved-view"] h2'],
};

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
}: {
  locale: "en" | "ko";
  step: TeamsTourStep;
  shell: RefObject<HTMLDivElement | null>;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const t = copy[locale];
  const headingId = useId();
  const bodyId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const activeTarget = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState<TourLayout | null>(null);

  useEffect(() => {
    const root = shell.current;
    const callout = panel.current;
    if (!root || !callout) return;

    let frame = 0;
    let anchor: HTMLElement | null = null;
    let revealAfterContentChange = false;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);

    function measure() {
      const next = targets[step]
        .map((selector) => root?.querySelector<HTMLElement>(selector))
        .find(Boolean) ?? null;
      const reveal = next !== anchor || revealAfterContentChange;
      revealAfterContentChange = false;
      if (next !== anchor) {
        if (anchor) resize?.unobserve(anchor);
        anchor = next;
        activeTarget.current = anchor;
        if (anchor) resize?.observe(anchor);
      }
      if (!anchor || !callout) {
        setLayout(null);
        return;
      }
      if (reveal) anchor.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });

      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const right = viewportLeft + viewportWidth;
      const bottom = viewportTop + viewportHeight;
      const width = Math.min(PANEL_WIDTH, Math.max(1, viewportWidth - EDGE * 2));
      const center = rect.left + rect.width / 2;
      const left = clamp(center - width / 2, viewportLeft + EDGE, right - width - EDGE);
      const scrollBounds = anchor.closest("main")?.getBoundingClientRect();
      const clipTop = clamp(scrollBounds?.top ?? viewportTop, viewportTop, bottom);
      const clipBottom = clamp(scrollBounds?.bottom ?? bottom, clipTop, bottom);
      const targetTop = clamp(rect.top, clipTop, clipBottom);
      const targetBottom = clamp(rect.bottom, clipTop, clipBottom);
      const targetVisible = targetBottom > targetTop && rect.width > 0;
      const above = targetTop - viewportTop - GAP - EDGE;
      const below = bottom - targetBottom - GAP - EDGE;
      const panelHeight = callout.scrollHeight;
      const preferAbove = step === "learn" || step === "today" || step === "saved";
      const placeAbove = preferAbove
        ? above >= panelHeight || above > below
        : below < panelHeight && above > below;
      const edge = placeAbove ? targetTop - GAP : targetBottom + GAP;
      const vertical = placeAbove ? { bottom: window.innerHeight - edge } : { top: edge };
      setLayout({
        anchor: targetVisible
          ? { top: targetTop - 4, left: rect.left - 4, width: rect.width + 8, height: targetBottom - targetTop + 8 }
          : null,
        panel: { left, width, maxHeight: Math.max(1, placeAbove ? above : below), ...vertical },
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
    const tracksAsyncContent = step === "learning" || step === "saved";
    const mutations = tracksAsyncContent && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
        // Loading Today or Learn can insert content above the target without resizing it.
        revealAfterContentChange = true;
        schedule();
      })
      : null;
    mutations?.observe(root.querySelector("main") ?? root, { childList: true, subtree: true });
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

  const message = t[step];
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" data-bty-tour-step={step}>
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
          <h2 ref={heading} tabIndex={-1} id={headingId} className="text-base font-semibold focus:outline-none">
            {message.title}
          </h2>
          <p id={bodyId} className="text-sm leading-5 text-white/85">{message.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={step === "saved-list" ? dismiss : onAction}
            className="min-h-10 rounded-lg bg-[#E3BA74] px-3 py-2 text-sm font-semibold text-[#0B1F3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {message.action}
          </button>
          {step !== "saved-list" && (
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
