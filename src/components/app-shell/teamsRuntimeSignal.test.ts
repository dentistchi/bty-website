import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveInitialAppTab } from "./initialTab";

/**
 * Slice Teams-Native System-Block Recovery V1 — the RUNTIME SIGNAL contract.
 *
 * The operator surface exists only inside Teams, and "inside Teams" must be something the shell was
 * TOLD, not something it worked out. Detection is what these forbid: a pathname, a user agent, an
 * iframe check or a viewport is right until someone opens BTY in a way nobody anticipated, and that
 * is the wrong foundation for deciding whether an admin action exists.
 */

const ROOT = process.cwd();
const code = (rel: string) =>
  readFileSync(join(ROOT, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SHELL = code("src/components/app-shell/BtyDailyAppShell.tsx");
const TEAMS = code("src/components/teams/TeamsTabShell.tsx");
const OPS = code("src/components/app-shell/TeamsPracticeRecoveryOperations.tsx");

describe("E — the Teams shell states the runtime", () => {
  it("passes runtime=\"teams\" to the app shell", () => {
    expect(TEAMS).toMatch(/<BtyDailyAppShell[\s\S]{0,400}runtime="teams"/);
  });
});

describe("F — nothing else becomes Teams implicitly", () => {
  it("the prop defaults to web", () => {
    expect(SHELL).toMatch(/runtime = "web"/);
    expect(SHELL).toMatch(/runtime\?: "web" \| "teams"/);
  });

  it("no other caller passes a runtime", () => {
    for (const rel of [
      "src/app/[locale]/app/page.tsx",
      "src/app/[locale]/app/AppClient.tsx",
    ]) {
      let src = "";
      try { src = code(rel); } catch { continue; }
      expect(src, rel).not.toMatch(/runtime=/);
    }
  });

  it("the runtime is never derived from the environment", () => {
    /*
      The GATE, not the whole file: anchored on the conditional itself, because the shell legitimately
      reads `location.pathname` elsewhere for unrelated reasons and a file-wide search would prove
      nothing about how the runtime is decided.
    */
    const at = SHELL.indexOf('runtime === "teams"');
    expect(at).toBeGreaterThan(-1);
    const gate = SHELL.slice(at, at + 200);
    for (const inference of ["location.pathname", "navigator.userAgent", "window.self", "window.top", "innerWidth", "matchMedia"]) {
      expect(gate, inference).not.toContain(inference);
    }
    expect(SHELL).toMatch(/runtime === "teams"/);
  });

  it("the operator component itself detects nothing", () => {
    for (const inference of ["pathname", "userAgent", "window.top", "innerWidth", "matchMedia", "isInsideTeams"]) {
      expect(OPS, inference).not.toContain(inference);
    }
  });
});

describe("C — the web shell never renders the operator surface, and never asks", () => {
  it("the section is gated on the runtime prop, so a web render cannot reach the fetch", () => {
    expect(SHELL).toMatch(/runtime === "teams" \? \(\s*<TeamsPracticeRecoveryOperations/);
  });

  it("the discovery fetch lives only inside the component, never in the shell", () => {
    expect(SHELL).not.toContain("/api/admin/practice-generation/recover-system-block");
    expect(OPS).toContain("/api/admin/practice-generation/recover-system-block");
  });
});

describe("N/O — navigation is untouched", () => {
  it("no fifth tab: the four tabs are unchanged", () => {
    const tabs = code("src/components/app-shell/initialTab.ts");
    expect(tabs).toMatch(/\["today", "learn", "practice", "me"\]/);
    expect(resolveInitialAppTab("?tab=today")).toBe("today");
    expect(resolveInitialAppTab("?tab=me")).toBe("me");
    // An admin tab has never existed and must not start now.
    expect(resolveInitialAppTab("?tab=admin")).toBeNull();
    expect(resolveInitialAppTab("?tab=operations")).toBeNull();
  });

  it("the tab bar gained nothing", () => {
    const bar = code("src/components/app-shell/AppTabBar.tsx");
    for (const word of ["admin", "operations", "recovery"]) {
      expect(bar.toLowerCase(), word).not.toContain(word);
    }
  });

  it("no legacy /admin page is linked from the shell", () => {
    expect(SHELL).not.toMatch(/\/admin[/"']/);
    expect(OPS).not.toMatch(/\/admin\/(?!practice-generation)/);
  });

  it("the surface sits inside Me, not as its own destination", () => {
    const me = SHELL.slice(SHELL.indexOf('data-testid="me-home"'));
    expect(me).toContain("TeamsPracticeRecoveryOperations");
  });
});
