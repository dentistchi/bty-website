"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Teams-hosted runtime probe. Slice TQ-1. MEASUREMENT ONLY — it changes no layout and no style.
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
 * ★ HOW IT IS REACHED. `/teams?diag=1`, and only that. There is no admin lookup (an authority read
 * would be a second thing that can fail on the surface we are diagnosing), no API call, no
 * network, and no storage. Everything below is read from the DOM and `window` on the device and
 * rendered on the device; nothing leaves it.
 *
 * ★ WHAT IT DELIBERATELY DOES NOT COLLECT. No user id, no tenant, no token, no session, no
 * message, no URL beyond the flag itself, no user agent string beyond the platform hints already
 * visible in the layout. A diagnostic that quietly becomes telemetry is a different feature.
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

/** Any ancestor transform is the single most likely cause of blur; report the whole chain. */
function transformChain(start: Element | null): string {
  const found: string[] = [];
  let el: Element | null = start;
  let depth = 0;
  while (el && depth < 12) {
    const cs = getComputedStyle(el);
    if (cs.transform && cs.transform !== "none") found.push(`${el.tagName.toLowerCase()}:${cs.transform}`);
    if (cs.zoom && cs.zoom !== "1" && cs.zoom !== "normal") found.push(`${el.tagName.toLowerCase()}:zoom=${cs.zoom}`);
    if (cs.filter && cs.filter !== "none") found.push(`${el.tagName.toLowerCase()}:filter=${cs.filter}`);
    el = el.parentElement;
    depth++;
  }
  return found.length ? found.join(" | ") : "none";
}

function collect(): Row[] {
  const doc = document.documentElement;
  const vv = window.visualViewport;
  const probe = document.getElementById("bty-safe-area-probe");
  const cs = probe ? getComputedStyle(probe) : null;
  const shell = document.querySelector("[data-bty-teams-floor='1']")?.firstElementChild ?? null;
  const main = document.querySelector("main");
  const nav = main?.parentElement?.querySelector("nav") ?? document.querySelector("nav");
  const h1 = document.querySelector("h1, h2");

  return [
    { k: "framed (self !== top)", v: String(window.self !== window.top) },
    { k: "innerWidth × innerHeight", v: `${window.innerWidth} × ${window.innerHeight}` },
    { k: "visualViewport w × h", v: vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)}` : "unsupported" },
    { k: "visualViewport scale", v: vv ? String(vv.scale) : "unsupported" },
    { k: "visualViewport offsetTop", v: vv ? String(Math.round(vv.offsetTop)) : "unsupported" },
    { k: "devicePixelRatio", v: String(window.devicePixelRatio) },
    { k: "screen w × h", v: `${window.screen.width} × ${window.screen.height}` },
    { k: "safe-area top/bottom", v: cs ? `${cs.paddingTop} / ${cs.paddingBottom}` : "probe missing" },
    { k: "safe-area left/right", v: cs ? `${cs.paddingLeft} / ${cs.paddingRight}` : "probe missing" },
    { k: "html clientH / scrollH", v: `${doc.clientHeight} / ${doc.scrollHeight}` },
    { k: "body scrollW (overflow?)", v: `${document.body.scrollWidth} (viewport ${window.innerWidth})` },
    { k: "shell root rect", v: rect(shell) },
    { k: "main rect", v: rect(main) },
    { k: "first heading rect", v: rect(h1) },
    { k: "bottom nav rect", v: rect(nav) },
    { k: "transform/zoom/filter chain above main", v: transformChain(main) },
    { k: "100dvh resolves to", v: `${getComputedStyle(doc).getPropertyValue("--bty-dvh-probe") || "n/a"}` },
  ];
}

export default function TeamsRuntimeProbe() {
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
