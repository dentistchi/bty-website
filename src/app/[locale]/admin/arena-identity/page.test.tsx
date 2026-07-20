/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import AdminArenaIdentityPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

const SUMMARY_ALIGNED = {
  approvedRequests: 2, activeCanonicalMemberships: 2, approvedWithoutCanonical: 0, canonicalWithoutApproved: 0,
  unknownJobFamily: 2, unknownPrimaryRole: 2, fullyClassified: 0, duplicateActivePrimary: 0, duplicateUserOrg: 0,
  unresolvedOrganization: 0, reconciliationStatus: "aligned",
};
const ROWS = [
  { membershipId: "m1", displayName: "Jane Doe", organizationKey: "BTY_LEGACY", organizationName: "BTY Legacy Organization", status: "active", isPrimary: true, jobFamilyKey: null, jobFamilyLabel: null, primaryRoleKey: null, primaryRoleLabel: null, identitySource: "legacy_approved_request", joinedAt: "2026-01-01T00:00:00Z", roleStartedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

function mockFetch(body: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as typeof fetch;
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("AdminArenaIdentityPage", () => {
  it("renders summary counts + aligned banner + rows with Not set + source label", async () => {
    mockFetch({ ok: true, summary: SUMMARY_ALIGNED, memberships: ROWS });
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-summary"));
    expect(screen.getByTestId("identity-summary").textContent).toContain("2");
    expect(screen.getByTestId("identity-banner-aligned")).toBeTruthy();
    expect(screen.getAllByTestId("family-not-set").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("role-not-set").length).toBeGreaterThan(0);
    // identity-source shown as a human label, never the raw key
    const rows = screen.getByTestId("identity-rows");
    expect(rows.textContent).toContain("Migrated from existing Arena approval");
    expect(rows.textContent).not.toContain("legacy_approved_request");
    expect(rows.textContent).toContain("Jane Doe");
  });

  it("renders the drift banner with the missing-canonical detail", async () => {
    mockFetch({ ok: true, summary: { ...SUMMARY_ALIGNED, approvedWithoutCanonical: 2, reconciliationStatus: "drift" }, memberships: ROWS });
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-banner-drift"));
    expect(screen.getByTestId("identity-banner-drift").textContent).toContain("needs reconciliation");
    expect(screen.getByTestId("identity-banner-drift").textContent).toContain("2");
  });

  it("renders an error state on a failed load", async () => {
    mockFetch({ error: "boom" }, false);
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-error"));
  });

  it("renders an empty state when there are no canonical memberships", async () => {
    mockFetch({ ok: true, summary: { ...SUMMARY_ALIGNED, approvedRequests: 0, activeCanonicalMemberships: 0 }, memberships: [] });
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-empty"));
  });

  it("has NO edit/save/curation controls — only Refresh", async () => {
    mockFetch({ ok: true, summary: SUMMARY_ALIGNED, memberships: ROWS });
    const { container } = render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-summary"));
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("data-testid")).toBe("identity-refresh");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(screen.queryByText(/save/i)).toBeNull();
    expect(screen.queryByText(/edit/i)).toBeNull();
  });
});
