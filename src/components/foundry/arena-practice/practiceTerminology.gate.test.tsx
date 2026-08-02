/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArenaPracticeFlow } from "./ArenaPracticeFlow";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";

/**
 * PRACTICE TERMINOLOGY REGRESSION GATE (Slice 3.2I-R5B1A.1-R2.14).
 *
 * The product name is Practice / 연습; its content is Practice situations / 연습 상황. "Arena" is
 * INTERNAL only — routes, files, database objects, TypeScript types and identifiers keep it. What
 * users read must never contain it, and must never point at a tab that does not exist: the shell
 * tabs are Today / Learn / Practice / Me (오늘 / 배우기 / 연습 / 나).
 *
 * The pre-existing terminology validator (44 unrelated baseline warnings) does not detect this
 * class of defect, so this gate is deliberately narrow and additive: it fails ONLY on Practice
 * terminology regressions and leaves that baseline untouched.
 *
 * Layer 1 — COPY-SOURCE GATE: user-facing string literals in the Practice copy resources.
 * Layer 2 — RENDERED-SURFACE GATE: what the Host actually sees, in EN and KO.
 */

const ROOT = process.cwd();
const FORBIDDEN = /Arena|arena|아레나/;

/**
 * String literals that are USER-FACING copy. Deliberately excludes the three categories the
 * product decision permits to keep the word Arena: import specifiers, kebab identifiers/testids,
 * and CSS — Tailwind class strings and `--arena-*` custom properties are styling, not language.
 */
const CSS_LIKE =
  /(^|\s)(?:rounded|text|bg|border|px|py|pt|pb|mt|mb|ml|mr|w|h|min|max|gap|grid|flex|font|tracking|leading|uppercase|truncate|shrink|absolute|relative|inline|hidden|overflow|z|opacity|ring|shadow|space|items|justify|self|col|row)[-\s]|--[a-z]|var\(/;

function userFacingLiterals(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
    const v = m[1];
    if (!v.trim()) continue;
    if (/^(@\/|\.\/|\.\.\/|node:)/.test(v)) continue; // import specifier
    if (/^\//.test(v) || v.includes("://")) continue; // route / URL — internal, may keep "arena"
    if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(v)) continue; // kebab identifier / testid
    // A single bare lower-case token is an identifier (view key, union member), not copy. Real
    // copy is capitalised, Korean, or multi-word — so "Arena"/"아레나"/"… arena …" still fail.
    if (/^[a-z][a-zA-Z0-9]*$/.test(v)) continue;
    if (CSS_LIKE.test(v)) continue; // Tailwind / CSS custom property
    out.push(v);
  }
  return out;
}

