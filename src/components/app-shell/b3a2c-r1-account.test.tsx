/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body =
        u.includes("/api/auth/session")
          ? { ok: true, user: { email: "ywamer2022@gmail.com" } }
          : u.includes("/api/me/today/brief")
            ? { ok: true, reminders: [] }
            : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText("Me"));
}

/**
 * Slice 3.2C-B3A.2C-R1 — account access restoration. Me root shows ONE calm
 * "Account >" row near the bottom (no large "Signed in as" card, no exposed
 * Switch/Sign out on the root); tapping it opens the Account detail with the
 * current email + Switch account + Sign out (the validated AccountBlock capability).
 */
describe("Me — Account access (B3A.2C-R1)", () => {
  it("Me root shows one Account row and NOT the large account card / exposed buttons", async () => {
    stub();
    await gotoMe();
    await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
    // the large "Signed in as" card + direct Switch/Sign out are NOT on the root
    expect(screen.queryByTestId("account-block")).toBeNull();
    expect(screen.queryByTestId("account-switch")).toBeNull();
    expect(screen.queryByTestId("account-signout")).toBeNull();
  });

  it("tapping Account opens the detail (email + Switch account + Sign out); Back returns to Me root", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-account-row"));
    const block = await screen.findByTestId("account-block");
    expect(within(block).getByTestId("account-switch")).toBeTruthy();
    expect(within(block).getByTestId("account-signout")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("account-email").textContent).toBe("ywamer2022@gmail.com"));
    fireEvent.click(screen.getByTestId("me-account-back"));
    await waitFor(() => expect(screen.getByTestId("me-account-row")).toBeTruthy());
    expect(screen.queryByTestId("account-block")).toBeNull();
  });
});
