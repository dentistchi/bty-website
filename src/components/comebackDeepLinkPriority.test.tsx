/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";

/**
 * SLICE 3.2L-R11.4E-R1 — the live failure the component tests missed.
 *
 * The R11.4E gates mounted ModuleBuilderShell alone. The real browser renders the LOCALE
 * LAYOUT, which also mounts <Comeback/> — a full-screen prompt whose primary action goes to
 * the last unlocked train day. That is what turned a draft deep link into /en/train/day/28,
 * and no component-level test could ever have seen it.
 */
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/app",
  useRouter: () => ({ push, replace: vi.fn() }),
}));
let authed = { user: { id: "u1" }, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authed }));

import { Comeback } from "./Comeback";
import { COMEBACK_STORAGE_KEY } from "@/lib/utils";

const FOUR_DAYS_AGO = () => String(Date.now() - 4 * 24 * 60 * 60 * 1000);
const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";

function visit(search: string) {
  window.history.replaceState(null, "", `/en/app${search}`);
  window.localStorage.setItem(COMEBACK_STORAGE_KEY, FOUR_DAYS_AGO());
  render(<Comeback />);
}

beforeEach(() => { push.mockClear(); window.localStorage.clear(); authed = { user: { id: "u1" }, loading: false }; });
afterEach(cleanup);

describe("[3.2L-R11.4E-R1] an explicit link outranks the resume prompt", () => {
  it("A: the draft review deep link is NOT interrupted, even after 4 days away", async () => {
    visit(`?tab=foundry&draft=${DRAFT}&view=review`);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("B: an ordinary return with the same away-state still gets the prompt", async () => {
    visit("");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeTruthy());
  });

  it("every explicit in-shell target is protected, not just drafts", async () => {
    for (const q of [
      `?tab=foundry&draft=${DRAFT}`,
      "?tab=foundry&event=ev-1111111111111111&section=followups&focus=f-1111111111111111",
      "?tab=foundry&followup=abc1234567890123",
      "?tab=today&actionReview=abc1234567890123",
      "?tab=today&fieldAction=abc1234567890123",
    ]) {
      cleanup();
      visit(q);
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      expect(screen.queryByRole("dialog"), q).toBeNull();
    }
  });

  it("an empty or junk target param does not silently suppress the prompt", async () => {
    visit("?tab=foundry&draft=");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeTruthy());
  });

  it("D: nothing navigates after the delayed effects settle", async () => {
    visit(`?tab=foundry&draft=${DRAFT}&view=review`);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(push).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe(`/en/app?tab=foundry&draft=${DRAFT}&view=review`);
  });
});
