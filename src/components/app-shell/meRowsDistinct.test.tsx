/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R1.1 — THE ACTUAL DEFECT: two Me rows, one destination.
 *
 * The Founder device gate on R1 reported "What I learned" and "What I achieved" showing the same
 * content. Neither label lives in the My Learning card. They were two entries in the Me-tab nav
 * with different labels and the IDENTICAL handler — both `setMeView("my-learning")` — introduced
 * in 3.2C-B3A.2D, long before R1. Tapping either opened the same screen, so the product looked
 * like it held two records and rendered one of them twice.
 *
 * "What I achieved" was REMOVED rather than repointed: measured across the shell, no achievement
 * surface, table, projection or route exists to point it at. Achievement in this product is the
 * evidence ladder, which already renders inside My Learning.
 *
 * These tests fail against the pre-R1.1 shell.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body =
        u.includes("/api/bty/foundry/history") ? { history: [], thread: null, threadStatus: "none" }
        : u.includes("/api/bty/foundry/evidence/mine") ? { items: [] }
        : u.includes("/api/bty/action-contract/reviewed-plans") ? { items: [] }
        : { ok: true };
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
}

async function gotoMe(locale: "en" | "ko" = "en") {
  render(<BtyDailyAppShell locale={locale} />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  fireEvent.click(within(nav).getByText(locale === "ko" ? "나" : "Me"));
  return nav;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Me root nav — every row is a distinct destination", () => {
  it("'What I achieved' no longer exists", async () => {
    stub();
    await gotoMe();
    await screen.findByTestId("me-home");
    expect(screen.queryByTestId("me-row-achieved")).toBeNull();
    expect(screen.getByTestId("me-home").textContent).not.toMatch(/What I achieved/i);
  });

  it("KO — '내가 이룬 것' no longer exists", async () => {
    stub();
    await gotoMe("ko");
    await screen.findByTestId("me-home");
    expect(screen.queryByTestId("me-row-achieved")).toBeNull();
    expect(screen.getByTestId("me-home").textContent).not.toMatch(/내가 이룬/);
  });

  it("'What I learned' survives and still opens My Learning", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-learned"));
    expect(await screen.findByTestId("foundry-my-learning")).toBeTruthy();
  });

  it("no two rows share a label, and no two share a destination", async () => {
    /*
      The general property, not just the one instance: a nav whose rows promise different things
      must deliver different things. Asserted structurally so a future third row cannot silently
      re-introduce the defect.
    */
    stub();
    await gotoMe();
    const home = await screen.findByTestId("me-home");
    const rows = Array.from(home.querySelectorAll("nav button"));
    const labels = rows.map((r) => (r.textContent ?? "").replace(/›/g, "").trim());
    expect(labels.length).toBeGreaterThan(1);
    expect(new Set(labels).size, `duplicate label in ${JSON.stringify(labels)}`).toBe(labels.length);

    // Each row must land on a DIFFERENT view. Tap each, record the view, return to root.
    const seen: string[] = [];
    for (const testId of rows.map((r) => r.getAttribute("data-testid")).filter(Boolean) as string[]) {
      fireEvent.click(screen.getByTestId(testId));
      const view =
        screen.queryByTestId("foundry-my-learning") ? "my-learning"
        : screen.queryByTestId("me-account") ? "account"
        : "center-or-other";
      seen.push(view);
      // Back to the Me root for the next probe.
      const nav = screen.getByRole("navigation", { name: /App navigation/i });
      fireEvent.click(within(nav).getByText("Me"));
      await screen.findByTestId("me-home");
    }
    expect(new Set(seen).size, `two rows land on the same view: ${JSON.stringify(seen)}`).toBe(seen.length);
  });
});
