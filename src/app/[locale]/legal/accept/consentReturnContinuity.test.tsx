/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AcceptClient } from "./AcceptClient";
import { ACTIVE_CONSENT_VERSION, activeConsentDocument } from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";

/** The real active document identity — the same values the server page hands the client. */
const ACTIVE_EN_FINGERPRINT = consentDocumentFingerprint(activeConsentDocument("en-US")!);
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";

/**
 * SLICE 3.2R-R8E — ACCEPTING CONSENT THREW AWAY WHERE THE LEARNER WAS GOING.
 *
 * A learner who had not yet accepted consent tapped "View my private reflection in Center",
 * met the notice, accepted it, and landed on My Learning — not on the reflection they asked
 * for. Once consent was already stored the same deep link worked, so nothing was wrong with
 * Center, the entry id, or the shell's focus.
 *
 * TWO DEFECTS, ONE SCREEN.
 *
 * 1. CONTINUITY. `router.push(returnUrl)` started a client transition and `router.refresh()`
 *    immediately re-fetched the route still rendered underneath — the consent page, which now
 *    sees consent present and server-redirects to the same destination. Two navigations to one
 *    URL. Between them the app shell does what it always does: consume the deep link on mount
 *    and ERASE it with `history.replaceState`. Whichever navigation arrived second therefore
 *    landed on a bare `/{locale}/app` and fell back to the default surface.
 *
 * 2. OPEN REDIRECT. `returnUrl.startsWith("/")` accepts `//evil.com` — protocol-relative, off
 *    origin, and reached through the one screen every authenticated user is forced through.
 *    Two safe-return utilities already existed in this repository and this page used neither.
 *
 * The middleware end was never at fault: it sets `return` to `pathname + search`, so the query
 * arrives intact. The loss was entirely on the way back out.
 */

const DEEP_LINK = "/en/app?tab=center&view=reflections&entry=2ea834ab-a7ea-48c1-ba71-0b5c06e79b0c";

/** jsdom refuses real navigation; capture the target instead. */
function captureNavigation() {
  const calls: string[] = [];
  const original = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...original, assign: (u: string) => calls.push(u), replace: (u: string) => calls.push(u) },
  });
  return {
    calls,
    restore: () => Object.defineProperty(window, "location", { configurable: true, writable: true, value: original }),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("[3.2R-R8E] A/B/C — the destination survives consent", () => {
  it("C — accepting resumes the EXACT deep link, query and entry id intact", async () => {
    const nav = captureNavigation();
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    render(<AcceptClient
        locale="en"
        returnUrl={DEEP_LINK}
        consentVersion={ACTIVE_CONSENT_VERSION}
        consentLocale="en-US"
        documentFingerprint={ACTIVE_EN_FINGERPRINT}
      />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(nav.calls.length).toBe(1));
    // A/B — nothing is dropped: tab, view AND the progress id all arrive.
    expect(nav.calls[0]).toBe(DEEP_LINK);
    expect(nav.calls[0]).toContain("entry=2ea834ab-a7ea-48c1-ba71-0b5c06e79b0c");

    // H — accepted exactly once. I — one navigation, so nothing can race the shell's
    // consume-and-strip and land on a bare URL.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    nav.restore();
  });

  it("H — a double tap cannot post consent twice", async () => {
    const nav = captureNavigation();
    let resolve: (v: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    render(<AcceptClient
        locale="en"
        returnUrl={DEEP_LINK}
        consentVersion={ACTIVE_CONSENT_VERSION}
        consentLocale="en-US"
        documentFingerprint={ACTIVE_EN_FINGERPRINT}
      />);
    fireEvent.click(screen.getByRole("checkbox"));
    const submit = screen.getByRole("button");
    fireEvent.click(submit);
    // The control disables itself while the request is in flight.
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await waitFor(() => expect(nav.calls.length).toBe(1));
    nav.restore();
  });

  it("a failed acceptance navigates nowhere — the learner stays and sees the error", async () => {
    const nav = captureNavigation();
    // @ts-expect-error test shim
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) }));
    render(<AcceptClient
        locale="en"
        returnUrl={DEEP_LINK}
        consentVersion={ACTIVE_CONSENT_VERSION}
        consentLocale="en-US"
        documentFingerprint={ACTIVE_EN_FINGERPRINT}
      />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(nav.calls, "no navigation on failure").toEqual([]);
    nav.restore();
  });

  it("the push/refresh pair is gone — a single navigation is the whole mechanism", () => {
    /*
      Asserted on source because the defect was the PAIR, not either call. A test that only
      checked the final destination would pass against the broken version too: both navigations
      targeted the same URL, and the damage came from the shell stripping the query between them.
    */
    const fs = require("node:fs") as typeof import("node:fs");
    const src = fs.readFileSync("src/app/[locale]/legal/accept/AcceptClient.tsx", "utf8");
    // Match the CALLS, not the names: the comment above the fix explains what router.push and
    // router.refresh used to do here, and prose is not behaviour.
    expect(src.includes("router.push(")).toBe(false);
    expect(src.includes("router.refresh(")).toBe(false);
    expect(src.includes("window.location.assign(returnUrl)")).toBe(true);
  });
});

describe("[3.2R-R8E] E/F/G — the return destination cannot leave the app", () => {
  it("E/F — an external or protocol-relative return is refused", () => {
    for (const hostile of [
      "//evil.com",              // protocol-relative — starts with "/" and leaves the origin
      "//evil.com/steal",
      "https://evil.com",
      "http://evil.com/x",
      "javascript:alert(1)",
      "/\\evil.com",             // backslash smuggling
      "/en/app?next=//evil.com", // contains "//" anywhere
    ]) {
      expect(sanitizeNextForRedirect(hostile, { locale: "en" }), hostile).toBe("/en/bty");
    }
  });

  it("G — malformed or empty returns fall back safely rather than throwing", () => {
    for (const bad of [null, undefined, "", "   ", "not-a-path", "%E0%A4%A"]) {
      expect(sanitizeNextForRedirect(bad, { locale: "en" })).toBe("/en/bty");
    }
    expect(sanitizeNextForRedirect(null, { locale: "ko" })).toBe("/ko/bty");
  });

  it("A/B — a legitimate in-app deep link passes through byte for byte", () => {
    expect(sanitizeNextForRedirect(DEEP_LINK, { locale: "en" })).toBe(DEEP_LINK);
    expect(sanitizeNextForRedirect("/en/app?tab=foundry&view=my-learning", { locale: "en" })).toBe(
      "/en/app?tab=foundry&view=my-learning",
    );
    expect(sanitizeNextForRedirect("/ko/app?tab=me", { locale: "ko" })).toBe("/ko/app?tab=me");
  });

  it("D — a learner with no meaningful destination still lands normally", () => {
    // Consent must not become a funnel into Center for everyone who accepts it.
    expect(sanitizeNextForRedirect(undefined, { locale: "en" })).toBe("/en/bty");
  });

  /*
    The consent page can never appear as its own `return`: `/en/legal/accept` is in the
    middleware bypass list, so a request to it is never captured. That is already asserted by
    `middleware.consent.test.ts`, and duplicating it here would only add a second place to
    update.
  */
  it("I — a return pointing back at login cannot create a loop", () => {
    expect(sanitizeNextForRedirect("/en/bty/login", { locale: "en" })).toBe("/en/bty");
    expect(sanitizeNextForRedirect("/en/bty/login?next=/en/app", { locale: "en" })).toBe("/en/bty");
  });

});
