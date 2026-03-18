/**
 * GET /api/center/resilience — 401·500·200.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();
const mockGetResilienceEntries = vi.fn();
const mockParsePeriodDays = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
}));
vi.mock("@/lib/bty/center", () => ({
  getResilienceEntries: (...args: unknown[]) => mockGetResilienceEntries(...args),
  parsePeriodDays: (...args: unknown[]) => mockParsePeriodDays(...args),
}));

function makeRequest(period?: string): NextRequest {
  const url = period != null
    ? `http://localhost/api/center/resilience?period=${period}`
    : "http://localhost/api/center/resilience";
  return new NextRequest(url);
}

describe("GET /api/center/resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    mockParsePeriodDays.mockReturnValue(7);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockGetResilienceEntries).not.toHaveBeenCalled();
  });

  it("returns 401 with error as string", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("does not call parsePeriodDays or getResilienceEntries when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    await GET(makeRequest("30"));

    expect(mockParsePeriodDays).not.toHaveBeenCalled();
    expect(mockGetResilienceEntries).not.toHaveBeenCalled();
  });

  it("returns 500 when service returns error", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: false, error: "db_error" });

    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db_error");
    expect(mockGetResilienceEntries).toHaveBeenCalledOnce();
  });

  it("returns 500 with JSON body containing only error key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: false, error: "db_error" });
    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with entries array length >= 0", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });
    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries.length).toBeGreaterThanOrEqual(0);
  });

  it("returns 200 with entries as array", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });
    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.entries)).toBe(true);
  });

  it("returns 200 with exactly entries key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["entries"]);
  });

  it("returns 200 with empty entries when no history", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toEqual([]);
    expect(mockGetResilienceEntries).toHaveBeenCalledOnce();
  });

  it("returns 200 with entries on success", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({
      ok: true,
      entries: [
        { date: "2026-03-10", level: "mid", source: "letter" },
      ],
    });

    const res = await GET(makeRequest("30"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].date).toBe("2026-03-10");
    expect(data.entries[0].level).toBe("mid");
    expect(mockParsePeriodDays).toHaveBeenCalled();
    expect(mockGetResilienceEntries).toHaveBeenCalledOnce();
  });

  it("returns 200 with multiple entries when service returns two", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({
      ok: true,
      entries: [
        { date: "2026-03-09", level: "low", source: "letter" },
        { date: "2026-03-10", level: "mid", source: "letter" },
      ],
    });

    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].date).toBe("2026-03-09");
    expect(data.entries[0].level).toBe("low");
    expect(data.entries[1].date).toBe("2026-03-10");
    expect(data.entries[1].level).toBe("mid");
  });

  it("calls getResilienceEntries with periodDays from parsePeriodDays", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(14);
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    await GET(makeRequest("14"));

    expect(mockParsePeriodDays).toHaveBeenCalledWith("14");
    expect(mockGetResilienceEntries).toHaveBeenCalledOnce();
    const [, userId, periodDays] = mockGetResilienceEntries.mock.calls[0];
    expect(userId).toBe("u1");
    expect(periodDays).toBe(14);
  });

  it("returns 200 when period query is omitted (no parsePeriodDays call)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toEqual([]);
    expect(mockParsePeriodDays).not.toHaveBeenCalled();
    expect(mockGetResilienceEntries).toHaveBeenCalledWith(expect.anything(), "u1", undefined);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(7);
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 500 when getResilienceEntries throws", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(7);
    mockGetResilienceEntries.mockRejectedValue(new Error("unexpected"));

    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });

  it("returns 500 with error as string when service throws", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(7);
    mockGetResilienceEntries.mockRejectedValue(new Error("db error"));

    const res = await GET(makeRequest("7"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 500 when getSupabaseServerClient rejects", async () => {
    mockGetSupabaseServerClient.mockRejectedValue(new Error("supabase unavailable"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
    expect(mockGetResilienceEntries).not.toHaveBeenCalled();
  });

  it("returns 200 when period query is empty string (omit periodDays)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const req = new NextRequest("http://localhost/api/center/resilience?period=");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toEqual([]);
    expect(mockParsePeriodDays).not.toHaveBeenCalled();
    expect(mockGetResilienceEntries).toHaveBeenCalledWith(expect.anything(), "u1", undefined);
  });

  it("returns 400 INVALID_PERIOD when period is non-empty but invalid (e.g. abc)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(undefined);
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const req = new NextRequest("http://localhost/api/center/resilience?period=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_PERIOD");
    expect(mockGetResilienceEntries).not.toHaveBeenCalled();
  });

  it("returns 200 when period is 1 (minimum valid)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(1);
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const res = await GET(makeRequest("1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toEqual([]);
    const [, , periodDays] = mockGetResilienceEntries.mock.calls[0];
    expect(periodDays).toBe(1);
  });

  it("returns 200 when period is 365 (maximum valid)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(365);
    mockGetResilienceEntries.mockResolvedValue({ ok: true, entries: [] });

    const res = await GET(makeRequest("365"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toEqual([]);
    const [, , periodDays] = mockGetResilienceEntries.mock.calls[0];
    expect(periodDays).toBe(365);
  });
});
