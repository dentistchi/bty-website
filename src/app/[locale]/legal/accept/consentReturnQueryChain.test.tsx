/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AcceptClient } from "./AcceptClient";
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import { resolveInitialAppTab } from "@/components/app-shell/initialTab";
import { ACTIVE_CONSENT_VERSION, activeConsentDocument } from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";

/**
 * SLICE 3.2R-R9A-R2 — THE EXACT PRODUCTION RE-CONSENT JOURNEY.
 *
 * A real Founder acceptance on 2026-08-14 started from
 *
 *     /en/legal/accept?return=%2Fen%2Fapp%3Ftab%3Dme
 *
 * and the browser finished at `/en/app` rather than `/en/app?tab=me`.
 *
 * R8E's continuity suite passed a deep link straight into `AcceptClient` as a prop. That proves the
 * client forwards what it is given; it does not prove the value ARRIVING there still carries a
 * query, because it never crossed the middleware → page → sanitizer hops that produce it. This
 * test walks the whole chain with the production string, so any hop that drops the query fails
 * here rather than on someone's device.
 *
 * The final hop is deliberately included: the app shell CONSUMES `?tab=` once on mount and then
 * erases it with `history.replaceState` (Slice 3.2G). So `/en/app` in the address bar is the
 * expected END STATE of a SUCCESSFUL deep link — the question that decides success is which tab
 * the shell selected, and that is asserted here.
 */

const RAW_RETURN_PARAM = "%2Fen%2Fapp%3Ftab%3Dme";
const DEEP_LINK = "/en/app?tab=me";
const EN_FP = consentDocumentFingerprint(activeConsentDocument("en-US")!);

function captureNavigation() {
  const calls: string[] = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign: (u: string) => calls.push(u) },
  });
  return { calls };
}

afterEach(() => cleanup());

describe("[3.2R-R9A-R2] the query survives every hop of the real journey", () => {
  it("hop 1 — middleware builds the return from pathname + search, not pathname alone", () => {
    // `acceptUrl.searchParams.set("return", pathname + req.nextUrl.search)`
    const built = "/en/app" + "?tab=me";
    expect(built).toBe(DEEP_LINK);
    // …and URL-encodes to exactly what the device showed.
    expect(encodeURIComponent(built)).toBe(RAW_RETURN_PARAM);
  });

  it("hop 2 — the page's searchParams.return decodes to the full deep link", () => {
    expect(decodeURIComponent(RAW_RETURN_PARAM)).toBe(DEEP_LINK);
  });

  it("hop 3 — the sanitizer returns the deep link INTACT, query included", () => {
    const safe = sanitizeNextForRedirect(decodeURIComponent(RAW_RETURN_PARAM), { locale: "en" });
    expect(safe).toBe(DEEP_LINK);
    // Not a pathname-only reduction — the exact failure shape being investigated.
    expect(safe).not.toBe("/en/app");
  });

  it("hop 4/5 — accepting navigates ONCE, to the exact deep link", async () => {
    const nav = captureNavigation();
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    const safe = sanitizeNextForRedirect(decodeURIComponent(RAW_RETURN_PARAM), { locale: "en" });
    render(
      <AcceptClient
        locale="en"
        returnUrl={safe}
        consentVersion={ACTIVE_CONSENT_VERSION}
        consentLocale="en-US"
        documentFingerprint={EN_FP}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(nav.calls.length).toBe(1));
    expect(nav.calls[0]).toBe(DEEP_LINK);
    expect(nav.calls[0]).not.toBe("/en/app");
  });

  it("hop 6 — the shell honours ?tab=me; the bare /en/app that follows is its own cleanup", () => {
    // The destination is the TAB, not the address bar. `me` is a canonical tab value.
    expect(resolveInitialAppTab("?tab=me")).toBe("me");
    // An unknown value would silently fall back to Today — which is what a real loss would look like.
    expect(resolveInitialAppTab("")).toBeNull();
    expect(resolveInitialAppTab("?tab=nonsense")).toBeNull();
  });

  it("the whole chain, composed: encoded param in → same deep link out", async () => {
    const nav = captureNavigation();
    // @ts-expect-error test shim
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));

    const fromUrl = new URL(`https://x/en/legal/accept?return=${RAW_RETURN_PARAM}`);
    const safe = sanitizeNextForRedirect(fromUrl.searchParams.get("return"), { locale: "en" });
    render(
      <AcceptClient
        locale="en"
        returnUrl={safe}
        consentVersion={ACTIVE_CONSENT_VERSION}
        consentLocale="en-US"
        documentFingerprint={EN_FP}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(nav.calls.length).toBe(1));
    expect(nav.calls[0]).toBe(DEEP_LINK);
    expect(resolveInitialAppTab(new URL(nav.calls[0], "https://x").search)).toBe("me");
  });
});

describe("[3.2R-R9A-R2] arbitrary safe query parameters survive, unsafe targets still refused", () => {
  it("multi-parameter and non-app destinations are preserved byte for byte", () => {
    for (const target of [
      "/en/app",
      "/en/app?tab=me",
      "/en/app?tab=me&view=history",
      "/en/bty/leaderboard?scope=office",
      "/ko/app?tab=learn&draft=abc",
      "/en/app?tab=practice&fieldAction=11111111-1111-1111-1111-111111111111",
    ]) {
      expect(sanitizeNextForRedirect(target, { locale: "en" }), target).toBe(target);
    }
  });

  it("the open-redirect defense is untouched by query preservation", () => {
    for (const evil of [
      "//evil.com",
      "https://evil.com",
      "http://evil.com",
      "\\evil.com",
      "javascript:alert(1)",
      "//evil.com?tab=me",
      "https://evil.com/en/app?tab=me",
    ]) {
      expect(sanitizeNextForRedirect(evil, { locale: "en" }), evil).toBe("/en/bty");
    }
  });

  it("login-loop destinations still fall back, query or not", () => {
    for (const loop of ["/en/bty/login", "/en/bty/login?next=%2Fen%2Fapp", "/bty/login", "/en/admin/login"]) {
      expect(sanitizeNextForRedirect(loop, { locale: "en" }), loop).toBe("/en/bty");
    }
  });
});
