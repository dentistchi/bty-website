/**
 * GET /api/dojo/questions — 500·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
}));

describe("GET /api/dojo/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when select fails", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "db_error" },
      }),
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db_error");
  });

  it("returns 500 with JSON body containing only error key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "db_error" },
      }),
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with choiceValues as array", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/public.*max-age=120/);
    const data = await res.json();
    expect(Array.isArray(data.choiceValues)).toBe(true);
  });

  it("returns 200 with exactly questions and choiceValues keys", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["choiceValues", "questions"].sort());
  });

  it("returns 200 with questions and choiceValues on success", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            area: "perspective_taking",
            order_in_area: 1,
            text_ko: "질문1",
            text_en: "Question 1",
            scale_type: "likert_5",
          },
        ],
        error: null,
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].id).toBe(1);
    expect(data.questions[0].area).toBe("perspective_taking");
    expect(data.questions[0].textKo).toBe("질문1");
    expect(data.choiceValues).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns 200 with multiple questions when data has two rows", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            area: "perspective_taking",
            order_in_area: 1,
            text_ko: "질문1",
            text_en: "Question 1",
            scale_type: "likert_5",
          },
          {
            id: 2,
            area: "communication",
            order_in_area: 1,
            text_ko: "질문2",
            text_en: "Question 2",
            scale_type: "likert_5",
          },
        ],
        error: null,
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toHaveLength(2);
    expect(data.questions[0].id).toBe(1);
    expect(data.questions[1].id).toBe(2);
    expect(data.questions[1].area).toBe("communication");
    expect(data.choiceValues).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns 200 with empty questions when no rows", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toEqual([]);
    expect(data.choiceValues).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns 200 with empty questions when data is null", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toEqual([]);
    expect(data.choiceValues).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("rejects when getSupabaseServerClient rejects", async () => {
    mockGetSupabaseServerClient.mockRejectedValue(new Error("supabase unavailable"));

    await expect(GET()).rejects.toThrow("supabase unavailable");
  });

  it("rejects when order() chain rejects", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(new Error("connection lost")),
    });

    await expect(GET()).rejects.toThrow("connection lost");
  });
});
