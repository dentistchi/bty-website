"use client";

import { useEffect, useState } from "react";

/**
 * CenterMeCard — the Today-facing MIRROR of Center (v0, stage-only).
 *
 * Ownership: Center/self owns the MEANING; Today owns only the render SLOT. The
 * shell mounts this into the "me" tab and passes nothing but `locale` — it never
 * supplies semantic values. This card reads its own Center/self-safe derived
 * value (leadershipState) and reflects it. It does not ask, judge, mutate, or
 * invent.
 *
 * v0 renders exactly one derived line — the leadership STAGE (e.g. "FORGE ·
 * Stage 1"), composed from the two real fields on leadershipState:
 *   - codeName  → the Identity Anchor code (BTY_AVATAR_IDENTITY_LOCK §1)
 *   - stage     → "STAGE N: CODE" (btyStageFromCoreXp — derived from Core XP)
 * No current_state, no posture_today, no invented/placeholder self-state. If the
 * read fails (or no stage), the card falls back to the mirror line ALONE — never
 * a fake stage.
 *
 * Read-only: no input, no CTA, no tap handler, no navigation. The Center route is
 * reserved inertly (data attribute only) for a future arc — it is NOT a link.
 *
 * ─── CONTRACT / INVARIANTS (Native Me Provenance Guardrails STEP 1) ───────────────────
 * CenterMeCard is a Center/self MIRROR. To keep it from drifting into an Arena/progression
 * panel, it MUST hold to all of the following:
 *   • It may read ONLY `leadershipState.codeName` and `leadershipState.stage` from
 *     GET /api/bty/my-page/state (narrow-typed below so nothing else is destructurable).
 *   • It MUST NOT read /api/arena/leadership-engine/stage-summary (or any /api/arena/* route).
 *   • It MUST render only the composed identity form "<codeName> · Stage <ordinal>"
 *     (see {@link composeStageLine}); it MUST NOT render an Arena stageName or a raw stage string.
 *   • It MUST NOT render XP, rank, leaderboard, streak, raw AIR, reset windows / due dates,
 *     pattern signatures, current_state, posture, or ANY competition language.
 *   • Fail-soft: on any read failure or missing/odd stage → the mirror line renders ALONE
 *     (never a fake, invented, or partial stage).
 * Changing any of these turns Me into Arena Progress — do not, without an explicit ontology
 * decision. The weekly rhythm's Arena coupling is likewise isolated behind ./meWeeklyRhythm.
 * ──────────────────────────────────────────────────────────────────────────────────────
 */

type Locale = "en" | "ko";

/**
 * Narrow read of GET /api/bty/my-page/state — ONLY leadershipState.codeName and
 * leadershipState.stage (the Commander-approved Me-card fields). Every other
 * field (metrics.*, signals[], pattern_signatures[], current_state, counts) is
 * deliberately un-typed so it cannot be destructured, read, or rendered.
 */
type MeStateNarrow = {
  leadershipState?: { codeName?: string | null; stage?: string | null } | null;
};

type Copy = { title: string; mirror: string };

const COPY: Record<Locale, Copy> = {
  en: { title: "Me", mirror: "Return to yourself with honesty." },
  ko: { title: "나", mirror: "정직하게 자신에게 돌아갑니다." },
};

/**
 * Compose the display stage line from real derived fields only: identity `codeName` +
 * the Core-XP-derived `stage` ("STAGE N: CODE") → "FORGE · Stage 1" (presentation reformat,
 * not computation).
 *
 * GUARDRAIL (Native Me Provenance Guardrails STEP 1): this returns ONLY the composed
 * `<codeName> · Stage <ordinal>` identity form, or null. It intentionally does NOT fall back
 * to rendering the raw `stage` string verbatim — a raw pass-through could leak an unexpected
 * stage label (and must never surface an Arena stageName). When codeName is missing OR the
 * stage does not match "STAGE N: …", we return null and the caller shows the mirror line ALONE.
 * NEVER returns an invented label, a raw stage string, or an Arena stageName.
 */
export function composeStageLine(
  codeName?: string | null,
  stage?: string | null,
): string | null {
  if (typeof stage !== "string" || stage.trim().length === 0) return null;
  const m = stage.match(/^STAGE\s+(\d+)\s*:/i);
  const code = typeof codeName === "string" && codeName.trim().length > 0 ? codeName.trim() : null;
  // Only the clean identity form renders; anything else → mirror-only (null), never a raw label.
  if (m && code) return `${code} · Stage ${m[1]}`;
  return null;
}

/**
 * Read leadershipState (codeName + stage) from GET /api/bty/my-page/state. RAW
 * fetch (same-origin, cookie credentials) — /api/bty/* is path-guarded out of
 * arenaFetch, matching the shell's fail-soft promise read. Returns null on any
 * failure with a developer-visible warn; the card then shows the mirror alone.
 */
async function fetchStageLine(locale: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/bty/my-page/state?locale=${encodeURIComponent(locale)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as MeStateNarrow;
    return composeStageLine(data.leadershipState?.codeName, data.leadershipState?.stage);
  } catch (e) {
    console.warn(
      "[center/me-card] /api/bty/my-page/state stage fell back (mirror-only):",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export default function CenterMeCard({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const [stageLine, setStageLine] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchStageLine(locale).then((line) => {
      if (alive) setStageLine(line);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  return (
    // A quiet mirror, not a profile widget. Centered, low visual pressure, no
    // badge/progress/glow. `data-center-route` is an INERT reserved reference to
    // the future Center destination — no href, no handler, no navigation.
    <div
      data-center-me-card
      data-center-route={`/${locale}/center`}
      className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-white">{copy.title}</h2>
      <p className="mt-3 max-w-[18rem] text-[0.95rem] leading-6 text-white/55">{copy.mirror}</p>
      {stageLine ? (
        <p
          data-stage-line
          className="mt-6 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90"
        >
          {stageLine}
        </p>
      ) : null}
    </div>
  );
}
