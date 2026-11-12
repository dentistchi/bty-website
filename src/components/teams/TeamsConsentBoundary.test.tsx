/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeConsentDocument, type ConsentLocale } from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";
import { useTeamsConsent } from "./TeamsConsentContext";
import TeamsTabShell from "./TeamsTabShell";

const h = vi.hoisted(() => ({
  setSession: vi.fn(async () => ({ error: null })),
  authenticate: vi.fn(async () => "ok"),
  getContext: vi.fn(async () => ({ app: { locale: "en-US" }, page: {} })),
  notifySuccess: vi.fn(),
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: async () => {}, getContext: h.getContext, notifySuccess: h.notifySuccess },
  authentication: { getAuthToken: async () => "entra-token", authenticate: h.authenticate },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { setSession: h.setSession, onAuthStateChange: vi.fn() } }),
}));

vi.mock("@/components/app-shell/BtyDailyAppShell", async () => {
  const { useState } = await import("react");
  return {
    default: function Shell() {
      const consent = useTeamsConsent();
      const [destination, setDestination] = useState("Today");
      return <>
        <button type="button" onClick={() => setDestination("Track")}>Track</button>
        <button type="button" onClick={() => {
          setDestination("Practice");
          if (consent && !consent.current) consent.open();
        }}>Practice</button>
        <p data-testid="destination" data-current={consent?.current}>{destination === "Practice" && consent?.current ? "Practice opened" : destination}</p>
      </>;
    },
  };
});

function agreement(locale: ConsentLocale = "en-US", current = false, revised = false) {
  const active = activeConsentDocument(locale)!;
  const document = revised ? { ...active, version: "2026-06-v1", title: `${active.title} (갱신본)` } : active;
  return { current, document, documentFingerprint: consentDocumentFingerprint(document) };
}

function installFetch({ current = false, firstSignIn = false, reviseOnRetry = false, postStatuses = [200] }: {
  current?: boolean;
  firstSignIn?: boolean;
  reviseOnRetry?: boolean;
  postStatuses?: number[];
} = {}) {
  let bootstraps = 0;
  let posts = 0;
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === "/api/auth/teams-bootstrap") {
      bootstraps += 1;
      return Response.json(firstSignIn && bootstraps === 1
        ? { needsFirstSignIn: true }
        : { session: { access_token: "bty-access", refresh_token: "bty-refresh" } });
    }
    if (input.startsWith("/api/legal/accept?locale=")) {
      const locale = new URLSearchParams(input.split("?")[1]).get("locale") as ConsentLocale;
      return Response.json(agreement(locale, current, reviseOnRetry && posts > 0));
    }
    if (input === "/api/legal/accept" && init?.method === "POST") {
      const status = postStatuses[posts++] ?? 200;
      const payload = JSON.parse(String(init.body)) as { consent_version: string };
      return Response.json(status === 200 ? { ok: true, consent_version: payload.consent_version } : { ok: false }, { status });
    }
    throw Error(`Unexpected local request: ${input}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getContext.mockResolvedValue({ app: { locale: "en-US" }, page: {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Teams agreement", () => {
  it("lets a first sign-in open Track and accepts the exact document in place before resuming Practice", async () => {
    const fetch = installFetch({ firstSignIn: true });
    const href = window.location.href;
    render(<TeamsTabShell />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Microsoft" }));
    fireEvent.click(await screen.findByRole("button", { name: "Track" }));
    expect(screen.getByTestId("destination").textContent).toBe("Track");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));

    const expected = agreement();
    await screen.findByRole("heading", { name: expected.document.title });
    const accept = screen.getByRole("button", { name: "Accept & Continue" }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(accept);
    await waitFor(() => expect(screen.getByTestId("destination").textContent).toBe("Practice opened"));

    const request = fetch.mock.calls.find(([url, init]) => url === "/api/legal/accept" && init?.method === "POST");
    const statusRequest = fetch.mock.calls.find(([url]) => url === "/api/legal/accept?locale=en-US");
    expect(request?.[1]?.credentials).toBe("omit");
    expect(statusRequest?.[1]?.credentials).toBe("omit");
    expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer bty-access");
    expect(new Headers(statusRequest?.[1]?.headers).get("Authorization")).toBe("Bearer bty-access");
    expect(JSON.parse(request?.[1]?.body as string)).toEqual({
      consent_version: expected.document.version,
      consent_locale: expected.document.locale,
      document_fingerprint: expected.documentFingerprint,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toBe(href);
    expect(h.setSession).toHaveBeenCalledTimes(1);
    expect(h.notifySuccess).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/auth/teams-bootstrap")).toHaveLength(2);
  });

  it("loads the localized agreement again after a stale response and requires a fresh checkbox", async () => {
    h.getContext.mockResolvedValue({ app: { locale: "ko-KR" }, page: {} });
    const fetch = installFetch({ reviseOnRetry: true, postStatuses: [409, 200] });
    render(<TeamsTabShell />);
    fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
    await screen.findByRole("heading", { name: agreement("ko-KR").document.title });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Accept & Continue/ }));
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url === "/api/legal/accept?locale=ko-KR")).toHaveLength(2));
    const refreshed = agreement("ko-KR", false, true);
    await screen.findByRole("heading", { name: refreshed.document.title });
    const checkbox = await screen.findByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/legal/accept")).toHaveLength(1);
    expect(screen.getByTestId("destination").textContent).toBe("Practice");

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /Accept & Continue/ }));
    await waitFor(() => expect(screen.getByTestId("destination").textContent).toBe("Practice opened"));
    const requests = fetch.mock.calls.filter(([url]) => url === "/api/legal/accept");
    expect(JSON.parse(requests[1][1]?.body as string)).toEqual({
      consent_version: refreshed.document.version,
      consent_locale: refreshed.document.locale,
      document_fingerprint: refreshed.documentFingerprint,
    });
  });

  it("opens Practice without another acceptance when the server confirms current consent", async () => {
    const fetch = installFetch({ current: true });
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("destination").getAttribute("data-current")).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));
    expect(screen.getByTestId("destination").textContent).toBe("Practice opened");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url === "/api/legal/accept")).toBe(false);
  });

  it("leaves Practice gated when acceptance fails and returns to the app if dismissed", async () => {
    installFetch({ postStatuses: [500] });
    render(<TeamsTabShell />);
    fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept & Continue" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Please try again");
    expect(screen.getByTestId("destination").textContent).toBe("Practice");
    fireEvent.click(screen.getByRole("button", { name: "Back to BTY" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getByTestId("destination").textContent).toBe("Track");
  });
});
