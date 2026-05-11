import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();
const mockRateLimitKV = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSupabaseFrom = vi.fn((table: string) => {
  if (table === "arena_profiles") {
    return {
      update: (vals: unknown) => ({
        eq: (_col: string, _val: unknown) => mockUpdate(vals),
      }),
    };
  }
  if (table === "arena_consent_log") {
    return {
      insert: (vals: unknown) => mockInsert(vals),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() =>
    NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getCfClientIp: () => "1.2.3.4",
  rateLimitKV: (...args: unknown[]) => mockRateLimitKV(...args),
}));

function reqWithBody(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/legal/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  });
}

async function loadPost() {
  const mod = await import("./route");
  return mod.POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimitKV.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockRequireUser.mockResolvedValue({
    user: { id: "user-uuid-1" },
    supabase: { from: mockSupabaseFrom },
    base: NextResponse.json({ ok: true }, { status: 200 }),
    error: null,
  });
  mockUpdate.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
});

describe("/api/legal/accept POST", () => {
  it("returns 429 when rate-limit not allowed", async () => {
    mockRateLimitKV.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 600 });
    const POST = await loadPost();
    const res = await POST(reqWithBody({}));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { retryAfterSeconds?: number };
    expect(body.retryAfterSeconds).toBe(600);
  });

  it("returns 401 when no auth", async () => {
    mockRequireUser.mockResolvedValueOnce({
      user: null,
      supabase: null,
      base: NextResponse.json({ ok: true }, { status: 200 }),
      error: null,
    });
    const POST = await loadPost();
    const res = await POST(reqWithBody({ consent_version: "2026-05-x", consent_locale: "en-US" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when consent_version missing", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody({ consent_locale: "en-US" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("consent_version_required");
  });

  it("returns 400 when consent_version format invalid", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "not-a-version", consent_locale: "en-US" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_consent_version");
  });

  it("returns 400 when consent_locale not allowed", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "2026-05-pending-v1", consent_locale: "zh-CN" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_consent_locale");
  });

  it("returns 500 when UPDATE fails", async () => {
    mockUpdate.mockResolvedValueOnce({ error: { message: "db down" } });
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "2026-05-pending-v1", consent_locale: "en-US" }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 200 + writes audit log with placeholder=true on happy path", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "2026-05-pending-v1", consent_locale: "en-US" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; consent_version?: string };
    expect(body.ok).toBe(true);
    expect(body.consent_version).toBe("2026-05-pending-v1");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockInsert.mock.calls[0]?.[0] as {
      consent_type?: string;
      action?: string;
      notes?: { placeholder?: boolean; sprint?: string };
      ip_address?: string;
    };
    expect(insertArg.consent_type).toBe("tos");
    expect(insertArg.action).toBe("accepted");
    expect(insertArg.notes?.placeholder).toBe(true);
    expect(insertArg.notes?.sprint).toBe("AL-LAUNCH-D3");
    expect(insertArg.ip_address).toBe("1.2.3.4");
  });

  it("returns 200 even when audit INSERT fails (UPDATE is primary)", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "audit failed" } });
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "2026-05-pending-v1", consent_locale: "en-US" }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects consent_version > 50 chars", async () => {
    const long = "2026-05-" + "a".repeat(50);
    const POST = await loadPost();
    const res = await POST(reqWithBody({ consent_version: long, consent_locale: "en-US" }));
    expect(res.status).toBe(400);
  });
});
