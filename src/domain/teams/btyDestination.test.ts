import { describe, expect, it } from "vitest";
import { classifyBtyHref, leavesTeamsDocument, shellSearchFor } from "./btyDestination";
import { buildPersonalAppLink } from "./personalAppLink";

const ORIGIN = "https://arena.btydaily.com";

/**
 * Slice No-Browser-Escape V1 — the NAVIGATION CONTRACT, not its implementation.
 *
 * The device-proven defect was a classification failure: "this href leaves /teams" was treated as
 * "this person wants a browser". These tests pin the distinction that fixes it.
 */
describe("classifyBtyHref", () => {
  it("calls the Center reflection deep link a SHELL destination — the device-proven defect", () => {
    expect(classifyBtyHref("/ko/app?tab=center&view=reflections&entry=abc", ORIGIN)).toBe("shell");
    expect(classifyBtyHref("/en/app?tab=center&entry=abc", ORIGIN)).toBe("shell");
  });

  it("calls every in-shell product destination a shell destination", () => {
    for (const href of [
      "/ko/app?tab=today",
      "/ko/app?tab=learn",
      "/ko/app?tab=practice",
      "/ko/app?tab=me",
      "/ko/app?tab=foundry&view=my-learning",
      "/ko/app?tab=foundry&followup=f1",
      "/ko/app?tab=today&actionReview=c1",
      "/ko/app?tab=practice&fieldAction=c1",
    ]) {
      expect(classifyBtyHref(href, ORIGIN), href).toBe("shell");
    }
  });

  it("treats the Teams tab's own document as a shell destination", () => {
    expect(classifyBtyHref("/teams", ORIGIN)).toBe("shell");
    expect(classifyBtyHref("/teams/link", ORIGIN)).toBe("shell");
    expect(classifyBtyHref("/teams?tab=me", ORIGIN)).toBe("shell");
  });

  it("names a BTY page with no in-shell representation rather than calling it third-party", () => {
    expect(classifyBtyHref("/ko/bty-arena/play/resolve", ORIGIN)).toBe("bty_unframed");
    expect(classifyBtyHref("/ko/center", ORIGIN)).toBe("bty_unframed");
    expect(classifyBtyHref("/ko/bty/login", ORIGIN)).toBe("bty_unframed");
  });

  it("calls somebody else's content external", () => {
    expect(classifyBtyHref("https://example.com/article", ORIGIN)).toBe("external");
    expect(classifyBtyHref("https://teams.microsoft.com/l/chat/0/0?users=a@b.com", ORIGIN)).toBe("external");
  });

  it("leaves non-navigating hrefs completely alone", () => {
    for (const href of ["", "#top", "mailto:a@b.com", "tel:+123", "javascript:void 0"]) {
      expect(classifyBtyHref(href, ORIGIN), href).toBeNull();
    }
  });
});

describe("shellSearchFor", () => {
  it("carries the destination's query across, which IS the shell's vocabulary", () => {
    expect(shellSearchFor("/ko/app?tab=center&entry=abc", ORIGIN)).toBe("?tab=center&entry=abc");
    expect(shellSearchFor("/ko/app", ORIGIN)).toBe("");
  });

  it("refuses to describe anything that is not a shell destination", () => {
    expect(shellSearchFor("/ko/bty-arena/play/resolve", ORIGIN)).toBeNull();
    expect(shellSearchFor("https://example.com/x?tab=center", ORIGIN)).toBeNull();
  });
});

describe("leavesTeamsDocument — deliberately a DIFFERENT question", () => {
  it("is true for a shell destination, which is why the two must not be conflated", () => {
    // It leaves the /teams document as an href, and yet must NOT open a browser.
    expect(leavesTeamsDocument("/ko/app?tab=center", ORIGIN)).toBe(true);
    expect(classifyBtyHref("/ko/app?tab=center", ORIGIN)).toBe("shell");
  });

  it("is false while the destination stays on /teams", () => {
    expect(leavesTeamsDocument("/teams?tab=me", ORIGIN)).toBe(false);
  });
});

describe("buildPersonalAppLink — the bot opens the APP, not a web page", () => {
  it("returns a Teams personal-app entity link, never a bare BTY web address", () => {
    const link = buildPersonalAppLink({ origin: ORIGIN, label: "BTY" });
    expect(link).toBeTruthy();
    expect(link!.startsWith("https://teams.microsoft.com/l/entity/")).toBe(true);
    expect(link).not.toBe(`${ORIGIN}/`);
  });

  it("carries a shell destination through BOTH transports, with the same query", () => {
    const link = buildPersonalAppLink({ origin: ORIGIN, search: "?tab=center&entry=abc" })!;
    const params = new URL(link).searchParams;
    expect(params.get("webUrl")).toBe(`${ORIGIN}/teams?tab=center&entry=abc`);
    expect(JSON.parse(params.get("context")!)).toEqual({ subEntityId: "q:tab=center&entry=abc" });
  });

  it("omits an empty context rather than naming a subpage that does not exist", () => {
    const link = buildPersonalAppLink({ origin: ORIGIN })!;
    const params = new URL(link).searchParams;
    expect(params.get("context")).toBeNull();
    expect(params.get("webUrl")).toBe(`${ORIGIN}/teams`);
  });

  it("refuses a non-https origin or a malformed search instead of emitting a broken link", () => {
    expect(buildPersonalAppLink({ origin: "http://arena.btydaily.com" })).toBeNull();
    expect(buildPersonalAppLink({ origin: ORIGIN, search: "tab=center" })).toBeNull();
  });
});
