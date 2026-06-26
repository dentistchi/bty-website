/**
 * GET /api/arena/action-contract/by-token — read-only witness pre-confirm (Ruling 3).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { signArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

const adminFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: adminFrom,
  })),
}));

describe("GET /api/arena/action-contract/by-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret-by-token");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    adminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { contract_description: "Call the patient's family before noon", status: "submitted" },
              error: null,
            }),
          }),
        }),
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function req(query: string) {
    return new NextRequest(`http://localhost/api/arena/action-contract/by-token${query}`);
  }

  function validToken() {
    return signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
  }

  it("400 when aalo token missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });

  it("401 when token invalid (malformed)", async () => {
    const res = await GET(req("?aalo=nope"));
    expect(res.status).toBe(401);
  });

  it("401 bad_signature when the payload is tampered (HMAC no longer matches)", async () => {
    // Keep the original (valid) signature but swap in a forged payload — e.g. an
    // attacker rewriting userId/contractId. The signature must no longer verify.
    const sig = validToken().split(".")[2];
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sessionId: "run1",
        userId: "attacker",
        actionId: "arena_action_loop:run1",
        issuedAt: Date.now(),
        contractId: "victim-contract",
      }),
      "utf8",
    ).toString("base64url");
    const tampered = `aalo1.${forgedPayload}.${sig}`;
    const res = await GET(req(`?aalo=${encodeURIComponent(tampered)}`));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("bad_signature");
  });

  it("401 bad_signature when the signature is forged", async () => {
    // Genuine payload, attacker-supplied signature.
    const b64 = validToken().split(".")[1];
    const forged = `aalo1.${b64}.Zm9yZ2VkLXNpZ25hdHVyZQ`;
    const res = await GET(req(`?aalo=${encodeURIComponent(forged)}`));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("bad_signature");
  });

  it("200 returns the promised action description + status (no mutation)", async () => {
    const res = await GET(req(`?aalo=${encodeURIComponent(validToken())}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; contractDescription: string; status: string };
    expect(data.ok).toBe(true);
    expect(data.contractDescription).toBe("Call the patient's family before noon");
    expect(data.status).toBe("submitted");
  });

  it("404 when the contract row is not found", async () => {
    adminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));
    const res = await GET(req(`?aalo=${encodeURIComponent(validToken())}`));
    expect(res.status).toBe(404);
  });
});
