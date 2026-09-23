import { describe, expect, it } from "vitest";
import { classifyBtyHref, decodeShellSubEntityId, encodeShellSubEntityId, leavesTeamsDocument, shellSearchFor } from "./btyDestination";

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

describe("the shell-destination codec", () => {
  /*
    The `q:` prefix remains, and remains tested, although BTY no longer MINTS a personal-tab deep
    link: `subPageId` is host-supplied, so the shell must still be able to tell a shell destination
    from a signed training target — and must still refuse a crafted one.
  */
  it("round-trips a shell destination", () => {
    const search = "?tab=learn&view=my-learning&entry=e1";
    expect(decodeShellSubEntityId(encodeShellSubEntityId(search)!)).toBe(search);
  });

  it("refuses a training target, so each kind is read by what understands it", () => {
    expect(decodeShellSubEntityId("btyt1:abc.def")).toBeNull();
    expect(decodeShellSubEntityId("")).toBeNull();
    expect(decodeShellSubEntityId(null)).toBeNull();
    expect(decodeShellSubEntityId(42)).toBeNull();
  });

  it("can never become a navigation target", () => {
    for (const crafted of [
      "q:https://evil.example.com",
      "q:tab=learn&x=a/b",
      "q:tab=learn#frag",
      "q:tab=learn b",
      "q://evil",
    ]) {
      expect(decodeShellSubEntityId(crafted), crafted).toBeNull();
    }
  });

  it("encodes nothing when there is nothing to say", () => {
    expect(encodeShellSubEntityId("")).toBeNull();
    expect(encodeShellSubEntityId("?")).toBeNull();
    expect(encodeShellSubEntityId("?tab=me")).toBe("q:tab=me");
  });
});
