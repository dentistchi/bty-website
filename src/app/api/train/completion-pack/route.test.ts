/**
 * GET /api/train/completion-pack — 401·400·404·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockGetAuthUserFromRequest = vi.fn();
const mockBuildCompletionPackFromLesson = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => mockGetAuthUserFromRequest(...args),
}));
vi.mock("@/lib/train/completion-pack", () => ({
  buildCompletionPackFromLesson: (...args: unknown[]) => mockBuildCompletionPackFromLesson(...args),
}));
vi.mock("@/content/train-28days.json", () => ({
  default: {
    "1": { day: 1, title: "Day 1", sections: {} },
  },
}));

function makeRequest(day?: number): NextRequest {
  const url = day != null
    ? `http://localhost/api/train/completion-pack?day=${day}`
    : "http://localhost/api/train/completion-pack";
  return new NextRequest(url);
}

describe("GET /api/train/completion-pack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCompletionPackFromLesson.mockReturnValue({ summary: "pack" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue(null);

    const res = await GET(makeRequest(1));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Unauthorized");
    expect(mockBuildCompletionPackFromLesson).not.toHaveBeenCalled();
  });

  it("returns 400 when day is missing or invalid", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });

    const res = await GET(makeRequest(0));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Invalid day");
  });

  it("returns 400 when day is out of range (29)", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });

    const res = await GET(makeRequest(29));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Invalid day");
    expect(mockBuildCompletionPackFromLesson).not.toHaveBeenCalled();
  });

  it("returns 404 when lesson not found for day", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    // Mock only has "1"; day 2 is missing
    const res = await GET(makeRequest(2));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Lesson not found");
    expect(mockBuildCompletionPackFromLesson).not.toHaveBeenCalled();
  });

  it("returns 200 with pack when authenticated and day valid", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });

    const res = await GET(makeRequest(1));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.pack).toEqual({ summary: "pack" });
    expect(mockBuildCompletionPackFromLesson).toHaveBeenCalled();
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });

    const res = await GET(makeRequest(1));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data).toHaveProperty("pack");
  });
});
