/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import AdminArenaIdentityPage from "./page";

/**
 * Slice 3.1A-3 — Member Identity curation surface. The page now loads a second endpoint
 * (curation reference data) and exposes a dependent editor. Tests cover status badges, the
 * dependent role selector, family-change role invalidation, the "Date unknown" option, and
 * the save POST payload. This supersedes the 3.1A-2 read-only-contract test.
 */

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

const SUMMARY_ALIGNED = {
  approvedRequests: 2, activeCanonicalMemberships: 2, approvedWithoutCanonical: 0, canonicalWithoutApproved: 0,
  unknownJobFamily: 1, unknownPrimaryRole: 1, fullyClassified: 1, duplicateActivePrimary: 0, duplicateUserOrg: 0,
  unresolvedOrganization: 0, reconciliationStatus: "aligned",
};

const ROW_UNSET = {
  membershipId: "m1", displayName: "Jane Doe", organizationId: "org-a", organizationKey: "BTY_LEGACY",
  organizationName: "BTY Legacy Organization", status: "active", isPrimary: true, jobFamilyKey: null,
  jobFamilyLabel: null, primaryRoleKey: null, primaryRoleLabel: null, identitySource: "legacy_approved_request",
  joinedAt: "2026-01-01T00:00:00Z", roleStartedOn: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};
const ROW_CLINICAL = {
  ...ROW_UNSET, membershipId: "m2", displayName: "John Roe", jobFamilyKey: "CLINICAL_PROVIDER",
  jobFamilyLabel: "Clinical Provider", primaryRoleKey: "GENERAL_DENTIST", primaryRoleLabel: "General Dentist",
  roleStartedOn: "2020-05-01", identitySource: "admin_curated",
};

const OPTIONS = {
  ok: true,
  organizations: [{ id: "org-a", organizationKey: "BTY_LEGACY", displayName: "BTY Legacy Organization", enterpriseId: "e1" }],
  taxonomy: {
    jobFamilies: [
      { key: "CLINICAL_PROVIDER", label: "Clinical Provider" },
      { key: "SHARED_SERVICES", label: "Shared Services" },
    ],
    primaryRoles: [
      { key: "GENERAL_DENTIST", label: "General Dentist", familyKey: "CLINICAL_PROVIDER" },
      { key: "SSO_HR", label: "SSO HR", familyKey: "SHARED_SERVICES" },
    ],
  },
};

function installFetch(opts?: { list?: unknown; listOk?: boolean; postResp?: unknown; postOk?: boolean; postSpy?: (body: unknown) => void }) {
  const list = opts?.list ?? { ok: true, summary: SUMMARY_ALIGNED, memberships: [ROW_UNSET, ROW_CLINICAL] };
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/curate")) {
      if (init?.method === "POST") {
        opts?.postSpy?.(JSON.parse(String(init.body)));
        return Promise.resolve({ ok: opts?.postOk ?? true, status: 200, json: async () => opts?.postResp ?? { ok: true } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => OPTIONS });
    }
    return Promise.resolve({ ok: opts?.listOk ?? true, status: (opts?.listOk ?? true) ? 200 : 500, json: async () => list });
  }) as unknown as typeof fetch;
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function openEditorFor(membershipId: string) {
  render(<AdminArenaIdentityPage />);
  await waitFor(() => screen.getByTestId("identity-rows"));
  fireEvent.click(screen.getByTestId(`curate-${membershipId}`));
  await waitFor(() => screen.getByTestId("identity-editor"));
}

describe("AdminArenaIdentityPage — read surface", () => {
  it("renders summary, aligned banner and rows", async () => {
    installFetch();
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-summary"));
    expect(screen.getByTestId("identity-banner-aligned")).toBeTruthy();
    expect(screen.getByTestId("identity-rows").textContent).toContain("Jane Doe");
  });

  it("shows curation status badges (needs curation vs complete)", async () => {
    installFetch();
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("status-m1"));
    expect(screen.getByTestId("status-m1").textContent).toMatch(/needs curation/i);
    expect(screen.getByTestId("status-m2").textContent).toMatch(/complete/i);
  });

  it("shows an error state on a failed load", async () => {
    installFetch({ list: { error: "boom" }, listOk: false });
    render(<AdminArenaIdentityPage />);
    await waitFor(() => screen.getByTestId("identity-error"));
  });
});

