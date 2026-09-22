/** @vitest-environment jsdom */
/** @vitest-environment-options { "url": "https://arena.btydaily.com/teams" } */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { installTeamsFrameContainment } from "./teamsTabTransport";

/**
 * Slice No-Browser-Escape V1 — THE PRODUCT RULE, asserted as behaviour.
 *
 *   Inside BTY in Teams, a BTY-owned destination must never resolve to browser-opening transport.
 *   Third-party content still may.
 *
 * These assert the CONTRACT (what transport a destination resolves to), not the implementation.
 * Every case below is one the device matrix will re-check by hand.
 */

let uninstall: (() => void) | null = null;
let openExternally: ReturnType<typeof vi.fn>;
let applyInShell: ReturnType<typeof vi.fn>;

function install(shellHandler: ((search: string) => boolean) | undefined = undefined) {
  openExternally = vi.fn();
  applyInShell = vi.fn(shellHandler ?? (() => true));
  uninstall = installTeamsFrameContainment(openExternally, applyInShell);
}

/** Render an anchor and click it exactly as a person would. */
function clickAnchor(href: string, target?: string) {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  if (target) a.setAttribute("target", target);
  a.textContent = "go";
  document.body.appendChild(a);
  a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  return a;
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  uninstall?.();
  uninstall = null;
  vi.restoreAllMocks();
});

describe("BTY_INTERNAL destinations never reach browser transport", () => {
  it("the device-proven defect: View my private reflection in Center stays inside BTY", () => {
    install();
    clickAnchor("/ko/app?tab=center&view=reflections&entry=abc");
    expect(openExternally).not.toHaveBeenCalled();
    expect(applyInShell).toHaveBeenCalledWith("?tab=center&view=reflections&entry=abc");
  });

  it("every shell tab and cross-navigation stays inside BTY", () => {
    for (const href of [
      "/ko/app?tab=today",
      "/ko/app?tab=learn",
      "/ko/app?tab=practice",
      "/ko/app?tab=me",
      "/ko/app?tab=center&entry=x",
      "/ko/app?tab=foundry&view=my-learning",
      "/en/app?tab=today&actionReview=c1",
    ]) {
      install();
      clickAnchor(href);
      expect(openExternally, href).not.toHaveBeenCalled();
      uninstall?.();
    }
  });

  it("My Learning → follow-up and Training/Continue destinations stay inside BTY", () => {
    install();
    clickAnchor("/ko/app?tab=foundry&followup=f1");
    clickAnchor("/ko/app?tab=learn&training=t1");
    expect(openExternally).not.toHaveBeenCalled();
    expect(applyInShell).toHaveBeenCalledTimes(2);
  });
});

describe("EXTERNAL_CONTENT may still leave", () => {
  it("third-party content opens externally", () => {
    install();
    clickAnchor("https://example.com/article");
    expect(openExternally).toHaveBeenCalledWith("https://example.com/article");
    expect(applyInShell).not.toHaveBeenCalled();
  });

  it("a link the person explicitly opened elsewhere is left alone entirely", () => {
    install();
    clickAnchor("https://example.com/article", "_blank");
    expect(openExternally).not.toHaveBeenCalled();
    expect(applyInShell).not.toHaveBeenCalled();
  });
});

describe("the honest cases", () => {
  it("a BTY page with no in-shell representation still opens outside, rather than blanking the tab", () => {
    install();
    clickAnchor("/ko/bty-arena/play/resolve");
    expect(applyInShell).not.toHaveBeenCalled();
    expect(openExternally).toHaveBeenCalledWith("https://arena.btydaily.com/ko/bty-arena/play/resolve");
  });

  it("a click NEVER does nothing: a shell handler that fails hands the link back to the opener", () => {
    install(() => false);
    clickAnchor("/ko/app?tab=center&entry=abc");
    expect(applyInShell).toHaveBeenCalled();
    expect(openExternally).toHaveBeenCalledWith("https://arena.btydaily.com/ko/app?tab=center&entry=abc");
  });

  it("an in-page anchor is not navigation and is not intercepted", () => {
    install();
    const a = clickAnchor("#section");
    expect(openExternally).not.toHaveBeenCalled();
    expect(applyInShell).not.toHaveBeenCalled();
    expect(a.getAttribute("href")).toBe("#section");
  });

  it("without a shell handler the old behaviour is preserved, so non-Teams callers are unaffected", () => {
    openExternally = vi.fn();
    uninstall = installTeamsFrameContainment(openExternally);
    clickAnchor("/ko/app?tab=center");
    expect(openExternally).toHaveBeenCalled();
  });
});
