/** @vitest-environment jsdom */
/**
 * /play/resolve route mount test (Stage 2 step 2 sub-phase 2C).
 *
 * Pins that `ArenaResolvePage` (server component) unwraps the locale param Promise and
 * mounts `ArenaResolveClient` with the resolved locale. The Resolve surface itself is
 * exercised in `ArenaResolveClient.test.tsx`; this test guards the route-level wiring.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const arenaResolveClientMock = vi.fn((_: { locale: string }) => null);

vi.mock("./ArenaResolveClient", () => ({
  __esModule: true,
  default: (props: { locale: string }) => arenaResolveClientMock(props),
}));

import ArenaResolvePage from "./page";

afterEach(() => {
  arenaResolveClientMock.mockClear();
});

describe("ArenaResolvePage — route mount", () => {
  it("unwraps en locale param and renders ArenaResolveClient with locale=en", async () => {
    const node = await ArenaResolvePage({ params: Promise.resolve({ locale: "en" }) });
    expect(React.isValidElement(node)).toBe(true);
    const el = node as React.ReactElement<{ locale: string }>;
    expect(el.props.locale).toBe("en");
  });

  it("unwraps ko locale param and renders ArenaResolveClient with locale=ko", async () => {
    const node = await ArenaResolvePage({ params: Promise.resolve({ locale: "ko" }) });
    expect(React.isValidElement(node)).toBe(true);
    const el = node as React.ReactElement<{ locale: string }>;
    expect(el.props.locale).toBe("ko");
  });
});