describe("AdminArenaIdentityPage — curation editor", () => {
  it("opens the editor with the member's organization preselected", async () => {
    installFetch();
    await openEditorFor("m1");
    expect((screen.getByTestId("editor-org") as HTMLSelectElement).value).toBe("org-a");
    // role select is disabled until a family is chosen (unknown → unknown)
    expect((screen.getByTestId("editor-role") as HTMLSelectElement).disabled).toBe(true);
  });

  it("filters roles by the selected job family (dependent selector)", async () => {
    installFetch();
    await openEditorFor("m1");
    fireEvent.change(screen.getByTestId("editor-family"), { target: { value: "CLINICAL_PROVIDER" } });
    const role = screen.getByTestId("editor-role") as HTMLSelectElement;
    expect(role.disabled).toBe(false);
    const optionTexts = Array.from(role.options).map((o) => o.textContent);
    expect(optionTexts).toContain("General Dentist");
    expect(optionTexts).not.toContain("SSO HR"); // belongs to a different family
  });

  it("invalidates an incompatible role when the family changes", async () => {
    installFetch();
    await openEditorFor("m2"); // starts CLINICAL_PROVIDER / GENERAL_DENTIST
    expect((screen.getByTestId("editor-role") as HTMLSelectElement).value).toBe("GENERAL_DENTIST");
    fireEvent.change(screen.getByTestId("editor-family"), { target: { value: "SHARED_SERVICES" } });
    // the previously-selected role no longer belongs → cleared, never silently kept
    expect((screen.getByTestId("editor-role") as HTMLSelectElement).value).toBe("");
  });

  it("keeps 'Date unknown' for an unknown-date member and sends null", async () => {
    const postSpy = vi.fn();
    installFetch({ postSpy });
    await openEditorFor("m1"); // roleStartedAt null → Date unknown pre-checked
    expect((screen.getByTestId("editor-date-unknown") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("editor-date") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId("editor-family"), { target: { value: "CLINICAL_PROVIDER" } });
    fireEvent.change(screen.getByTestId("editor-role"), { target: { value: "GENERAL_DENTIST" } });
    fireEvent.click(screen.getByTestId("editor-save"));
    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: "m1",
        organizationId: "org-a",
        jobFamilyKey: "CLINICAL_PROVIDER",
        primaryRoleKey: "GENERAL_DENTIST",
        roleStartedOn: null,
      }),
    );
  });

  it("posts a concrete role start date after unchecking 'Date unknown'", async () => {
    const postSpy = vi.fn();
    installFetch({ postSpy });
    await openEditorFor("m1");
    fireEvent.change(screen.getByTestId("editor-family"), { target: { value: "CLINICAL_PROVIDER" } });
    fireEvent.change(screen.getByTestId("editor-role"), { target: { value: "GENERAL_DENTIST" } });
    fireEvent.click(screen.getByTestId("editor-date-unknown")); // uncheck → date input enabled
    expect((screen.getByTestId("editor-date") as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByTestId("editor-date"), { target: { value: "2021-03-15" } });
    fireEvent.click(screen.getByTestId("editor-save"));
    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    expect(postSpy).toHaveBeenCalledWith(expect.objectContaining({ roleStartedOn: "2021-03-15" }));
  });

  it("surfaces a server rejection reason without closing the editor", async () => {
    installFetch({ postOk: false, postResp: { ok: false, reason: "incompatible" } });
    await openEditorFor("m1");
    fireEvent.change(screen.getByTestId("editor-family"), { target: { value: "CLINICAL_PROVIDER" } });
    fireEvent.click(screen.getByTestId("editor-save"));
    await waitFor(() => screen.getByTestId("editor-error"));
    expect(screen.getByTestId("editor-error").textContent).toMatch(/does not belong/i);
    expect(screen.getByTestId("identity-editor")).toBeTruthy(); // stays open
  });
});
