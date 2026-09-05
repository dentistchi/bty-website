"use client";

import { useCallback, useEffect, useState } from "react";
import { isTeamsTabPath } from "@/domain/teams/tabRuntime";

/**
 * Teams-hosted runtime probe. Slice TQ-1, re-entered by TQ-2. MEASUREMENT ONLY — it changes no
 * layout and no style.
 *
 * ★ WHY THIS EXISTS INSTEAD OF A FIX.
 *
 * A Founder screenshot showed the BTY tab on an iPhone inside Teams looking soft, with the top
 * slightly clipped. Every plausible cause — an iframe that reports a different viewport than the
 * device, a stale `100vh`, a root transform, a devicePixelRatio the host renders at, safe-area
 * insets that resolve to ZERO inside a frame, a header measured against the wrong box — produces
 * the same screenshot and a different repair. Guessing would mean shipping a cosmetic change to
 * production and asking a person to tell us whether it felt better.
 *
 * So this reports NUMBERS from the real host, and nothing is changed until they are read.
 *
 * ★ HOW IT IS REACHED (TQ-2 CORRECTED THIS).
 *
 * TQ-1 said "`/teams?diag=1`, and only that". MEASURED 2026-09-05: opening that URL directly on an
 * iPhone put the document in Safari, with browser chrome visible, no Teams host, a failed
 * bootstrap and the words "BTY couldn't open yet." on screen. It measured nothing, because typing
 * the tab's URL into a browser does not produce the tab — it produces the same document with none
 * of the host the numbers are about.
 *
 * The query flag REMAINS, unchanged, for automated tests. The device entry is now a row inside the
 * already-running tab (Me → "Teams display diagnostics"), gated on Teams-hosted AND platform-admin
 * authority, so what gets measured is the live frame the person is already looking at.
 *
 * ★ IT IS AN OVERLAY, NOT A DESTINATION. It renders over the current screen and unmounts back to
 * it. No route change, no reload, no history entry — partly because that is the calm behaviour,
 * and mostly because a navigation would discard the very frame being measured.
 *
 * ★ WHAT IT DELIBERATELY DOES NOT COLLECT. No identity, no organisation, no credential, no
 * message, no URL beyond this document's own pathname, no user agent string. Everything below is
 * read from the DOM and `window` on the device and rendered on the device; nothing leaves it.
 * There is no network call, no storage write, and no database write anywhere in this file.
 */

const SAFE_AREA_PROBE_STYLE: React.CSSProperties = {
  position: "absolute",
  visibility: "hidden",
  pointerEvents: "none",
  top: 0,
  left: 0,
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
};

type Row = { k: string; v: string };

function rect(el: Element | null): string {
  if (!el) return "absent";
  const r = el.getBoundingClientRect();
  return `x${Math.round(r.x)} y${Math.round(r.y)} w${Math.round(r.width)} h${Math.round(r.height)}`;
}

/** Computed box facts for one element: the four that decide whether it clips or floats. */
function box(el: Element | null): string {
  if (!el) return "absent";
  const cs = getComputedStyle(el);
  return `pos=${cs.position} h=${cs.height} pad=${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft} mar=${cs.marginTop}/${cs.marginRight}/${cs.marginBottom}/${cs.marginLeft}`;
}

/** Any ancestor transform is the single most likely cause of blur; report the whole chain. */
function transformChain(start: Element | null): string {
  const found: string[] = [];
  let el: Element | null = start;
  let depth = 0;
  while (el && depth < 16) {
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    if (cs.transform && cs.transform !== "none") found.push(`${tag}:${cs.transform}`);
    if (cs.zoom && cs.zoom !== "1" && cs.zoom !== "normal") found.push(`${tag}:zoom=${cs.zoom}`);
    el = el.parentElement;
    depth++;
  }
  return found.length ? found.join(" | ") : "none";
}

/**
 * Filters are reported SEPARATELY from transforms, because they blur for a different reason and
 * take a different repair — a `backdrop-filter` on an ancestor rasterises its whole subtree on
 * WebKit even when no transform is present anywhere.
 */
