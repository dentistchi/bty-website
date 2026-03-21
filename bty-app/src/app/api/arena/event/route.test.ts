/**
 * POST /api/arena/event — 401·400 (SPRINT 57 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("POST /api/arena/event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 runId_required when body empty", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("runId_required");
  });

  it("returns 400 runId_required when runId has internal whitespace (arenaRunIdFromUnknown)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1 r2",
        scenarioId: "s1",
        eventType: "CHOICE",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId_required");
  });

  it("returns 400 scenarioId_required when scenarioId is whitespace-only (arenaScenarioIdFromUnknown)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "   ",
        eventType: "CHOICE",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  /** S103 C3 TASK9: optional `previewDescriptionLines` — `arenaScenarioDescriptionLinesFromUnknown` rejects → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is present but empty array", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: [],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S105 C3 TASK9: optional `previewDescriptionLines` — `null` element (≠ S103 empty array). */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines contains a null element", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: ["ok", null],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S120 C3 TASK9: optional `previewDescriptionLines` — boolean (≠ S117 number · S112 string) → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is boolean", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S117 C3 TASK9: optional `previewDescriptionLines` — number (≠ S103 [] · S105 null elt · S112 string) → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is a number", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: 3,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /**
   * S146 C3 TASK9: optional `previewDescriptionLines` — bigint (≠ **S117** number · **S145** `free-response` `responseText`).
   * JSON은 bigint를 담지 못해 `req.json()` 스텁으로 파싱 결과만 재현.
   */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is bigint", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    vi.spyOn(req, "json").mockResolvedValue({
      runId: "r1",
      scenarioId: "s1",
      eventType: "CHOICE",
      previewDescriptionLines: BigInt(0),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S112 C3 TASK9: optional `previewDescriptionLines` — JSON string (≠ array) → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is a string", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: "not-an-array",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S127 C3 TASK9: optional `previewDescriptionLines` — JSON `null` (키 존재) (≠ S120 boolean) → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is JSON null", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: null,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S138 C3 TASK9: optional `previewDescriptionLines` — 배열 **첫 요소**가 객체 `[{}]` (≠ **S133** 최상위 `{}`) → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines first element is a plain object", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: [{}],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  /** S133 C3 TASK9: optional `previewDescriptionLines` — plain object `{}` (≠ S112 string · S117 number · S127 JSON null) → 400. */
  it("returns 400 preview_description_lines_invalid when previewDescriptionLines is a plain object", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "CHOICE",
        previewDescriptionLines: {},
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("preview_description_lines_invalid");
  });

  it("returns 400 eventType_required when eventType is whitespace-only", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const req = new Request("http://localhost/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        eventType: "  \t  ",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("eventType_required");
  });
});
