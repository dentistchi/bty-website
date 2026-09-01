import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Containment at the CALL SITES, not just in the guard (Slice P0-R1).
 *
 * A previous BTY incident taught this exact lesson: auditing the wrapper proves nothing when the
 * gap is in a caller. So these tests exercise the real exported helpers with production
 * environment variables and assert that the refusal happens BEFORE any Supabase client is
 * constructed — which is the only moment at which a refusal is still worth anything.
 *
 * NOTHING here reaches a network. `@/lib/supabase-admin` is mocked, and the assertion that it was
 * never called is itself the proof that no production write could have occurred.
 */

const PROD_URL = "https://mveycersmqfiuddslnrj.supabase.co";
const SAFE_URL = "https://disposabletestproject.supabase.co";

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // If any guard were to fail open, this is what it would reach for. It never should.
  mockGetSupabaseAdmin.mockImplementation(() => {
    throw new Error("a destructive helper obtained a Supabase admin client against production");
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("E2E fixture user cleanup — cannot delete an auth user in production", () => {
  it("refuses before auth.admin.deleteUser and before any client is created", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PROD_URL);
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
    const { clearFixtureUser } = await import("@/engine/integration/e2e-test-fixtures.service");

    await expect(clearFixtureUser()).rejects.toThrow(/destructive-guard/);
    await expect(clearFixtureUser()).rejects.toThrow(/mveycersmqfiuddslnrj/);
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("still runs for an opted-in non-production project (D: existing test behaviour preserved)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SAFE_URL);
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
    // Past the guard, the helper asks for a client; returning null makes it a documented no-op
    // rather than a delete, so this proves the guard PASSED without performing any deletion.
    mockGetSupabaseAdmin.mockReturnValue(null);
    const { clearFixtureUser } = await import("@/engine/integration/e2e-test-fixtures.service");

    await expect(clearFixtureUser()).resolves.toBeUndefined();
    expect(mockGetSupabaseAdmin).toHaveBeenCalled();
  });
});

describe("cleanup-action-contracts route — production is a closed environment", () => {
  it("returns 403 forbidden_environment on production, without touching the database", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PROD_URL);
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
    vi.stubEnv("E2E_TEST_CLEANUP_SECRET", "correct-secret");
    vi.stubEnv("NODE_ENV", "development"); // the branch that used to open the door by itself
    const { POST } = await import("@/app/api/test/cleanup-action-contracts/route");

    const req = new Request("http://localhost/api/test/cleanup-action-contracts", {
      method: "POST",
      headers: { Authorization: "Bearer correct-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000" }),
    }) as unknown as import("next/server").NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "forbidden_environment" });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });
});
