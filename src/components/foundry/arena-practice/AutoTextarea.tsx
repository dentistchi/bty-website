"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * Content-sized textarea for the Practice authoring surfaces (Slice 3.2I-R5B2-R3).
 *
 * Founder device evidence: on iPhone the scenario title's second line, and the last lines of the
 * opening situation and the escalation, were cut off by the field's lower border.
 *
 * The cause was that every field was a plain `<textarea rows={n}>`. `rows` is a FIXED height, so
 * anything longer simply overflowed — and because the default `overflow-y: auto` produces no
 * visible scrollbar on iOS, the overflow read as truncation. The title was the worst case at
 * `rows={1}`: a title is allowed 120 characters and wraps at any realistic length, so its second
 * line was clipped essentially always. Nothing was concealing the text on purpose; nothing was
 * sizing to it either.
 *
 * This grows the field to its content instead. `rows` survives as the MINIMUM: with `height: auto`
 * the browser lays the box out from `rows`, so `scrollHeight` is never smaller than that and a
 * short field keeps a comfortable size.
 *
 * Deliberately NOT `overflow-hidden`. Hiding the overflow would make a mis-measurement look like
 * correct output — exactly the failure being fixed. With the height tracking the content there is
 * nothing to scroll, and if that ever stops being true the scrollbar is the honest signal.
 */

/** Run before paint in the browser; fall back on the server, where there is no layout to read. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Size one textarea to its content. Pure DOM, idempotent, safe to call on every keystroke.
 *
 * Two things here are load-bearing, and a WebKit measurement at 390px proved the second one:
 *
 * 1. The reset to `auto` is required, not cosmetic. `scrollHeight` never reports less than the
 *    element's current height, so without it a field that lost text could only ever grow.
 *
 * 2. `scrollHeight` measures the PADDING box — it excludes the border. Tailwind's preflight sets
 *    `box-sizing: border-box` globally, so `height` sets the BORDER box. Assigning `scrollHeight`
 *    straight into `height` therefore lands the field short by exactly its top+bottom border:
 *    measured `scrollHeight 48 / clientHeight 46` on a one-line field with a 1px border. Two
 *    pixels is enough to shave the descenders off the last line, and on a marginal wrap it costs
 *    the whole line — which is what the Founder was looking at.
 */
export function applyAutoHeight(el: HTMLTextAreaElement | null | undefined): void {
  if (!el) return;
  el.style.height = "auto";
  const next = el.scrollHeight;
  // jsdom reports 0 for every measurement; leaving the height unset there is more honest than
  // writing a fabricated 0px that would collapse the field in a test environment.
  if (next <= 0) return;

  let border = 0;
  if (typeof getComputedStyle === "function") {
    const cs = getComputedStyle(el);
    if (cs.boxSizing === "border-box") {
      border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    }
  }
  el.style.height = `${next + border}px`;
}

export type AutoTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "rows"> & {
  value: string;
  /** Minimum height, in rows. The field never renders shorter than this. */
  rows: number;
  onChange: (value: string) => void;
};

export function AutoTextarea({ value, rows, onChange, className = "", ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Size for the SERVER-RETURNED value too, before the first paint — the reported defect was
  // visible on a saved scenario the Host had not typed into at all.
  useIsomorphicLayoutEffect(() => {
    applyAutoHeight(ref.current);
  }, [value]);

  // Width and font-metric changes re-wrap the text, which changes the required height: rotation,
  // a dynamic-type change, or the field appearing at a different width.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    let lastWidth = el.getBoundingClientRect().width;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? lastWidth;
      // Only WIDTH matters. Reacting to height would re-enter this observer with the height this
      // very callback just wrote — the classic ResizeObserver loop.
      if (width === lastWidth) return;
      lastWidth = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyAutoHeight(el));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Size first, then report: the caret stays where the user put it, and the field never shows
      // a frame at the wrong height.
      applyAutoHeight(e.currentTarget);
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      onChange={handleChange}
      // `resize-none` removes the desktop drag handle, which would fight the measured height.
      // It does not hide anything: the height always follows the content.
      className={`resize-none ${className}`}
      {...rest}
    />
  );
}
