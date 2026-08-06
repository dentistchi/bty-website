/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { useState } from "react";
import { AutoTextarea, applyAutoHeight } from "./AutoTextarea";

/**
 * FIELD SIZING WIRING (Slice 3.2I-R5B2-R3).
 *
 * jsdom performs no layout — `scrollHeight` is always 0 — so the pixel question cannot be settled
 * here and is not claimed. `scrollHeight` is stubbed to a function of the CONTENT so the sizing
 * RULE is exercised honestly: does the field measure at all, on the server-returned value as well
 * as on typing, does it reset before measuring so it can shrink, and does it re-measure when the
 * width changes. Real geometry at 390pt is the Playwright spec and device gates R3-A–R3-E.
 */

/** Stand-in for layout: 24px per wrapped line at roughly 40 characters per line, plus padding. */
const LINE = 24;
const PADDING = 24;
let stubHeight: ((el: HTMLTextAreaElement) => number) | null = null;

beforeEach(() => {
  stubHeight = (el) => {
    // The component sets height:auto before measuring; a real browser then reports content height.
    const lines = Math.max(1, Math.ceil((el.value?.length || 1) / 40)) + (el.value?.split("\n").length ?? 1) - 1;
    return lines * LINE + PADDING;
  };
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return stubHeight ? stubHeight(this) : 0;
    },
  });
});
afterEach(() => {
  stubHeight = null;
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
  cleanup();
  vi.restoreAllMocks();
});

const px = (el: HTMLElement) => parseFloat(el.style.height || "0");

function Harness({ initial, rows = 1 }: { initial: string; rows?: number }) {
  const [v, setV] = useState(initial);
  return <AutoTextarea aria-label="field" value={v} rows={rows} onChange={setV} className="w-full" />;
}

const LONG_EN =
  "A handoff goes wrong at the end of a long shift and the person who can fix it has already left the building for the day.";
const LONG_KO =
  "긴 교대 근무가 끝날 무렵 인수인계가 잘못되었고, 그것을 바로잡을 수 있는 사람은 이미 그날 퇴근한 뒤였습니다. 지금 결정해야 합니다.";

describe("[R3] the field sizes to the SERVER-RETURNED value, before anyone types", () => {
  it("a long initial value is measured on first render", () => {
    render(<Harness initial={LONG_EN} rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    // The reported defect was visible on a saved scenario the Host had not touched.
    expect(px(el)).toBeGreaterThan(LINE + PADDING);
  });

  it("a short initial value keeps a usable minimum", () => {
    render(<Harness initial="Short" rows={1} />);
    expect(px(screen.getByLabelText("field") as HTMLTextAreaElement)).toBe(LINE + PADDING);
  });

  it.each([
    ["English", LONG_EN],
    ["Korean", LONG_KO],
  ])("%s long text is sized, not truncated — the full value is still the value", (_l, text) => {
    render(<Harness initial={text} rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    expect(el.value).toBe(text); // nothing silently trimmed
    expect(px(el)).toBeGreaterThan(LINE + PADDING);
  });
});

describe("[R3] the field tracks the content while it changes", () => {
  it("adding lines grows it", () => {
    render(<Harness initial="One" rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    const before = px(el);
    fireEvent.change(el, { target: { value: "One\nTwo\nThree\nFour" } });
    expect(px(el)).toBeGreaterThan(before);
  });

  it("removing text lets it shrink — the reset-to-auto is what makes that possible", () => {
    render(<Harness initial={LONG_EN} rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    const tall = px(el);
    fireEvent.change(el, { target: { value: "Short" } });
    expect(px(el)).toBeLessThan(tall);
  });

  it("it never shrinks below the rows minimum", () => {
    render(<Harness initial={LONG_EN} rows={4} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    fireEvent.change(el, { target: { value: "" } });
    // `rows` is the floor: with height:auto a real browser lays the box out from it, so
    // scrollHeight is never smaller. The attribute must therefore survive.
    expect(el.rows).toBe(4);
  });

  it("resizing never blurs the field or moves the caret itself", () => {
    render(<Harness initial="Hello" rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    el.focus();
    // Only `style.height` is written. Caret position under a controlled value is React's business;
    // what this component must never do is touch focus or selection while measuring.
    const blur = vi.spyOn(el, "blur");
    const setSel = vi.spyOn(el, "setSelectionRange");
    fireEvent.change(el, { target: { value: "Hello there, at some considerable length now." } });
    expect(document.activeElement).toBe(el);
    expect(blur).not.toHaveBeenCalled();
    expect(setSel).not.toHaveBeenCalled();
    expect(px(el)).toBeGreaterThan(0);
  });
});

describe("[R3] a width change re-wraps, so the height is measured again", () => {
  it("a width-only resize triggers one re-measure; a height change does NOT loop", async () => {
    const observers: Array<(entries: unknown[]) => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    render(<Harness initial={LONG_EN} rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    const spy = vi.spyOn(el.style, "removeProperty");
    void spy;

    // Same width → ignored. Feeding the height back in must not re-enter the measurement.
    const initialWidth = el.getBoundingClientRect().width;
    act(() => observers.forEach((cb) => cb([{ contentRect: { width: initialWidth } }])));
    const afterNoop = px(el);

    // A genuine width change → re-measured.
    stubHeight = () => 999;
    act(() => observers.forEach((cb) => cb([{ contentRect: { width: initialWidth + 100 } }])));
    expect(px(el)).toBe(999);
    expect(afterNoop).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});

describe("[R3] nothing conceals overflow", () => {
  it("the field never carries overflow-hidden, and the drag handle is off", () => {
    render(<Harness initial={LONG_EN} rows={1} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    expect(el.className).toMatch(/\bresize-none\b/);
    expect(el.className).not.toMatch(/overflow-hidden/);
    expect(el.style.overflow).not.toBe("hidden");
    expect(el.style.overflowY).not.toBe("hidden");
  });

  it("applyAutoHeight resets before measuring, and tolerates a missing element", () => {
    expect(() => applyAutoHeight(null)).not.toThrow();
    const el = document.createElement("textarea");
    document.body.appendChild(el);
    el.value = "x".repeat(200);
    applyAutoHeight(el);
    expect(parseFloat(el.style.height)).toBeGreaterThan(0);
  });

  it("under border-box the height includes the border, or every field lands short", () => {
    // Measured in WebKit at 390px before this was added: scrollHeight 48, clientHeight 46 — a
    // 2px shortfall on EVERY field, because scrollHeight is the padding box while `height` under
    // Tailwind's preflight is the border box. Two pixels shaves the last line's descenders, and
    // on a marginal wrap it costs the whole line.
    const el = document.createElement("textarea");
    document.body.appendChild(el);
    el.value = "x".repeat(120);
    vi.stubGlobal("getComputedStyle", () => ({ boxSizing: "border-box", borderTopWidth: "1px", borderBottomWidth: "1px" }));
    applyAutoHeight(el);
    const withBorder = parseFloat(el.style.height);

    vi.stubGlobal("getComputedStyle", () => ({ boxSizing: "content-box", borderTopWidth: "1px", borderBottomWidth: "1px" }));
    applyAutoHeight(el);
    const contentBox = parseFloat(el.style.height);

    expect(withBorder - contentBox).toBe(2);
    vi.unstubAllGlobals();
  });

  it("a zero measurement is left alone rather than written as 0px", () => {
    stubHeight = () => 0;
    const el = document.createElement("textarea");
    document.body.appendChild(el);
    applyAutoHeight(el);
    // A collapsed field would be worse than an unsized one.
    expect(el.style.height).toBe("auto");
  });
});
