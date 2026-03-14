/**
 * Unit tests for Arena server Supabase client.
 * Mocks next/headers and @supabase/ssr; no business/XP logic change.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = { from: vi.fn(), auth: {} };

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "sb-token", value: "test" }],
    }),
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
    const { getSupabaseServerClient } = await import("./supabaseServer");
    const client = await getSupabaseServerClient();
    expect(client).toBe(mockClient);
  });
});
