/**
 * Unit tests for Arena server Supabase client.
 * Mocks next/headers and @supabase/ssr; no business/XP logic change.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));
const mockClient = { from: vi.fn(), auth: { getUser } };

/** Slice A0.2 — the factory now reads the Authorization header too, so the mock supplies one. */
let authorization: string | null = null;
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "sb-token", value: "test" }],
    }),
  headers: () => Promise.resolve({ get: (n: string) => (n.toLowerCase() === "authorization" ? authorization : null) }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockClient),
}));

describe("supabaseServer", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  it("returns client from createServerClient with cookie adapter", async () => {
    authorization = null;
    const { getSupabaseServerClient } = await import("./supabaseServer");
    const client = await getSupabaseServerClient();
    expect(client).toBe(mockClient);
  });

  it("carries a Teams bearer so the 61 routes built here work without a cookie (A0.2)", async () => {
    authorization = "Bearer supabase-access-token";
    vi.resetModules();
    const { createServerClient } = (await import("@supabase/ssr")) as unknown as {
      createServerClient: ReturnType<typeof vi.fn>;
    };
    createServerClient.mockClear();
    const { getSupabaseServerClient } = await import("./supabaseServer");
    await getSupabaseServerClient();
    const opts = createServerClient.mock.calls[0]?.[2] as { global?: { headers?: Record<string, string> } };
    expect(opts.global?.headers?.Authorization).toBe("Bearer supabase-access-token");
  });

  it("adds nothing when no bearer is presented — the cookie path is unchanged", async () => {
    authorization = null;
    vi.resetModules();
    const { createServerClient } = (await import("@supabase/ssr")) as unknown as {
      createServerClient: ReturnType<typeof vi.fn>;
    };
    createServerClient.mockClear();
    const { getSupabaseServerClient } = await import("./supabaseServer");
    await getSupabaseServerClient();
    const opts = createServerClient.mock.calls[0]?.[2] as { global?: unknown };
    expect(opts.global).toBeUndefined();
  });
});
