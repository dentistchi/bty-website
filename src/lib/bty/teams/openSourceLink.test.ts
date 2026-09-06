import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { planOpenSourceLink } from "@/domain/teams/openSourceLink";
import { openSourceLink } from "./openSourceLink";

/**
 * "Open in Teams" — return to the exact message, from whichever host BTY is running in.
 *
 * ★ THE DEVICE FAILURE (2026-09-04, real participant iPhone). Saved for later → Open in Teams left
 * the tab, landed on arena.btydaily.com, and showed "BTY couldn't open yet." / "Open BTY".
 *
 * The stored URL was never at fault: capture `a2945cd1` holds the canonical Microsoft form. The row
 * rendered `<a href={sourceUrl} target="_blank">`, and the Teams frame containment — which exists
 * precisely to route off-origin links through the host — skips `_blank` links as "already leaving,
 * on purpose". So `app.openLink` never ran, the off-domain navigation could not be honoured against
 * the manifest's single `validDomains` entry, and the tab was bounced back to its own contentUrl.
 */

const CANONICAL =
  'https://teams.microsoft.com/l/message/19:71ca0b0a-cb4b-4a43-9673-363dcf9d22dd_f5767307-f693-4f8c-8e6c-5fb8a256b895@unq.gbl.spaces/1788535572760?context=%7B%22contextType%22:%22chat%22%7D';

describe("★ 1+2. inside Teams, the host is asked — with the EXACT stored URL", () => {
  it("★ 1. app.openLink receives the stored URL, byte for byte", async () => {
    const openInTeams = vi.fn(async (_url: string) => {});
    const ok = await openSourceLink(CANONICAL, { teamsHosted: true, openInTeams });
    expect(ok).toBe(true);
    expect(openInTeams).toHaveBeenCalledWith(CANONICAL);
    expect(openInTeams.mock.calls[0][0]).toBe(CANONICAL);
  });

  it("★ 2. NO arena.btydaily.com anywhere in the destination, and no browser open", async () => {
    const openInTeams = vi.fn(async (_url: string) => {});
    const openInBrowser = vi.fn();
    await openSourceLink(CANONICAL, { teamsHosted: true, openInTeams, openInBrowser });
    const passed = String(openInTeams.mock.calls[0][0]);
    /*
      Assert on the HOST, not on substrings: "https://teams.microsoft.com" contains "/teams" via
      its own "//", so a naive contains-check fails a perfectly correct destination. What must
      never happen is the destination being routed through BTY's own origin.
    */
    const dest = new URL(passed);
    expect(dest.host).toBe("teams.microsoft.com");
    expect(dest.host).not.toContain("btydaily");
    expect(passed).not.toContain("arena.btydaily.com");
    expect(dest.pathname.startsWith("/l/message/")).toBe(true);
    expect(openInBrowser).not.toHaveBeenCalled();
  });

  it("★ 6. a host rejection is reported, and nothing falls back to a _blank navigation", async () => {
    const openInBrowser = vi.fn();
    const ok = await openSourceLink(CANONICAL, {
      teamsHosted: true,
      openInTeams: async () => { throw new Error("host refused"); },
      openInBrowser,
    });
    expect(ok).toBe(false);
    // The fallback IS the defect: an off-domain _blank inside the tab is what bounced it.
    expect(openInBrowser).not.toHaveBeenCalled();
  });
});

describe("★ 3. outside Teams, a direct navigation — TeamsJS is not required", () => {
  it("opens the same URL directly and never touches TeamsJS", async () => {
    const openInBrowser = vi.fn();
    const openInTeams = vi.fn(async (_url: string) => {});
    const ok = await openSourceLink(CANONICAL, { teamsHosted: false, openInBrowser, openInTeams });
    expect(ok).toBe(true);
    expect(openInBrowser).toHaveBeenCalledWith(CANONICAL);
    expect(openInTeams).not.toHaveBeenCalled();
  });
});

describe("★ 4+5. what must not open", () => {
  it("★ 4. a null or blank source URL opens nothing", async () => {
    for (const bad of [null, undefined, "", "   "]) {
      const openInTeams = vi.fn(async (_url: string) => {});
      expect(await openSourceLink(bad, { teamsHosted: true, openInTeams })).toBe(false);
      expect(openInTeams).not.toHaveBeenCalled();
    }
  });

  it("★ 5. an unsafe scheme is refused in BOTH hosts — the existing allow-list decides", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "not a url"]) {
      for (const teamsHosted of [true, false]) {
        const openInTeams = vi.fn(async (_url: string) => {});
        const openInBrowser = vi.fn();
        expect(await openSourceLink(bad, { teamsHosted, openInTeams, openInBrowser }), bad).toBe(false);
        expect(openInTeams).not.toHaveBeenCalled();
        expect(openInBrowser).not.toHaveBeenCalled();
      }
    }
  });

  it("the allow-list is the CAPTURE one, not a second opinion", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/domain/teams/openSourceLink.ts"), "utf8");
    expect(src).toContain('from "@/domain/action-capture/captureSource"');
    expect(src).toContain("safeSourceUrl");
    // msteams: is already allowed by that list and must keep working.
    expect(planOpenSourceLink("msteams:/l/message/x/y", { teamsHosted: true }).mode).toBe("teams");
  });
});

