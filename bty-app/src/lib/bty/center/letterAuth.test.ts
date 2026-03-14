/**
 * letterAuth — getLetterAuth 단위 테스트 (Center 미커버 경계).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSupabaseServerClient = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

const { getLetterAuth } = await import("./letterAuth");

describe("getLetterAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is null", async () => {
    const mockSupabase = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    };
    mockGetSupabaseServerClient.mockResolvedValue(mockSupabase);

    const result = await getLetterAuth();
    expect(result).toBeNull();
    expect(mockGetSupabaseServerClient).toHaveBeenCalledOnce();
  });

  it("returns null when user.id is undefined", async () => {
    const mockSupabase = {
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: undefined } } }),
      },
    };
    mockGetSupabaseServerClient.mockResolvedValue(mockSupabase);

    const result = await getLetterAuth();
    expect(result).toBeNull();
  });

  it("returns { supabase, userId } when user exists", async () => {
    const mockSupabase = {
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: "user-123" } },
          }),
      },
    };
    mockGetSupabaseServerClient.mockResolvedValue(mockSupabase);

    const result = await getLetterAuth();
    expect(result).not.toBeNull();
    expect(result).toEqual({
      supabase: mockSupabase,
      userId: "user-123",
    });
    expect(mockGetSupabaseServerClient).toHaveBeenCalledOnce();
  });
});