describe("Layer 1 — Practice copy sources contain no user-facing Arena terminology", () => {
  const COPY_SOURCES = [
    "src/components/foundry/arena-practice/arenaPracticeCopy.ts",
    "src/components/app-shell/ArenaRoom.tsx",
    "src/components/app-shell/PracticeLanding.tsx",
    "src/components/bty-arena/ArenaPracticeDiscovery.tsx",
    "src/components/bty-arena/practice/ArenaPracticePlayer.tsx",
    "src/components/foundry/arena-practice/ArenaScenarioPreview.tsx",
    "src/components/foundry/arena-practice/BoundaryScopePanel.tsx",
    "src/components/foundry/arena-practice/BoundaryEditor.tsx",
  ];

  it.each(COPY_SOURCES)("%s exposes no Arena / 아레나 in user-facing copy", (rel) => {
    const offenders = userFacingLiterals(readFileSync(join(ROOT, rel), "utf8")).filter((v) => FORBIDDEN.test(v));
    expect(offenders).toEqual([]);
  });

  it("every ARENA_PRACTICE_COPY value in BOTH locales is free of Arena / 아레나", () => {
    const offenders: string[] = [];
    for (const [loc, table] of Object.entries(ARENA_PRACTICE_COPY)) {
      for (const [key, value] of Object.entries(table)) {
        if (typeof value === "string" && FORBIDDEN.test(value)) offenders.push(`${loc}.${key} = ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no copy value instructs the user toward a tab that does not exist", () => {
    // The real tabs. Anything else named as a "tab" is a lie to the user.
    const REAL_TABS = ["Today", "Learn", "Practice", "Me", "오늘", "배우기", "연습", "나"];
    const offenders: string[] = [];
    for (const [loc, table] of Object.entries(ARENA_PRACTICE_COPY)) {
      for (const [key, value] of Object.entries(table)) {
        if (typeof value !== "string") continue;
        const m = value.match(/(\S+)\s*(?:tab|탭)/);
        if (m && !REAL_TABS.includes(m[1].replace(/[^A-Za-z가-힣]/g, ""))) offenders.push(`${loc}.${key} = ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the dead publish keys are gone (no unreachable copy left behind)", () => {
    for (const table of Object.values(ARENA_PRACTICE_COPY)) {
      expect(Object.keys(table)).not.toContain("publishedBody");
      expect(Object.keys(table)).not.toContain("openInArena");
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — RENDERED SURFACE
// ---------------------------------------------------------------------------

const SOURCE = {
  event_id: "evt-1",
  event_title: "Handoff under pressure",
  event_status: "open",
  module_version: 3,
  arena_recommended: true,
  capability: "Owning a missed commitment",
  expected_behavior: "Raise the concern before the shortcut is taken",
  success_evidence: null,
  audience_type: "leaders",
  audience_detail: null,
  learning_needs: ["decide"],
  hardest_when_options: ["time_limited"],
  avoidance_seeds: ["time"],
};
/** A real shell carries the lifecycle discriminator, so the rendered surface includes R5B2's editor. */
const SHELL_DRAFT = {
  id: "shell-1",
  scenario_draft: null,
  generation_source: null,
  revision: 0,
  guided_answers: { practiceSetupVersion: 1 },
};

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}
function mockFetch(over: { draftsList?: unknown; oneDraft?: unknown } = {}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes(over.draftsList ?? { drafts: [{ id: "shell-1" }] });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes(over.oneDraft ?? { draft: SHELL_DRAFT });
    return jsonRes({});
  });
}

beforeEach(() => vi.stubGlobal("fetch", mockFetch()));
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe.each([
  ["en", "Set up practice", "PRACTICE"],
  ["ko", "Practice 설정", "연습"],
] as const)("Layer 2 — rendered Host Practice surface (%s)", (locale, anchor, eyebrow) => {
  it("renders no visible Arena / 아레나 anywhere on the reachable setup surface", async () => {
    const { container } = render(<ArenaPracticeFlow eventId="evt-1" locale={locale} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(anchor)).toBeTruthy());
    const visible = container.textContent ?? "";
    expect(visible.length).toBeGreaterThan(0);
    expect(FORBIDDEN.test(visible)).toBe(false);
  });

  it("uses the canonical Practice eyebrow, not infrastructure terminology", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale={locale} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(anchor)).toBeTruthy());
    expect(screen.getAllByText(eyebrow).length).toBeGreaterThan(0);
  });

  it("shows no blank or placeholder copy on the reachable surface", async () => {
    const { container } = render(<ArenaPracticeFlow eventId="evt-1" locale={locale} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(anchor)).toBeTruthy());
    const visible = container.textContent ?? "";
    expect(visible).not.toMatch(/undefined|null|\[object Object\]|TODO|TBD/);
  });
});

describe("Layer 2 — publish-state copy tells the truth about where learners start", () => {
  it.each(["en", "ko"] as const)("%s: the tab hint names the real Practice tab", (loc) => {
    const t = ARENA_PRACTICE_COPY[loc];
    expect(FORBIDDEN.test(t.openArenaTabHint)).toBe(false);
    expect(t.openArenaTabHint).toMatch(loc === "en" ? /Practice tab/ : /연습 탭/);
  });

  it.each(["en", "ko"] as const)("%s: publish + live states read as Practice, never as infrastructure", (loc) => {
    const t = ARENA_PRACTICE_COPY[loc];
    for (const v of [t.summaryTitle, t.publishToArena, t.published, t.publishedTitle, t.liveBanner, t.testInArena, t.noModuleLead, t.eyebrow]) {
      expect(FORBIDDEN.test(v)).toBe(false);
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it("neither locale claims success before it happened", () => {
    for (const loc of ["en", "ko"] as const) {
      const t = ARENA_PRACTICE_COPY[loc];
      // the pre-publish CTA must not already read as published
      expect(t.publishToArena).not.toBe(t.published);
      expect(t.generatingTitle).not.toBe(t.publishedTitle);
    }
  });
});
