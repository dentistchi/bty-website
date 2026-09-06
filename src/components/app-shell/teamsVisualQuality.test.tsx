/** @vitest-environment jsdom */
/**
 * TEAMS MOBILE VISUAL QUALITY — the repair, held to the numbers that justified it. Slice TQ-3.
 *
 * ★ WHAT THE FOUNDER'S REAL DEVICE RUN ESTABLISHED, AND THEREFORE RULED OUT.
 *
 * Inside the real Teams tab on iPhone: viewport 440 × 773 of a 956pt screen, `visualViewport`
 * scale 1, offsetTop/offsetLeft 0, devicePixelRatio 3, NO transform, NO css zoom, NO filter, NO
 * backdrop-filter, NO horizontal overflow, html/body zoom 1, and every `env(safe-area-inset-*)`
 * resolving to 0.
 *
 * At DPR 3 with scale 1 and no transform anywhere, nothing on the screen can be physically blurry.
 * "Soft" was therefore never a rasterisation problem — it was CONTRAST. And "clipped" was never a
 * notch problem — Teams hands BTY a viewport that already excludes its own chrome.
 *
 * So these tests hold two things: the repair addressed contrast and rhythm, and it did NOT do any
 * of the things the measurement forbade — no invented safe-area, no scaling, no viewport hack.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SHELL = "src/components/app-shell/BtyDailyAppShell.tsx";
const TEAMS_LAYOUT = "src/app/teams/layout.tsx";
const PROBE = "src/components/teams/TeamsRuntimeProbe.tsx";

/* ─────────────────────────  A. what the measurement forbade  ───────────────────────── */

describe("★ the repair does NOT do what the runtime measurement ruled out", () => {
  const shell = code(SHELL);

  it("no transform, scale or css zoom is introduced on the app root", () => {
    const root = shell.slice(shell.indexOf("data-bty-app-root"), shell.indexOf("data-bty-app-root") + 400);
    expect(root).not.toMatch(/\bscale-\[?\d/);
    expect(root).not.toMatch(/\btransform\b/);
    expect(root).not.toMatch(/\bzoom\b/);
    expect(shell).toContain("h-[100dvh]"); // dvh is NOT replaced merely because of Teams
  });

  it("★ no FAKE safe-area is invented — the real inset is still the first term", () => {
    /*
      The floor is a `max()` whose first argument is the genuine inset. On any host where the inset
      is real (native, `viewportFit: cover`) the floor loses and the expression is byte-identical to
      what shipped before. Nothing here pretends a notch exists where the device says there is none.
    */
    expect(shell).toContain("max(env(safe-area-inset-top), var(--bty-host-top-floor, 0px))");
    // The fallback is zero: a host that declares nothing gets exactly today's behaviour.
    expect(shell).toContain("--bty-host-top-floor, 0px");
  });

  it("no viewport meta / initial-scale hack was added for Teams", () => {
    expect(code(TEAMS_LAYOUT)).not.toMatch(/initial-scale|user-scalable|viewport/i);
    expect(code(PROBE)).not.toMatch(/initial-scale|user-scalable/i);
  });
});

/* ─────────────────────────  B. host scoping  ───────────────────────── */

describe("★ the one host-specific value is declared ONLY where Teams is a certainty", () => {
  it("the Teams layout declares the top floor", () => {
    const t = code(TEAMS_LAYOUT);
    expect(t).toContain("--bty-host-top-floor");
    expect(t).toContain("TEAMS_HOST_TOP_FLOOR");
    expect(t).toContain('data-bty-teams-floor="1"'); // the existing navy floor is untouched
    expect(t).toContain('minHeight: "100dvh"');
  });

  it("★ standalone web / native / desktop never see it — no other file declares the variable", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|css)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) {
          const src = readFileSync(p, "utf8");
          // A DECLARATION, not the shell's `var(--bty-host-top-floor, 0px)` read.
          if (/--bty-host-top-floor"?\s*:/.test(src)) hits.push(p.slice(process.cwd().length + 1));
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits, "only the Teams-by-construction layout may set this").toEqual([TEAMS_LAYOUT]);
  });

  it("the shell itself does not branch on the host for this — it reads a variable", () => {
    // A runtime host check here would make every other host's rendering depend on Teams' existence.
    const around = code(SHELL).slice(code(SHELL).indexOf("data-bty-top-inset") - 200, code(SHELL).indexOf("data-bty-top-inset") + 300);
    expect(around).not.toContain("useTeamsHost");
    expect(around).not.toContain("isTeamsTabPath");
  });
});

/* ─────────────────────────  C. contrast — the actual softness cause  ───────────────────────── */

