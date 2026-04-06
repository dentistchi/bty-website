import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncCatalogToDB, ensureMinimumScenarioCatalogRows } from "./scenario-catalog-sync.service";

const mockUpsertElite = vi.fn();
vi.mock("@/lib/bty/arena/eliteScenariosCanonical.server", () => ({
  upsertEliteCatalogToPublicScenarios: () => mockUpsertElite(),
}));

const mockGetAdmin = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetAdmin(),
}));

describe("scenario-catalog-sync.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncCatalogToDB delegates to upsertEliteCatalogToPublicScenarios only", async () => {
    mockUpsertElite.mockResolvedValue({ ok: true, insertedOrUpdated: 100 });
    const r = await syncCatalogToDB();
    expect(mockUpsertElite).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(100);
  });

  it("ensureMinimumScenarioCatalogRows loads elite mirror when count is 0", async () => {
    mockGetAdmin.mockReturnValue({
      from: () => ({
        select: () =>
          Promise.resolve({
            count: 0,
            error: null,
          }),
      }),
    });
    mockUpsertElite.mockResolvedValue({ ok: true, insertedOrUpdated: 100 });
    await ensureMinimumScenarioCatalogRows(50);
    expect(mockUpsertElite).toHaveBeenCalled();
  });

  it("ensureMinimumScenarioCatalogRows does not load when count >= min", async () => {
    mockGetAdmin.mockReturnValue({
      from: () => ({
        select: () =>
          Promise.resolve({
            count: 120,
            error: null,
          }),
      }),
    });
    await ensureMinimumScenarioCatalogRows(50);
    expect(mockUpsertElite).not.toHaveBeenCalled();
  });

  it("ensureMinimumScenarioCatalogRows does not call upsert when sparse but non-zero", async () => {
    mockGetAdmin.mockReturnValue({
      from: () => ({
        select: () =>
          Promise.resolve({
            count: 5,
            error: null,
          }),
      }),
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await ensureMinimumScenarioCatalogRows(50);
    expect(mockUpsertElite).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
