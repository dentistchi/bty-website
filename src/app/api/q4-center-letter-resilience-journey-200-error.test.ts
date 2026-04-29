/**
 * Q4: POST center/letter, GET center/resilience, GET journey/entries — 200·에러 batch.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetLetterAuth = vi.fn();
const mockSubmitCenterLetter = vi.fn();
const mockGetSupabaseServerClient = vi.fn();
const mockGetResilienceEntries = vi.fn();
const mockParsePeriodDays = vi.fn();
const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  submitCenterLetter: (...args: unknown[]) => mockSubmitCenterLetter(...args),
  getResilienceEntries: (...args: unknown[]) => mockGetResilienceEntries(...args),
  parsePeriodDays: (...args: unknown[]) => mockParsePeriodDays(...args),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) =>
    mockGetAuthUserFromRequest(...args),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

vi.mock("@/lib/log-api-error", () => ({
  logApiError: vi.fn(),
}));

const { POST: postLetter } = await import("./center/letter/route");
const { GET: getResilience } = await import("./center/resilience/route");
const { GET: getJourneyEntries } = await import("./journey/entries/route");

describe("Q4 center/letter · resilience · journey/entries — 200·에러", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("letter 200, resilience 200, journey 503 when admin missing", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({
      ok: true,
      reply: "Take care.",
    });
    const r1 = await postLetter(
      new Request("http://localhost/api/center/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Hello" }),
      }),
    );
    expect(r1.status).toBe(200);
    const j1 = await r1.json();
    expect(j1.saved).toBe(true);
    expect(j1.reply).toBe("Take care.");

    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(7);
    mockGetResilienceEntries.mockResolvedValue({
      ok: true,
      entries: [],
    });
    const r2 = await getResilience(
      new NextRequest("http://localhost/api/center/resilience"),
    );
    expect(r2.status).toBe(200);
    const j2 = await r2.json();
    expect(j2.entries).toEqual([]);

    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(null);
    const r3 = await getJourneyEntries(
      new Request("http://localhost/api/journey/entries", { method: "GET" }),
    );
    expect(r3.status).toBe(503);
    const j3 = await r3.json();
    expect(j3.error).toBe("Database not configured");
  });
});