function filterChain(start: Element | null): string {
  const found: string[] = [];
  let el: Element | null = start;
  let depth = 0;
  while (el && depth < 16) {
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const backdrop = cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter");
    if (cs.filter && cs.filter !== "none") found.push(`${tag}:filter=${cs.filter}`);
    if (backdrop && backdrop.trim() !== "" && backdrop.trim() !== "none") found.push(`${tag}:backdrop=${backdrop.trim()}`);
    el = el.parentElement;
    depth++;
  }
  return found.length ? found.join(" | ") : "none";
}

/** The overlay's own root, so nothing inside it can ever be mistaken for product geometry. */
export const OVERLAY_ATTR = "data-bty-diagnostic-overlay";

/**
 * Find a product element, NEVER one of the probe's own.
 *
 * The overlay renders `<button>`s, a `<dl>` and a hidden sampler into the same document it
 * measures. None of them carries a product attribute today, so this is belt-and-braces rather than
 * a live bug — and it stays, because the failure it prevents is silent: a probe that measured its
 * own chrome would report plausible numbers that describe nothing the user can see. The measuring
 * instrument must not appear in its own measurement.
 */
function pick(selector: string): Element | null {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    if (!el.closest(`[${OVERLAY_ATTR}]`)) return el;
  }
  return null;
}