/** WCAG relative luminance / contrast against BTY navy #0B1F3A. */
const NAVY: [number, number, number] = [11, 31, 58];
const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrastOfWhiteAlpha(step: number): number {
  const a = step / 100;
  const fg: [number, number, number] = [0, 1, 2].map((i) => Math.round(a * 255 + (1 - a) * NAVY[i])) as [number, number, number];
  const [hi, lo] = [Math.max(lum(fg), lum(NAVY)), Math.min(lum(fg), lum(NAVY))];
  return (hi + 0.05) / (lo + 0.05);
}

describe("★ every muted text tier on the shell surfaces is legible against navy", () => {
  const files = readdirSync(join(process.cwd(), "src/components/app-shell"))
    .filter((f) => f.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(f));

  it("the contrast model matches the published WCAG numbers", () => {
    // Anchors, so a broken formula cannot quietly bless a failing palette.
    expect(contrastOfWhiteAlpha(100)).toBeCloseTo(16.52, 1);
    expect(contrastOfWhiteAlpha(40)).toBeCloseTo(3.73, 1);
    expect(contrastOfWhiteAlpha(50)).toBeCloseTo(5.04, 1);
  });

  it("★ no shell surface still uses a white text tier below WCAG AA (4.5:1)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = code(join("src/components/app-shell", f));
      for (const m of src.matchAll(/\btext-white\/(\d+)\b/g)) {
        const step = Number(m[1]);
        if (contrastOfWhiteAlpha(step) < 4.5) offenders.push(`${f}  text-white/${step}  (${contrastOfWhiteAlpha(step).toFixed(2)}:1)`);
      }
    }
    expect(
      offenders,
      "MEASURED: DPR 3, scale 1, no transform — nothing here can be blurry, so 'soft' was low " +
        "contrast. These tiers render below AA on #0B1F3A.\n  " + offenders.join("\n  "),
    ).toEqual([]);
  });

  it("the repair is a LIFT, not a flattening — a real hierarchy survives", () => {
    const steps = new Set<number>();
    for (const f of files) {
      for (const m of code(join("src/components/app-shell", f)).matchAll(/\btext-white\/(\d+)\b/g)) steps.add(Number(m[1]));
    }
    // Still several distinct tiers, and still clearly quieter than full white.
    expect(steps.size, "a single flat tier would be a redesign, not a contrast repair").toBeGreaterThanOrEqual(4);
    expect(Math.min(...steps), "muted must stay muted").toBeLessThanOrEqual(60);
  });

  it("BTY's navy/gold identity is untouched", () => {
    expect(read(SHELL)).toContain("#0B1F3A");
    expect(read(SHELL)).toContain("#C9A66B");
    expect(read("src/components/app-shell/AppTabBar.tsx")).toContain("#C9A66B");
  });
});

/* ─────────────────────────  D. the diagnostic selector defect  ───────────────────────── */

describe("★ the probe measures named product elements, never whatever it happens to find", () => {
  const probe = code(PROBE);

  it("uses explicit anchors for all four disputed measurements", () => {
    for (const a of ["[data-bty-app-root]", "[data-bty-bottom-nav]", "[data-bty-main-heading]", "[data-bty-app-header]", "[data-bty-top-inset]"]) {
      expect(probe, a).toContain(a);
    }
  });

  it("★ the generic selectors that produced the impossible reading are GONE", () => {
    // 224px "bottom nav" was the Me row list; y=20 "first heading" was whatever rendered first.
    expect(probe).not.toContain('querySelector("h1, h2")');
    expect(probe).not.toContain('parentElement?.querySelector("nav")');
    expect(probe).not.toContain('firstElementChild');
  });

  it("★ the overlay can never be measured — every lookup rejects its own subtree", () => {
    expect(probe).toContain("OVERLAY_ATTR");
    expect(probe).toContain("closest(`[${OVERLAY_ATTR}]`)");
    expect(probe).toContain("function pick(");
    // and every anchor goes through pick(), not a bare querySelector
    for (const a of ["[data-bty-app-root]", "[data-bty-bottom-nav]", "[data-bty-main-heading]"]) {
      expect(probe).toContain(`pick("${a}")`);
    }
  });

  it("the anchors exist on real product elements (the layout was not changed to suit the probe)", () => {
    expect(read(SHELL)).toContain('data-bty-app-root=""');
    expect(read(SHELL)).toContain('data-bty-top-inset=""');
    expect(read(SHELL)).toContain('data-bty-app-header=""');
    expect(read("src/components/app-shell/AppTabBar.tsx")).toContain('data-bty-bottom-nav=""');
    for (const f of ["MeThisWeek", "LearnHeader", "PracticeLanding"]) {
      expect(read(`src/components/app-shell/${f}.tsx`), f).toContain('data-bty-main-heading=""');
    }
  });
});

/* ─────────────────────────  E. the Teams package icons  ───────────────────────── */