describe("★ the plan is pure and passes the URL through", () => {
  it("never rewrites, wraps or rebuilds the destination", () => {
    for (const teamsHosted of [true, false]) {
      const plan = planOpenSourceLink(CANONICAL, { teamsHosted });
      expect(plan.mode).toBe(teamsHosted ? "teams" : "browser");
      if (plan.mode !== "refuse") expect(plan.url).toBe(CANONICAL);
    }
  });

  it("distinguishes a missing URL from an unsafe one", () => {
    expect(planOpenSourceLink(null, { teamsHosted: true })).toEqual({ mode: "refuse", reason: "no_url" });
    expect(planOpenSourceLink("javascript:x", { teamsHosted: true })).toEqual({ mode: "refuse", reason: "unsafe_url" });
  });
});

describe("★ 6+7. the surface keeps the person where they are", () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const SAVED = read("src/components/app-shell/SavedForLater.tsx");
  /*
    CODE, not comments. The component's own prose NAMES the bootstrap strings precisely in order to
    forbid them, and a guard that reads comments fails on the documentation of its own rule.
  */
  const SAVED_CODE = SAVED.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("★ REGRESSION: the open control is a command, not a `_blank` anchor", () => {
    // Against the pre-fix component both of these fail: it rendered <a href target="_blank">.
    expect(SAVED).toContain('data-testid="saved-open"');
    expect(SAVED).toContain("openSourceLink(it.sourceUrl)");
    expect(SAVED).not.toMatch(/href=\{it\.sourceUrl\}/);
    expect(SAVED).not.toMatch(/target="_blank"[\s\S]{0,80}saved-open/);
  });

  it("★ 6. a failed open shows a truthful retry and never the bootstrap error", () => {
    expect(SAVED).toContain("Couldn't open this message in Teams.");
    expect(SAVED).toContain("Open again");
    expect(SAVED).toContain('data-testid="saved-open-retry"');
    // They are already inside BTY; "Open BTY" belongs to the tab bootstrap, never here.
    expect(SAVED_CODE).not.toContain("Open BTY");
    expect(SAVED_CODE).not.toContain("BTY couldn't open yet");
  });

  it("failure is per-row, so one card cannot blank the lane", () => {
    expect(SAVED).toContain("const [openFailed, setOpenFailed] = useState(false);");
  });

  it("★ 7. collapsed and expanded rows render the SAME card, so both use this opener", () => {
    // One CaptureCard definition, used by the solo row and inside an expanded conversation.
    expect(SAVED.match(/function CaptureCard\(/g)?.length).toBe(1);
    expect(SAVED.match(/data-testid="saved-open"/g)?.length).toBe(1);
  });

  it("the Korean surface has the same truthful failure line", () => {
    expect(SAVED).toContain("이 메시지를 Teams에서 열지 못했습니다.");
    expect(SAVED).toContain("다시 열기");
  });
});

describe("★ 8+9+10. nothing else moved", () => {
  const code = (p: string) =>
    fs.readFileSync(path.join(process.cwd(), p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("★ 8. Soon/Later still call the same canonical choose()", () => {
    const saved = code("src/components/app-shell/SavedForLater.tsx");
    expect(saved).toContain("choose(it.id, choice)");
    expect(saved).toContain('data-testid="saved-triage-controls"');
  });

  it("★ 9. participant authority is untouched", () => {
    const invoke = code("src/app/api/bty/teams/invoke/route.ts");
    expect(invoke).toContain("isCollaborationParticipant");
    expect(invoke).not.toMatch(/await canTrackWithBty\(/);
  });

  it("★ 10. the Save write and the saved-lane read are untouched", () => {
    const svc = code("src/lib/bty/action-capture/ensureActionCapture.server.ts");
    expect(svc).toContain('.eq("status", "captured")');
    expect(svc).toContain('.not("saved_at", "is", null)');
    const mine = code("src/app/api/bty/action-capture/mine/route.ts");
    expect(mine).toContain("requireUser");
    expect(mine).not.toContain("requireConsentedUser");
  });

  it("no database or API change was needed", () => {
    // This slice is client-side navigation only: the stored URL was already correct.
    const migrations = fs
      .readdirSync(path.join(process.cwd(), "supabase/migrations"))
      .filter((f) => /^\d{14}/.test(f));
    // Compare the 14-digit PREFIX. Comparing whole filenames makes 20260913000000_x.sql "greater
    // than" 20260913000000 and the guard reports the newest applied migration as a new one.
    //
    // Re-anchored to 20260913 (Today dismissal V1). Bumping it is the DELIBERATE act this guard
    // asks for: it still fails the moment SQL appears that nobody moved this line for, which is
    // the smuggled migration it exists to catch. What it never claimed is that the repository
    // would stop growing.
    expect(migrations.filter((f) => f.slice(0, 14) > "20260913000000")).toEqual([]);
  });
});
