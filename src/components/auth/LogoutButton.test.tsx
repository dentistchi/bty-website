/** @vitest-environment jsdom */
/**
 * LogoutButton — #20 fix. The visible logout must hit POST /api/auth/logout
 * (which calls supabase.auth.signOut + clears cookies), not the old cookie-only
 * /bty/logout path that left the Supabase session live for silent OAuth re-login.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/admin/debug",
}));

import { LogoutButton } from "./LogoutButton";

let assignMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assignMock = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: assignMock, href: "http://localhost/en/admin/debug" },
  });
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("renders the localized logout label", () => {
    render(<LogoutButton />);
    expect(screen.getByText(getMessages("en").logout)).toBeTruthy();
  });

  it("POSTs /api/auth/logout then navigates to /[locale]/bty/login", async () => {
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST", credentials: "include" })
      );
      expect(assignMock).toHaveBeenCalledWith("/en/bty/login");
    });
  });

  it("still navigates to the login page when the logout request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/en/bty/login");
    });
  });
});
