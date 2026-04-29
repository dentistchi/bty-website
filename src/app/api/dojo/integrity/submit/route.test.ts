import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockSubmitIntegrity = vi.fn();
vi.mock("@/lib/bty/foundry/integritySubmitService", () => ({
  submitIntegrity: (...args: unknown[]) => mockSubmitIntegrity(...args),
}));

const { getSupabaseServerClient } = await import(
  "@/lib/bty/arena/supabaseServer"
);

function makeRequest(body: {
  text?: string | null;
  choiceId?: string | null;
  scenarioId?: string | null;
}): Request {
  return new Request("http://localhost/api/dojo/integrity/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dojo/integrity/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as never);

    const res = await POST(makeRequest({ text: "한 줄 반성" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockSubmitIntegrity).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not valid JSON", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);

    const req = new Request("http://localhost/api/dojo/integrity/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_body");
    expect(mockSubmitIntegrity).not.toHaveBeenCalled();
  });

  it("returns 400 when service returns validation error", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: false,
      error: "missing_input",
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("missing_input");
    expect(mockSubmitIntegrity).toHaveBeenCalledOnce();
  });

  it("returns 200 with submissionId on success", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: "int-sub-123",
    });

    const res = await POST(makeRequest({ text: "환자 입장에서 생각해 봤어요." }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.submissionId).toBe("int-sub-123");
    expect(mockSubmitIntegrity).toHaveBeenCalledOnce();
  });

  it("returns 200 with content-type application/json on success", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: "int-1",
    });

    const res = await POST(makeRequest({ text: "reflection" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("calls submitIntegrity with payload and scenarioId option", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u2" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: "int-sub-456",
    });

    await POST(
      makeRequest({
        text: "My reflection",
        choiceId: "choice_A",
        scenarioId: "scenario_001",
      })
    );

    expect(mockSubmitIntegrity).toHaveBeenCalledOnce();
    const [supabase, userId, payload, options] = mockSubmitIntegrity.mock.calls[0];
    expect(supabase).toBeDefined();
    expect(userId).toBe("u2");
    expect(payload).toEqual({ text: "My reflection", choiceId: "choice_A" });
    expect(options).toEqual({ scenarioId: "scenario_001" });
  });

  it("calls submitIntegrity with text only and null choiceId when choiceId omitted", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: "int-1",
    });

    await POST(makeRequest({ text: "Reflection only" }));

    expect(mockSubmitIntegrity).toHaveBeenCalledOnce();
    const [, , payload] = mockSubmitIntegrity.mock.calls[0];
    expect(payload).toEqual({ text: "Reflection only", choiceId: null });
  });

  it("returns 200 when submissionId is null (insert failed)", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: null,
    });

    const res = await POST(makeRequest({ choiceId: "B" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissionId).toBeNull();
  });

  it("returns 200 with submissionId in response when service returns string", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: "int-abc-123",
    });

    const res = await POST(makeRequest({ text: "reflection" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissionId).toBe("int-abc-123");
  });

  it("returns 400 when service returns text_too_long", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: false,
      error: "text_too_long",
    });

    const res = await POST(makeRequest({ text: "x".repeat(5001) }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("text_too_long");
  });

  it("rejects when getSupabaseServerClient rejects", async () => {
    vi.mocked(getSupabaseServerClient).mockRejectedValue(new Error("supabase down"));

    await expect(POST(makeRequest({ text: "reflection" }))).rejects.toThrow("supabase down");
    expect(mockSubmitIntegrity).not.toHaveBeenCalled();
  });

  it("rejects when submitIntegrity throws", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockRejectedValue(new Error("db write failed"));

    await expect(POST(makeRequest({ text: "reflection" }))).rejects.toThrow("db write failed");
  });

  it("calls submitIntegrity with scenarioId null when body.scenarioId is omitted", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    } as never);
    mockSubmitIntegrity.mockResolvedValue({
      ok: true,
      submissionId: "int-1",
    });

    await POST(makeRequest({ text: "reflection" }));

    expect(mockSubmitIntegrity).toHaveBeenCalledOnce();
    const [, , , options] = mockSubmitIntegrity.mock.calls[0];
    expect(options).toEqual({ scenarioId: null });
  });
});