function collect(): Row[] {
  const doc = document.documentElement;
  const body = document.body;
  const vv = window.visualViewport;
  const probe = document.getElementById("bty-safe-area-probe");
  const cs = probe ? getComputedStyle(probe) : null;
  /*
    ★ THE FIRST READING MEASURED THE WRONG ELEMENTS (Slice TQ-3).

    The Founder's real device run returned `main` padding-top 32px with a first heading at y=20 and
    a "bottom nav" 224px tall. Those three cannot describe one screen, and they did not: the
    generic selectors below USED to be `main.parentElement.querySelector("nav")` and
    `main.querySelector("h1, h2")`.

      · `nav`  — document order finds the FIRST nav under the shell root, and on the Me tab that is
                 the "My records" ROW LIST, which lives INSIDE main. 224px is four rows and their
                 gaps. The real bottom dock was never measured.
      · `h1`   — whichever heading a tab happens to render first, so the number meant something
                 different on every tab.
      · header — the Me tab renders none, which is why it came back "absent" and read like a
                 missing element rather than a tab that has no header.

    Every anchor below is now an EXPLICIT product attribute. A selector that can drift onto a
    different element produces numbers that look like a layout bug and are a measurement bug, and
    an hour was spent on exactly that. The product layout was NOT changed to suit the probe — these
    are attributes on elements that already existed.
  */
  const appRoot = pick("[data-bty-app-root]");
  const main = pick("main");
  const topInsetSpacer = pick("[data-bty-top-inset]");
  const header = pick("[data-bty-app-header]");
  const nav = pick("[data-bty-bottom-nav]");
  const h1 = pick("[data-bty-main-heading]");
  const docCs = getComputedStyle(doc);
  const bodyCs = getComputedStyle(body);
  const overflowX = Math.max(0, Math.round(body.scrollWidth - doc.clientWidth));

  return [
    { k: "location pathname", v: window.location.pathname },
    { k: "Teams host detected", v: String(isTeamsTabPath(window.location.pathname)) },
    { k: "framed (self !== top)", v: String(window.self !== window.top) },

    { k: "innerWidth × innerHeight", v: `${window.innerWidth} × ${window.innerHeight}` },
    { k: "documentElement clientW × clientH", v: `${doc.clientWidth} × ${doc.clientHeight}` },
    { k: "visualViewport w × h", v: vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)}` : "unsupported" },
    { k: "visualViewport scale", v: vv ? String(vv.scale) : "unsupported" },
    { k: "visualViewport offsetTop", v: vv ? String(Math.round(vv.offsetTop)) : "unsupported" },
    { k: "visualViewport offsetLeft", v: vv ? String(Math.round(vv.offsetLeft)) : "unsupported" },
    { k: "devicePixelRatio", v: String(window.devicePixelRatio) },
    { k: "screen w × h", v: `${window.screen.width} × ${window.screen.height}` },

    { k: "safe-area top / right", v: cs ? `${cs.paddingTop} / ${cs.paddingRight}` : "probe missing" },
    { k: "safe-area bottom / left", v: cs ? `${cs.paddingBottom} / ${cs.paddingLeft}` : "probe missing" },
    { k: "reserved top-inset rect", v: rect(topInsetSpacer) },
    { k: "reserved top-inset computed height", v: topInsetSpacer ? getComputedStyle(topInsetSpacer).height : "absent" },

    { k: "html rect", v: rect(doc) },
    { k: "html box", v: box(doc) },
    { k: "body rect", v: rect(body) },
    { k: "body box", v: box(body) },
    { k: "app root rect", v: rect(appRoot) },
    { k: "app root box", v: box(appRoot) },
    { k: "BTY header rect", v: rect(header) },
    { k: "BTY header box", v: box(header) },
    { k: "main rect", v: rect(main) },
    { k: "main box", v: box(main) },
    { k: "first heading rect", v: rect(h1) },
    { k: "bottom nav rect", v: rect(nav) },
    { k: "bottom nav box", v: box(nav) },

    { k: "html scrollH / body scrollH", v: `${doc.scrollHeight} / ${body.scrollHeight}` },
    { k: "main scrollH", v: main ? String(main.scrollHeight) : "absent" },
    { k: "horizontal overflow", v: `${overflowX}px (body scrollW ${document.body.scrollWidth} vs clientW ${doc.clientWidth})` },

    { k: "transform/zoom chain above main", v: transformChain(main) },
    { k: "filter/backdrop-filter chain above main", v: filterChain(main) },
    { k: "html zoom / body zoom", v: `${docCs.zoom || "n/a"} / ${bodyCs.zoom || "n/a"}` },

    { k: "font smoothing (html / body)", v: `${docCs.getPropertyValue("-webkit-font-smoothing") || "n/a"} / ${bodyCs.getPropertyValue("-webkit-font-smoothing") || "n/a"}` },
    { k: "text-size-adjust (html)", v: docCs.getPropertyValue("-webkit-text-size-adjust") || docCs.getPropertyValue("text-size-adjust") || "n/a" },
    { k: "root font-size", v: docCs.fontSize },
  ];
}

export default function TeamsRuntimeProbe({ onClose }: { onClose?: () => void } = {}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [copied, setCopied] = useState(false);

  const measure = useCallback(() => {
    // Two frames: after layout AND after the shell's entry animation has had a tick, so a
    // transform captured mid-animation is not reported as a resting one.
    requestAnimationFrame(() => requestAnimationFrame(() => setRows(collect())));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [measure]);

  const text = (rows ?? []).map((r) => `${r.k}: ${r.v}`).join("\n");

  return (
    <div
      data-testid="teams-runtime-probe"
      {...{ [OVERLAY_ATTR]: "" }}
      className="fixed inset-x-0 bottom-0 z-[9999] max-h-[60dvh] overflow-y-auto border-t border-white/20 bg-black/90 px-4 py-3 text-[11px] leading-relaxed text-white"
    >
      <div id="bty-safe-area-probe" style={SAFE_AREA_PROBE_STYLE} aria-hidden />
      <div className="mb-2 flex items-center justify-between gap-3">
        <strong className="text-[12px]">BTY runtime — Teams host</strong>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={measure}
            className="min-h-[44px] rounded-lg border border-white/30 px-3"
          >
            Re-measure
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(text).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
            className="min-h-[44px] rounded-lg border border-white/30 px-3"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          {/* Close exists only when someone owns the closing. Under `?diag=1` nothing does, and a
              button that cannot put the reader back where they were is worse than no button. */}
          {onClose ? (
            <button
              type="button"
              data-testid="teams-runtime-probe-close"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-white/30 px-3"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1">
        {(rows ?? []).map((r) => (
          <div key={r.k} className="contents">
            <dt className="text-white/60">{r.k}</dt>
            <dd className="break-words font-mono">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
