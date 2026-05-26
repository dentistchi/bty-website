/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { formPropsSpy, redirectSpy, getUserMock, maybeSingleMock } = vi.hoisted(() => ({
  formPropsSpy: vi.fn(),
  redirectSpy: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getUserMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectSpy(url),
}));

vi.mock("@/components/bty/layout/ScreenShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/bty/navigation/BtyMyPageTabs", () => ({ BtyMyPageTabs: () => null }));
vi.mock("@/components/bty/navigation/DashboardBackLink", () => ({ DashboardBackLink: () => null }));

vi.mock("@/components/bty/membership/TeamMembershipForm", () => ({
  default: (props: unknown) => {
    formPropsSpy(props);
    return null;
  },
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () =>
    Promise.resolve({
      auth: { getUser: () => getUserMock() },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => maybeSingleMock() }) }),
      }),
    }),
}));

import Page from "./page";

describe("[locale]/my-page/team/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectSpy.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => cleanup());

  it("renders the form with initialRequest=null for a new user (no row)", async () => {
    const ui = await Page({ params: Promise.resolve({ locale: "en" }) });
    render(ui);
    expect(formPropsSpy).toHaveBeenCalled();
    expect(formPropsSpy.mock.calls[0][0]).toMatchObject({ locale: "en", initialRequest: null });
  });

  it("passes a pending request through to the form", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { job_function: "staff", joined_at: "2024-01-01", leader_started_at: null, status: "pending", approved_at: null },
      error: null,
    });
    const ui = await Page({ params: Promise.resolve({ locale: "en" }) });
    render(ui);
    expect(formPropsSpy.mock.calls[0][0]).toMatchObject({ initialRequest: { status: "pending" } });
  });

  it("passes an approved request through to the form", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        job_function: "leader",
        joined_at: "2024-01-01",
        leader_started_at: "2024-06-01",
        status: "approved",
        approved_at: "2026-05-20T00:00:00Z",
      },
      error: null,
    });
    const ui = await Page({ params: Promise.resolve({ locale: "en" }) });
    render(ui);
    expect(formPropsSpy.mock.calls[0][0]).toMatchObject({
      initialRequest: { status: "approved", approved_at: "2026-05-20T00:00:00Z" },
    });
  });

  it("redirects to login when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(Page({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "REDIRECT:/en/bty/login",
    );
    expect(redirectSpy).toHaveBeenCalledWith("/en/bty/login");
    expect(formPropsSpy).not.toHaveBeenCalled();
  });
});
