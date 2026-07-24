import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Accessibility-safe viewport guard (Slice 3.1B-3N-5C.4). The iOS post-action zoom fix must NOT
 * disable pinch zoom or pin the scale. Confirms the canonical viewport keeps width=device-width +
 * initial-scale=1 and never introduces user-scalable=no / maximum-scale, and that the app-shell
 * carries no persistent CSS zoom / transform:scale wrapper (decorative @keyframes are allowed).
 */
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
const shell = readFileSync(join(process.cwd(), "src/components/app-shell/BtyDailyAppShell.tsx"), "utf8");

describe("viewport accessibility guard", () => {
  it("canonical viewport = width device-width + initial-scale 1, no restrictive flags", () => {
    expect(layout).toContain('width: "device-width"');
    expect(layout).toContain("initialScale: 1");
    expect(layout).not.toMatch(/userScalable\s*:\s*false/);
    expect(layout).not.toMatch(/maximumScale/);
    expect(layout).not.toContain("user-scalable=no");
    expect(layout).not.toContain("maximum-scale=1");
  });

  it("app-shell has no persistent CSS zoom / transform:scale wrapper (only decorative keyframes)", () => {
    // No `zoom:` property and no inline style transform:scale on a wrapper. Animations live in
    // @keyframes blocks (btyDrift/btyBloom/etc.) which are not a static viewport transform.
    expect(shell).not.toMatch(/\bzoom\s*:/);
    expect(shell).not.toMatch(/style=\{\{[^}]*transform:\s*["'`]?scale/);
  });
});
