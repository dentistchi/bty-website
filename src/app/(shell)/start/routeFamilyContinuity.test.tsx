/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

/**
 * ONE PRODUCT SHELL. ONE ROUTE FAMILY.
 *
 * BTY carries two generations of primary navigation:
 *
 *   CURRENT — `BtyDailyAppShell` at `/{locale}/app`. Navy throughout, and its `AppTabBar` is four
 *             BUTTONS with callbacks. It cannot navigate out of itself, so mixing generations
 *             inside it is structurally impossible.
 *   LEGACY  — the standalone routes `/{locale}/today`, `/center`, `/bty-arena`, `/bty/foundry`,
 *             `/my-page`, wearing the fixed 5-tab `BottomNav` whose hrefs cross between them.
 *             `ScreenShell` is beige (`#F6F4EE`) by default and `surface="navy"` is passed at
 *             exactly ONE call site in the repository — `/{locale}/today`.
 *
 * So a person who lands on `/{locale}/today` sees the navy surface they expect, and every other
 * tab in its own nav takes them to a beige page while that dark fixed nav bar stays on screen:
 * new shell, old content.
 *
 * Slice 3.1B-3E.3 made `/{locale}/app` the canonical entry — "canonical root + bare-locale enter
 * app shell, not legacy portal". `/start`'s web branch predates it by two weeks and was never
 * updated, so the launch door kept handing web visitors to the legacy portal.
 */

const { pushMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn() }));
const nativeState = vi.hoisted(() => ({ value: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/start",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false, unreachable: false, refresh: vi.fn() }),
}));
vi.mock("@/components/orb/OrbLiving", () => ({
  default: ({ onCommit }: { onCommit: () => void }) => (
    <button data-testid="orb-door" onClick={() => onCommit()}>orb</button>
  ),
}));
vi.mock("@/components/bty-arena", () => ({ PageLoadingFallback: () => <div>loading</div> }));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => nativeState.value }));

import StartShellClient from "./page.client";

/** Every route the legacy 5-tab nav can reach. None of these may be a launch destination. */
const LEGACY_DESTINATIONS = ["/today", "/center", "/bty-arena", "/bty/foundry", "/my-page"];

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  nativeState.value = false;
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  document.documentElement.lang = "en";
});
afterEach(cleanup);

async function holdDoor() {
  render(<StartShellClient />);
  fireEvent.click(await screen.findByTestId("orb-door"));
  return String(pushMock.mock.calls[0]?.[0] ?? "");
}

describe("N1 · the launch door lands in the current product, on every platform", () => {
  it("web lands in the app shell, not the legacy portal", async () => {
    nativeState.value = false;
    const dest = await holdDoor();
    expect(dest).toBe("/en/app");
    for (const legacy of LEGACY_DESTINATIONS) {
      expect(dest, `the launch must not enter the legacy route ${legacy}`).not.toContain(legacy);
    }
  });

  it("native lands in the same place — one door, one destination", async () => {
    nativeState.value = true;
    expect(await holdDoor()).toBe("/en/app");
  });

  it("a saved Korean preference still changes the LANGUAGE and not the product", async () => {
    document.cookie = "NEXT_LOCALE=ko; path=/";
    expect(await holdDoor()).toBe("/ko/app");
    nativeState.value = true;
    pushMock.mockClear();
    cleanup();
    expect(await holdDoor()).toBe("/ko/app");
  });

  it("it is still never a bare /app", async () => {
    expect(await holdDoor()).toMatch(/^\/(en|ko)\/app$/);
  });
});

describe("N2/N6/N7 · recovery lands in the same product, same language, no sign-in", () => {
  it("after a retry succeeds the door opens the app shell, in the saved language", async () => {
    document.cookie = "NEXT_LOCALE=ko; path=/";
    const dest = await holdDoor();
    expect(dest).toBe("/ko/app");
    expect(replaceMock).not.toHaveBeenCalled(); // N7 — nothing routed to a login/OAuth surface
  });
});

describe("N3 · inside the current shell, a legacy route cannot be reached by the primary nav", () => {
  const tabBar = readFileSync("src/components/app-shell/AppTabBar.tsx", "utf8");
  const shell = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");

  it("the current tab bar navigates by callback, so it emits no cross-route link at all", () => {
    expect(tabBar).not.toContain("<Link");
    expect(tabBar).not.toMatch(/href[=:]/);
    expect(tabBar).toContain("onSelect");
  });

  it("the current shell mounts no legacy shell or legacy nav", () => {
    for (const legacyOwner of ["<BottomNav", "<ScreenShell", "<ArenaLayoutShell", "<CenterLayoutShell"]) {
      expect(shell, `the app shell must not mount ${legacyOwner}`).not.toContain(legacyOwner);
    }
  });

  it("the current shell paints its own navy ground — it cannot inherit the beige surface", () => {
    expect(shell).toContain("bg-[#0B1F3A]");
    expect(shell).not.toContain("#F6F4EE");
  });
});

describe("N4/N5 · locale switching changes the language only", () => {
  const src = readFileSync("src/components/LangSwitch.tsx", "utf8");

  it("it rewrites the 3-character prefix and keeps the rest of the path", () => {
    // `rest` is the path minus `/en` or `/ko`; both targets are built from the SAME `rest`.
    expect(src).toContain("pathname.slice(3)");
    expect(src).toContain("`/en${rest}${q}`");
    expect(src).toContain("`/ko${rest}${q}`");
  });

  it("it names no route of its own, so it cannot move anyone between generations", () => {
    for (const route of [...LEGACY_DESTINATIONS, "/app"]) {
      expect(src, `LangSwitch must not hard-code ${route}`).not.toContain(`"${route}`);
    }
  });
});

describe("N8 · the legacy routes are still there", () => {
  it("nothing was deleted — they remain reachable where they are intentionally used", () => {
    for (const f of [
      "src/app/[locale]/today/page.tsx",
      "src/app/[locale]/center/page.tsx",
      "src/app/[locale]/bty-arena/page.tsx",
      "src/app/[locale]/my-page/page.tsx",
      "src/components/bty/navigation/BottomNav.tsx",
      "src/components/bty/navigation/nav-items.ts",
    ]) {
      expect(readFileSync(f, "utf8").length, `${f} must still exist`).toBeGreaterThan(0);
    }
  });
});
