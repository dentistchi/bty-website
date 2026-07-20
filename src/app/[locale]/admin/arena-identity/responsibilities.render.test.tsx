/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import AdminArenaIdentityPage from "./page";

/**
 * Slice 3.1B-1 device-gate regression. The 3.1B-1 deploy shipped a Leadership
 * responsibilities sub-editor that did NOT appear in the real browser modal, and no test
 * caught it because nothing rendered the editor and asserted the section. This file closes
 * that gap: it opens the curate modal exactly as an admin does and asserts the
 * responsibilities controls are actually mounted and usable.
 */

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

const SUMMARY = {
  approvedRequests: 1, activeCanonicalMemberships: 1, approvedWithoutCanonical: 0, canonicalWithoutApproved: 0,
  unknownJobFamily: 0, unknownPrimaryRole: 0, fullyClassified: 1, duplicateActivePrimary: 0, duplicateUserOrg: 0,
  unresolvedOrganization: 0, reconciliationStatus: "aligned",
};

const ROW = {
  membershipId: "m1", displayName: "Hanbit Chi", organizationId: "org-a", organizationKey: "BTY_LEGACY",
  organizationName: "BTY Legacy Organization", status: "active", isPrimary: true,
  jobFamilyKey: "CLINICAL_PROVIDER", jobFamilyLabel: "Clinical Provider",
  primaryRoleKey: "GENERAL_DENTIST", primaryRoleLabel: "General Dentist",
  identitySource: "admin_curated", joinedAt: "2026-01-01T00:00:00Z", roleStartedOn: "2013-01-02",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

const OPTIONS = {
  ok: true,
  organizations: [{ id: "org-a", organizationKey: "BTY_LEGACY", displayName: "BTY Legacy Organization", enterpriseId: "e1" }],
  taxonomy: {
    jobFamilies: [{ key: "CLINICAL_PROVIDER", label: "Clinical Provider" }],
    primaryRoles: [{ key: "GENERAL_DENTIST", label: "General Dentist", familyKey: "CLINICAL_PROVIDER" }],
  },
};

const VOCABULARY = [
  { key: "PARTNER", label: "Partner" },
  { key: "CLINICAL_DIRECTOR", label: "Clinical Director" },
  { key: "TRAINER", label: "Trainer" },
  { key: "TEAM_LEAD", label: "Lead" },
  { key: "PEOPLE_MANAGER", label: "People Manager" },
];

function installFetch(opts?: {
  responsibilities?: Array<{ id: string; responsibilityKey: string; startedOn: string | null }>;
  postSpy?: (body: unknown) => void;
}) {
  const responsibilities = opts?.responsibilities ?? [];
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    // ORDER MATTERS: the responsibilities path also contains "org-memberships",
    // so it must be matched before the generic list branch.
    if (u.includes("/responsibilities")) {
      if (init?.method === "POST") {
        opts?.postSpy?.(JSON.parse(String(init.body)));
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ ok: true, vocabulary: VOCABULARY, responsibilities }),
      });
    }
    if (u.includes("/curate")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => OPTIONS });
    }
    return Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ ok: true, summary: SUMMARY, memberships: [ROW] }),
    });
  }) as unknown as typeof fetch;
}

async function openEditor() {
  render(<AdminArenaIdentityPage />);
  await waitFor(() => expect(screen.getByText("Hanbit Chi")).toBeTruthy());
  fireEvent.click(screen.getByText("Curate"));
  await waitFor(() => expect(screen.getByTestId("identity-editor")).toBeTruthy());
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Leadership responsibilities sub-editor is actually mounted in the curate modal", () => {
  it("renders the section inside the editor (the device-gate failure)", async () => {
    installFetch();
    await openEditor();
    // The section must be present in the SAME modal as the identity fields.
    const editor = screen.getByTestId("identity-editor");
    await waitFor(() => expect(screen.getByTestId("responsibilities-section")).toBeTruthy());
    expect(editor.contains(screen.getByTestId("responsibilities-section"))).toBe(true);
    expect(screen.getByText("Leadership responsibilities")).toBeTruthy();
  });

  it("offers all five canonical responsibilities, with Lead shown for TEAM_LEAD", async () => {
    installFetch();
    await openEditor();
    const select = (await screen.findByTestId("responsibility-add-select")) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(["PARTNER", "CLINICAL_DIRECTOR", "TRAINER", "TEAM_LEAD", "PEOPLE_MANAGER"]);
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain("Lead");
  });

  it("keeps the identity fields intact alongside it (primary role unchanged)", async () => {
    installFetch();
    await openEditor();
    await screen.findByTestId("responsibilities-section");
    expect((screen.getByTestId("editor-role") as HTMLSelectElement).value).toBe("GENERAL_DENTIST");
  });

  it("posts an assign with Date unknown as null", async () => {
    const posts: unknown[] = [];
    installFetch({ postSpy: (b) => posts.push(b) });
    await openEditor();
    const select = await screen.findByTestId("responsibility-add-select");
    fireEvent.change(select, { target: { value: "PARTNER" } });
    fireEvent.click(screen.getByTestId("responsibility-add"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      membershipId: "m1", responsibilityKey: "PARTNER", action: "assign", startedOn: null,
    });
  });

  it("lists existing assignments and can remove one", async () => {
    const posts: unknown[] = [];
    installFetch({
      responsibilities: [
        { id: "r1", responsibilityKey: "PARTNER", startedOn: "2020-01-01" },
        { id: "r2", responsibilityKey: "CLINICAL_DIRECTOR", startedOn: null },
      ],
      postSpy: (b) => posts.push(b),
    });
    await openEditor();
    await screen.findByTestId("responsibility-PARTNER");
    expect(screen.getByTestId("responsibility-CLINICAL_DIRECTOR")).toBeTruthy();
    fireEvent.click(screen.getByTestId("responsibility-remove-PARTNER"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ responsibilityKey: "PARTNER", action: "remove" });
  });

  it("shows no responsibilities for an untouched member (never inferred)", async () => {
    installFetch({ responsibilities: [] });
    await openEditor();
    await waitFor(() => expect(screen.getByTestId("responsibilities-empty")).toBeTruthy());
  });
});
