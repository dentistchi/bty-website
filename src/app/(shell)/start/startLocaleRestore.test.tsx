/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

/**
 * R4-R4B-R1N-R1 — CASES 1–3, at the launch door itself.
 *
 * The native shell always relaunches at `https://arena.btydaily.com/start`. `/start` is not under
 * `[locale]`, so `SetLocale` wrote `document.documentElement.lang = "en"` and `currentLocale()`
 * read it back — routing every cold launch to `/en/app` regardless of choice OR device. Case 2
 * below is the decisive one: Korean device AND Korean selection still opened in English, which is
 * what proves nothing was consulted rather than the device winning.
 */

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/start",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

let mockUser: { id: string } | null = { id: "u1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, loading: false, unreachable: false, refresh: vi.fn() }),
}));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => true }));
vi.mock("@/components/orb/OrbLiving", () => ({ default: () => null }));

import StartPageClient from "./page.client";

function setCookie(v: string | null) {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  if (v) document.cookie = `NEXT_LOCALE=${v}; path=/`;
}
function setDeviceLanguage(tag: string) {
  Object.defineProperty(window.navigator, "language", { configurable: true, get: () => tag });
}

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "u1" };
  setCookie(null);
  // `/start` is not under [locale]; SetLocale writes "en" here in production.
  document.documentElement.lang = "en";
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/start", search: "", protocol: "https:", assign, href: "" },
  });
});
afterEach(cleanup);

/**
 * Read the locale the launch resolves, through the one path that navigates WITHOUT user input.
 *
 * An authenticated launch deliberately waits on the Orb press-and-hold — it never auto-navigates,
 * which is the Threshold Door's whole design. The UNAUTHENTICATED launch redirects immediately and
 * builds its destination from the SAME `currentLocale()` the authenticated commit uses, so it is
 * the honest place to observe the decision rather than reaching past the door with a fake commit.
 */
async function launchAndReadLocale(): Promise<string> {
  mockUser = null;
  render(<StartPageClient />);
  await waitFor(() => expect(replace).toHaveBeenCalled(), { timeout: 3000 });
  const dest = String(replace.mock.calls.at(-1)?.[0] ?? "");
  return dest.split("/")[1] ?? "";
}

describe("R4-R4B-R1N-R1 · 3/4 · the saved preference decides the launch", () => {
  it("3 — CASE 1: device EN, saved KO → opens Korean", async () => {
    setDeviceLanguage("en-US");
    setCookie("ko");
    expect(await launchAndReadLocale()).toBe("ko");
  });

  it("3 — CASE 2 (the decisive one): device KO, saved KO → opens Korean", async () => {
    setDeviceLanguage("ko-KR");
    setCookie("ko");
    expect(await launchAndReadLocale()).toBe("ko");
  });

  it("4 — CASE 3: device KO, saved EN → opens English, honouring the explicit choice", async () => {
    setDeviceLanguage("ko-KR");
    setCookie("en");
    expect(await launchAndReadLocale()).toBe("en");
  });
});

describe("R4-R4B-R1N-R1 · 5/6 · no preference, or a bad one", () => {
  it("6 — no cookie preserves the existing behaviour exactly", async () => {
    setDeviceLanguage("en-US");
    setCookie(null);
    // Unchanged from before this slice: the document fallback decides.
    expect(await launchAndReadLocale()).toBe("en");
  });

  it("5 — an invalid cookie is ignored and does not become a language", async () => {
    setCookie("kr");
    expect(await launchAndReadLocale()).toBe("en");
  });

  it("5 — an empty cookie value is ignored", async () => {
    setCookie("");
    expect(await launchAndReadLocale()).toBe("en");
  });
});

describe("R4-R4B-R1N-R1 · 9 · the unauthenticated route still carries the locale", () => {
  it("an unauthenticated launch goes to login, in the saved language", async () => {
    mockUser = null;
    setCookie("ko");
    render(<StartPageClient />);
    await waitFor(() => expect(replace).toHaveBeenCalled(), { timeout: 3000 });
    const dest = String(replace.mock.calls.at(-1)?.[0] ?? "");
    expect(dest.startsWith("/ko/bty/login")).toBe(true);
    // The OAuth return target is preserved unchanged.
    expect(dest).toContain(`next=${encodeURIComponent("/start")}`);
  });
});
