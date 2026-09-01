/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  installTeamsApiTransport,
  installTeamsFrameContainment,
} from "@/lib/bty/teams/teamsTabTransport";

/**
 * Teams tab transport + frame containment (Slice A0).
 *
 * These two mechanisms exist so that ~190 untouched `fetch` call sites and every existing anchor
 * in the shell behave correctly inside a Teams frame. Both fail silently when wrong — a missing
 * bearer is a 401 the person reads as "BTY is broken", a bearer on the wrong host is a real
 * credential handed to a third party, and a missed anchor blanks the tab — so both are asserted.
 */

const ORIGIN = "https://arena.btydaily.com";

let originalFetch: typeof window.fetch;
let seen: Array<{ url: string; auth: string | null }>;

beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: new URL(`${ORIGIN}/teams`) as unknown as Location,
    writable: true,
  });
  seen = [];
  originalFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const headers = new Headers(init?.headers ?? undefined);
    seen.push({ url, auth: headers.get("authorization") });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof window.fetch;
  window.fetch = originalFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("installTeamsApiTransport", () => {
  it("attaches the Supabase bearer to same-origin BTY API calls", async () => {
    const uninstall = installTeamsApiTransport(() => "token-1");
    await window.fetch("/api/me/today/brief", { credentials: "include" });
    expect(seen[0]?.auth).toBe("Bearer token-1");
    uninstall();
  });

  it("NEVER attaches it to another origin or to a non-api path", async () => {
    const uninstall = installTeamsApiTransport(() => "token-1");
    await window.fetch("https://graph.microsoft.com/v1.0/me");
    await window.fetch("https://teams.microsoft.com/l/message/x/1");
    await window.fetch("/teams");
    await window.fetch("/_next/static/chunk.js");
    expect(seen.map((s) => s.auth)).toEqual([null, null, null, null]);
    uninstall();
  });

  it("reads the token through the getter, so a REFRESH replaces the bearer", async () => {
    let token = "token-1";
    const uninstall = installTeamsApiTransport(() => token);
    await window.fetch("/api/a");
    token = "token-2"; // Supabase rotated the access token
    await window.fetch("/api/b");
    expect(seen.map((s) => s.auth)).toEqual(["Bearer token-1", "Bearer token-2"]);
    uninstall();
  });

  it("sends the request unchanged when there is no session yet", async () => {
    const uninstall = installTeamsApiTransport(() => null);
    await window.fetch("/api/me/today/brief");
    expect(seen[0]?.auth).toBeNull();
    uninstall();
  });

  it("never overwrites an Authorization header a caller set deliberately", async () => {
    const uninstall = installTeamsApiTransport(() => "token-1");
    await window.fetch("/api/x", { headers: { Authorization: "Bearer caller-owned" } });
    expect(seen[0]?.auth).toBe("Bearer caller-owned");
    uninstall();
  });

  it("restores the original fetch on uninstall — web and native are never wrapped", () => {
    const uninstall = installTeamsApiTransport(() => "t");
    expect(window.fetch).not.toBe(originalFetch);
    uninstall();
    expect(window.fetch).toBe(originalFetch);
  });
});

describe("installTeamsFrameContainment", () => {
  function click(href: string, opts: Partial<MouseEventInit> = {}) {
    const a = document.createElement("a");
    a.setAttribute("href", href);
    document.body.appendChild(a);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...opts });
    a.dispatchEvent(ev);
    document.body.removeChild(a);
    return ev;
  }

  it("opens externally, instead of blanking the frame, for an X-Frame-Options: DENY BTY route", () => {
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));
    const ev = click("/en/observe/abc");
    expect(ev.defaultPrevented).toBe(true);
    expect(opened).toEqual([`${ORIGIN}/en/observe/abc`]);
    uninstall();
  });

  it("intercepts a link into /{locale}/app — the exact accidental escape", () => {
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));
    click("/en/app");
    expect(opened).toEqual([`${ORIGIN}/en/app`]);
    uninstall();
  });

  it("leaves links that stay inside /teams alone", () => {
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));
    const ev = click("/teams/link");
    expect(ev.defaultPrevented).toBe(false);
    expect(opened).toEqual([]);
    uninstall();
  });

  it("leaves in-page anchors and non-navigating schemes alone", () => {
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));
    for (const href of ["#top", "mailto:a@b.c", "tel:123"]) {
      expect(click(href).defaultPrevented).toBe(false);
    }
    expect(opened).toEqual([]);
    uninstall();
  });

  it("does not fight a modified click or an explicit target=_blank", () => {
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));
    expect(click("/en/app", { metaKey: true }).defaultPrevented).toBe(false);
    expect(click("/en/app", { button: 1 }).defaultPrevented).toBe(false);
    expect(opened).toEqual([]);
    uninstall();
  });

  it("stops intercepting on uninstall", () => {
    const opened: string[] = [];
    installTeamsFrameContainment((u) => opened.push(u))();
    expect(click("/en/app").defaultPrevented).toBe(false);
    expect(opened).toEqual([]);
  });
});
