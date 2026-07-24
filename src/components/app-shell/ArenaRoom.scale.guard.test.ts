import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Arena entry scale consistency guard (Slice 3.1B-3N-5D.1B). Moving Today→Arena must render at ONE
 * consistent app-shell scale. Measured class = D (component-spacing inconsistency): Arena's TEXT
 * tokens already match Center/Foundry (0.95rem/text-sm), so the fix aligns the divergent SPACING —
 * the card padding + the `mx-auto max-w-md px-1` container anomaly — to the shell surface contract,
 * WITHOUT a viewport/zoom/transform hack and WITHOUT shrinking Arena text below the shell norm.
 */
const arena = readFileSync(join(process.cwd(), "src/components/app-shell/ArenaRoom.tsx"), "utf8");
// Structural (element/attribute) checks run against CODE with comments stripped, so a docstring that
// merely *describes* the shell's <main> or the viewport doesn't trip a "does Arena render X" assertion.
const code = arena.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("ArenaRoom — entry scale consistency", () => {
  it("(1,2) uses NO CSS zoom and NO transform:scale hack", () => {
    expect(arena).not.toMatch(/\bzoom\s*:/);
    expect(arena).not.toMatch(/transform:\s*["'`]?scale/);
    expect(arena).not.toMatch(/scale-\d/); // no Tailwind scale-* utility
  });

  it("(3,9) creates no nested app-shell / bottom navigation", () => {
    expect(code).not.toMatch(/BottomNav/);
    expect(code).not.toMatch(/<nav\b/);
    expect(code).not.toMatch(/<main\b/);
  });

  it("(4) does not touch the viewport meta / accessibility flags", () => {
    expect(code).not.toMatch(/user-scalable/);
    expect(code).not.toMatch(/maximum-scale/);
    expect(code).not.toMatch(/viewport/i);
  });

  it("(5) the practice-list root fills the shared <main> width contract (no mx-auto/max-w-md/px-1 anomaly)", () => {
    // The sibling tabs (Center/Foundry) fill <main> (px-5); Arena must too.
    const listRoot = arena.match(/className="btyFadeIn flex w-full flex-col gap-3 pt-2"/);
    expect(listRoot).toBeTruthy();
    expect(arena).not.toContain("mx-auto flex w-full max-w-md");
    expect(arena).not.toContain("max-w-md flex-col gap-3 px-1");
  });

  it("(6) Arena content stays within the approved mobile scale (no text-lg/xl/2xl/3xl; title = shell 0.95rem)", () => {
    expect(arena).not.toMatch(/text-(lg|xl|2xl|3xl)\b/);
    expect(arena).toContain("text-[0.95rem]"); // aligned to the Center/Foundry/My-Learning card-title token
    expect(arena).not.toContain("text-[0.98rem]"); // the oversized outlier is gone
  });

  it("(5b) cards use the canonical shell card padding (px-4 py-3), not the oversized px-5 py-4", () => {
    expect(arena).toContain("bg-white/[0.03] px-4 py-3");
    expect(arena).not.toContain("bg-white/[0.03] px-5 py-4");
  });

  it("(7) the practice-again button is fluid width (no fixed iPhone-pixel width → no horizontal overflow)", () => {
    expect(arena).toMatch(/mt-3 w-full rounded-xl bg-\[#C9A66B\] px-4 py-2\.5/);
    expect(arena).not.toMatch(/w-\[\d+px\]/);
  });

  it("(8) long practice titles cannot force horizontal overflow (truncate + min-w-0)", () => {
    expect(arena).toContain("min-w-0 truncate text-[0.95rem]");
  });
});