/** PNG IHDR: width and height are big-endian uint32 at byte offsets 16 and 20. */
function pngSize(rel: string): { w: number; h: number } {
  const b = readFileSync(join(process.cwd(), rel));
  expect(b.subarray(1, 4).toString("ascii"), `${rel} is not a PNG`).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("★ the Teams app package icons meet Microsoft's current shape rules", () => {
  const manifest = JSON.parse(read("teams/manifest/manifest.json")) as { icons: { color: string; outline: string } };

  it("the manifest references both icons by the filenames that exist", () => {
    expect(manifest.icons.color).toBe("color.png");
    /*
      The outline icon's FILENAME is deliberately not pinned here (Slice TQ-4.7B renamed it to
      isolate a path-keyed icon cache). What matters at this layer is that the manifest declares an
      outline icon and that the file it names actually exists — a manifest referencing a missing
      asset is the failure this guards.
    */
    expect(typeof manifest.icons.outline).toBe("string");
    expect(manifest.icons.outline.length).toBeGreaterThan(0);
    expect(statSync(join(process.cwd(), "teams/manifest/color.png")).size).toBeGreaterThan(0);
    expect(statSync(join(process.cwd(), "teams/manifest", manifest.icons.outline)).size).toBeGreaterThan(0);
  });

  it("color is a square 192 × 192 PNG", () => {
    const { w, h } = pngSize("teams/manifest/color.png");
    expect({ w, h }).toEqual({ w: 192, h: 192 });
  });

  it("outline is a square 32 × 32 PNG", () => {
    const declared = (JSON.parse(read("teams/manifest/manifest.json")) as { icons: { outline: string } }).icons.outline;
    const { w, h } = pngSize(join("teams/manifest", declared));
    expect({ w, h }).toEqual({ w: 32, h: 32 });
  });
});

/* ─────────────────────────  F. nothing else moved  ───────────────────────── */

describe("★ authority, Save / Track and Open in Teams are untouched by a visual slice", () => {
  it("the participant floor still governs Save and Track, above the command switch", () => {
    const invoke = code("src/app/api/bty/teams/invoke/route.ts");
    // The floor is applied ONCE, before the command is even read — that ordering is the contract.
    expect(invoke).toContain("isCollaborationParticipant");
    // Compared against the DISPATCH branch, not the earlier parse-failure log line that also
    // reads the command id purely to name it in an error.
    expect(invoke.indexOf("isCollaborationParticipant({"))
      .toBeLessThan(invoke.indexOf("if (readCommandId(activity) === TEAMS_COMMAND_TRACK)"));
    // The ids themselves live in the pure domain module, and both still exist.
    const ids = code("src/domain/teams/invokeActivity.ts");
    expect(ids).toContain('TEAMS_COMMAND_SAVE = "saveToBty"');
    expect(ids).toContain("TEAMS_COMMAND_TRACK");
  });

  it("the temporary platform-admin authority route is GONE, and admin authority is not", () => {
    /*
      TQ-2 added GET /api/bty/authority/platform-admin for ONE reason: the in-tab diagnostic row
      had to ask the server whether the person looking was an admin. That row is removed with this
      slice, the endpoint had no other consumer, and an endpoint nobody calls is a surface with no
      reason to exist.

      Removing a read-only "am I an admin" answer is not a change to admin AUTHORITY: the canonical
      resolver still reads the grant table, and every route that actually gates on it is untouched.
      Held in full by `teamsDiagnosticsRemoved.test.tsx`.
    */
    expect(existsSync(join(process.cwd(), "src/app/api/bty/authority/platform-admin/route.ts"))).toBe(false);
    expect(code("src/lib/bty/authority/platformAdmin.server.ts")).toContain("bty_platform_admin_grants");
  });

  it("the Teams tab bootstrap and its ?diag=1 test entry still stand", () => {
    const tab = code("src/components/teams/TeamsTabShell.tsx");
    expect(tab).toContain("/api/auth/teams-bootstrap");
    expect(tab).toContain('get("diag") === "1"');
    expect(tab).toMatch(/<BtyDailyAppShell\s+locale=\{phase\.locale\}/);
  });

  it("the manifest's two message actions and the tab contentUrl are unchanged", () => {
    const m = JSON.parse(read("teams/manifest/manifest.json")) as {
      composeExtensions: { commands: { id: string }[] }[];
      staticTabs: { entityId?: string; contentUrl?: string }[];
    };
    expect(m.composeExtensions[0].commands.map((c) => c.id)).toEqual(["saveToBty", "trackWithBty"]);
    expect(m.staticTabs[0].contentUrl).toBe("https://arena.btydaily.com/teams");
  });

  it("BTY does not draw a second top bar under the Teams one", () => {
    // Avoiding a duplicated host header: the shell adds spacing, never chrome.
    const shell = code(SHELL);
    const inset = shell.slice(shell.indexOf("data-bty-top-inset"), shell.indexOf("data-bty-top-inset") + 260);
    expect(inset).toContain("aria-hidden");
    expect(inset).not.toMatch(/<h1|<header|BTY<\//);
  });
});
