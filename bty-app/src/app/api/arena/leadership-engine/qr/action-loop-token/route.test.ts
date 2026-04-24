/**
 * POST /api/arena/leadership-engine/qr/action-loop-token — mint QR token for pending contract.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

type ContractRow = { id: string; session_id: string; status: string };

/** Each `from()` call gets the next scenario (supports second query: approved + validation_approved_at, verified_at null). */
function makeSupabaseContractMock(scenarios: Array<{ data: ContractRow | null }>) {
  let fromIndex = 0;
  return {
    from: vi.fn(() => {
      const scenarioIndex = fromIndex++;
      const row = scenarios[scenarioIndex]?.data ?? null;
      const b: {
        select: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        not: ReturnType<typeof vi.fn>;
        is: ReturnType<typeof vi.fn>;
        maybeSingle: ReturnType<typeof vi.fn>;
      } = {
        select: vi.fn(),
        eq: vi.fn(),
        not: vi.fn(),
        is: vi.fn(),
        maybeSingle: vi.fn(),
      };
      b.select.mockReturnValue(b);
      b.eq.mockReturnValue(b);
      b.not.mockReturnValue(b);
      b.is.mockReturnValue(b);
      b.maybeSingle.mockResolvedValue({ data: row, error: null });
      return b;
    }),
  };
}

describe("POST /api/arena/leadership-engine/qr/action-loop-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret-for-action-loop-token");
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function postReq(body: unknown, opts?: { locale?: string; origin?: string }): NextRequest {
    const q = opts?.locale ? `?locale=${encodeURIComponent(opts.locale)}` : "";
    const req = new NextRequest(`http://localhost/api/arena/leadership-engine/qr/action-loop-token${q}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts?.origin ? { origin: opts.origin } : {}),
      },
      body: JSON.stringify(body),
    });
    return req;
  }

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(postReq({ runId: "r1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 missing_run_id when runId empty", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: makeSupabaseContractMock([{ data: null }]),
      base: {},
    });
    const res = await POST(postReq({ runId: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_run_id");
  });

  it("returns 409 no_pending_contract when no matching row", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: makeSupabaseContractMock([{ data: null }, { data: null }]),
      base: {},
    });
    const res = await POST(postReq({ runId: "run-x" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("no_pending_contract");
  });

  it("returns 200 with token and url when pending contract exists", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: makeSupabaseContractMock([
        {
          data: {
            id: "cid-1",
            user_id: "u1",
            session_id: "run-xyz",
            status: "pending",
          },
        },
      ]),
      base: {},
    });
    const res = await POST(postReq({ runId: "run-xyz" }, { origin: "https://app.example" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token: string; url: string };
    expect(typeof data.token).toBe("string");
    expect(data.token.startsWith("aalo1.")).toBe(true);
    expect(data.url).toContain("https://app.example/en/my-page");
    expect(data.url).toContain("arena_action_loop=commit");
    expect(data.url).toContain("aalo=");
    expect(data.url).toMatch(/aalo=[^&]+/);
  });

  it("uses locale=ko in url when query locale=ko", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: makeSupabaseContractMock([
        {
          data: {
            id: "cid-1",
            user_id: "u1",
            session_id: "run-ko",
            status: "pending",
          },
        },
      ]),
      base: {},
    });
    const res = await POST(postReq({ runId: "run-ko" }, { locale: "ko" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { url: string };
    expect(data.url).toContain("/ko/my-page");
  });

  it("returns 200 when validator-approved contract awaits execution verify (second query)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: makeSupabaseContractMock([
        { data: null },
        {
          data: {
            id: "cid-val",
            user_id: "u1",
            session_id: "run-v",
            status: "approved",
          },
        },
      ]),
      base: {},
    });
    const res = await POST(postReq({ runId: "run-v" }, { origin: "https://app.example" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token: string };
    expect(data.token.startsWith("aalo1.")).toBe(true);
  });
});
