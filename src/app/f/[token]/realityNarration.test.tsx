import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R4-R5C9A — the TERMINAL half.
 *
 * The narration must be impossible to render without server truth, because completion WITHOUT an
 * Apply window is routine (no decision, no action-decision step, anonymous, or a materialization
 * error). An unconditional "this week" would be false for all of those.
 */

const ROOM = join(process.cwd(), "src/app/f/[token]");
const read = (f: string) => readFileSync(join(ROOM, f), "utf8");
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CLIENTS = ["FoundryJoinClient.tsx", "FoundryDocumentClient.tsx", "FoundryGuidanceClient.tsx"];

describe("T13 — one contract in all three room families", () => {
  it("each client holds the outcome, captures it, and renders on it alone", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).toContain('const [applyWindow, setApplyWindow] = useState<"created" | "exists" | null>(null);');
      expect(c, f).toContain('if (d.applyWindow === "created" || d.applyWindow === "exists") setApplyWindow(d.applyWindow);');
      expect(c, f).toContain("{applyWindow ? (");
      expect(c, f).toContain('data-testid="apply-narration"');
    }
  });
});

describe("T3/T4/T5/T6 — silence is the default", () => {
  it("the ONLY thing that can render the sentence is the server outcome", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      /*
        Assert THE GUARD LINE, not a window of surrounding JSX. A 400-char look-back swept in the
        neighbouring assignment/XP blocks and flagged their conditions instead of this one.
      */
      const lines = c.split("\n");
      const at = lines.findIndex((l) => l.includes('data-testid="apply-narration"'));
      const guard = lines.slice(0, at).reverse().find((l) => l.includes("applyWindow ?")) ?? "";
      expect(guard.trim(), f).toBe("{applyWindow ? (");
    }
  });

  it("T18 — no client infers Apply readiness from decision text, auth, follow-up or practice", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).not.toMatch(/setApplyWindow\((?!d\.applyWindow)/);
      // setApplyWindow is written in exactly one place.
      expect((c.match(/setApplyWindow\(/g) ?? []).length, f).toBe(1);
    }
  });

  it("T13b — the copy literal is never rendered unconditionally", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      // The sentence exists only as a copy VALUE and one guarded reference.
      expect((c.match(/t\.applyNarration/g) ?? []).length, f).toBe(1);
    }
  });
});

describe("T8/T9/T7 — the two clocks stay separate", () => {
  it("the follow-up sentence is preserved, unchanged and independent", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).toContain('data-testid="awarded-followup"');
      expect(c, f).toContain("{identity.followUp.meaning}");
    }
    // Follow-up duration is still Host-authored 7 or 30 — never rewritten to match Apply's 7.
    const dom = readFileSync(join(process.cwd(), "src/domain/foundry/followup/followUpObligation.ts"), "utf8");
    expect(dom).toContain("export type FollowUpDays = 7 | 30;");
  });

  it("T10/T11 — the two sentences are rendered by INDEPENDENT guards", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      const a = c.indexOf("{applyWindow ? (");
      const b = c.indexOf("{identity.followUp ? (", a);
      expect(a, f).toBeGreaterThan(-1);
      expect(b, f).toBeGreaterThan(a); // §6: narration sits BEFORE the follow-up line
      // Neither guard mentions the other — Apply can render alone, follow-up can render alone.
      expect(c.slice(a, a + 120), f).not.toContain("identity.followUp");
      expect(c.slice(b, b + 120), f).not.toContain("applyWindow");
    }
  });
});

describe("T14/T10 — narrate, never navigate", () => {
  it("no CTA, link or button was added with the narration", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      const i = c.indexOf('data-testid="apply-narration"');
      const block = c.slice(i - 200, i + 300);
      expect(block, f).not.toMatch(/<a |<button|href=|bg-\[#C9A66B\] px/);
      expect(block, f).toContain("text-sm leading-6 text-white/80"); // existing quiet body style
    }
  });

  it("T10 — Today's own material is not copied onto the terminal", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).not.toMatch(/decision_response_text|dueBtyDay|dueAtIso|APPLY_DUE|applyWindowId/);
    }
  });

  it("T16 — return destinations unchanged, each family keeping its own measured shape", () => {
    // Video and Document expose a dedicated assigned exit; Guidance uses ONE anchor whose label
    // flips on `roomReturn` (measured in R4-R5C5 and unchanged here).
    for (const f of ["FoundryJoinClient.tsx", "FoundryDocumentClient.tsx"]) {
      expect(code(read(f)), f).toContain('data-testid="assigned-return"');
    }
    const g = code(read("FoundryGuidanceClient.tsx"));
    expect(g).toContain('href={roomReturn ?? "/"}');
    expect(g).toContain("{roomReturn ? t.backToLearn : t.continueToBty}");
    for (const f of CLIENTS) expect(code(read(f)), f).toContain("t.backToLearn");
  });

  it("T17 — Practice is untouched (C8 said NO BUILD)", () => {
    const c = code(read("FoundryJoinClient.tsx"));
    expect(c).toContain('data-testid="now-try-it"');
    expect(c).toContain('snapshot.practice && xp === "awarded"');
    // Practice is not coupled to Apply in either direction.
    expect(c).not.toMatch(/practice[^\n]*applyWindow|applyWindow[^\n]*practice/i);
  });
});

describe("T20 — the copy", () => {
  it("says ACT, WHEN and WHERE, in both languages", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).toContain(
        'applyNarration: "Use what you decided in real work this week. You\'ll see it again in Today."',
      );
      expect(c, f).toContain(
        'applyNarration: "이번 주에 정한 것을 실제 업무에서 해보세요. 오늘 탭에서 다시 볼 수 있어요."',
      );
    }
  });

  it("uses no compliance or internal vocabulary", () => {
    const forbidden = /required|must|due|overdue|apply window|reality|materiali|7-day task|finish this|complete this|기한|필수|마감/i;
    for (const f of CLIENTS) {
      const c = code(read(f));
      const strings = [...c.matchAll(/applyNarration: "((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
      expect(strings.length, `${f}: en + ko`).toBe(2);
      expect(strings.filter((v) => forbidden.test(v)), f).toEqual([]);
    }
  });

  it("KO uses the product's own tab label, not the English word", () => {
    const bar = readFileSync(join(process.cwd(), "src/components/app-shell/AppTabBar.tsx"), "utf8");
    expect(bar).toContain('ko: { today: "오늘"');
    for (const f of CLIENTS) {
      const ko = [...code(read(f)).matchAll(/applyNarration: "((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "")[1] ?? "";
      expect(ko, f).toContain("오늘");
      expect(ko, f).not.toContain("Today");
    }
  });
});
