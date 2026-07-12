/**
 * /api/me/today/living-response — auth, claim branches, admission→generation→validation→settle,
 * and the provider call-count contract. admitLivingResponse + validateLivingResponse + selectFallbackLine
 * run REAL; commitment ref, claim, evidence assembly, generation, and settle are mocked.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { evidenceFingerprint, type LivingResponsePacket } from "@/domain/daily/livingResponse";

const mockGetUser = vi.fn();
const mockGetAdmin = vi.fn();
const mockRef = vi.fn();
const mockClaim = vi.fn();
const mockAssemble = vi.fn();
const mockGenerate = vi.fn();
const mockSettle = vi.fn();
const mockGetView = vi.fn();
const mockRecent = vi.fn();

vi.mock("@/lib/supabase-server", () => ({ getSupabaseServer: () => Promise.resolve({ auth: { getUser: () => mockGetUser() } }) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => mockGetAdmin() }));
vi.mock("@/lib/bty/daily/todayRelationshipCommitment.server", () => ({ getTodayCommitmentRef: (...a: unknown[]) => mockRef(...a) }));
vi.mock("@/lib/bty/daily/livingResponseEvidence.server", () => ({ assembleLivingResponsePacket: (...a: unknown[]) => mockAssemble(...a) }));
vi.mock("@/lib/bty/daily/livingResponseGenerate.server", () => ({ generateLivingResponse: (...a: unknown[]) => mockGenerate(...a) }));
vi.mock("@/lib/bty/daily/livingResponse.server", () => ({
  claimLivingResponse: (...a: unknown[]) => mockClaim(...a),
  getLivingResponseView: (...a: unknown[]) => mockGetView(...a),
  recentPerspectives: (...a: unknown[]) => mockRecent(...a),
  settleLivingResponse: (...a: unknown[]) => mockSettle(...a),
}));

import { GET, POST } from "./route";

const packet = (facts: LivingResponsePacket["facts"], relationship: "self" | "others" | "world" = "self"): LivingResponsePacket => ({
  commitmentId: "c1", userId: "user-1", dayKey: "2026-07-12", relationship, facts, prohibitedFieldsPresent: false, evidenceFingerprint: evidenceFingerprint(facts),
});
const strongSelf = packet([{ id: "f", code: "SELF_RETURN_STRONG", relationship: "self", evidenceClass: "self_return_continuity", confidence: "high", provenanceIds: ["d1", "d2", "d3", "d4"] }]);
const settledView = (status: string, perspective: string, source: string) => ({ status, relationship: "self", perspective, source, confidence: source === "generated" ? "grounded" : "limited" });

const authed = () => mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
const post = () => new NextRequest("http://localhost/api/me/today/living-response", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeZone: "Asia/Seoul" }) });
const get = () => new NextRequest("http://localhost/api/me/today/living-response?tz=Asia%2FSeoul");

describe("/api/me/today/living-response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdmin.mockReturnValue({});
    mockRef.mockResolvedValue({ id: "c1", relationship: "self", dayKey: "2026-07-12", locale: "en" });
    mockRecent.mockResolvedValue([]);
    // mirror the real toView projection: generated → 'ready', fallback → 'fallback'
    mockSettle.mockImplementation((_a, _c, _t, patch) =>
      Promise.resolve(settledView(patch.status === "generated" ? "ready" : "fallback", patch.perspective, patch.source)),
    );
  });

  it("POST unauthenticated → 401, zero provider calls", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("GET unauthenticated → 401", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(get())).status).toBe(401);
  });

  it("POST with no commitment → 409 NO_COMMITMENT, zero provider calls", async () => {
    authed();
    mockRef.mockResolvedValue(null);
    const res = await POST(post());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NO_COMMITMENT");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("claim SETTLED → returns canonical, ZERO provider calls", async () => {
    authed();
    mockClaim.mockResolvedValue("SETTLED");
    mockGetView.mockResolvedValue(settledView("ready", "A quiet return.", "generated"));
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect((await res.json()).response.status).toBe("ready");
  });

  it("claim IN_PROGRESS → pending, ZERO provider calls", async () => {
    authed();
    mockClaim.mockResolvedValue("IN_PROGRESS");
    const res = await POST(post());
    expect((await res.json()).response.status).toBe("pending");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("CLAIMED + ineligible (no facts) → fallback, ZERO provider calls", async () => {
    authed();
    mockClaim.mockResolvedValue("CLAIMED");
    mockAssemble.mockResolvedValue(packet([]));
    const res = await POST(post());
    const d = await res.json();
    expect(d.response.status).toBe("fallback");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("CLAIMED + eligible + generation ok + validation ok → generated, EXACTLY ONE provider call", async () => {
    authed();
    mockClaim.mockResolvedValue("CLAIMED");
    mockAssemble.mockResolvedValue(strongSelf);
    mockGenerate.mockResolvedValue({ ok: true, perspective: "Returning to yourself is quiet work, and it still counts.", modelVersion: "m", promptVersion: "p" });
    const res = await POST(post());
    const d = await res.json();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(d.response.status).toBe("ready");
    expect(d.response.source).toBe("generated");
  });

  it("CLAIMED + eligible + generation fails → fallback", async () => {
    authed();
    mockClaim.mockResolvedValue("CLAIMED");
    mockAssemble.mockResolvedValue(strongSelf);
    mockGenerate.mockResolvedValue({ ok: false, reason: "PROVIDER_TIMEOUT" });
    const res = await POST(post());
    expect((await res.json()).response.status).toBe("fallback");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("CLAIMED + eligible + invalid output (question) → fallback (no looser retry)", async () => {
    authed();
    mockClaim.mockResolvedValue("CLAIMED");
    mockAssemble.mockResolvedValue(strongSelf);
    mockGenerate.mockResolvedValue({ ok: true, perspective: "Will you return to yourself today?", modelVersion: "m", promptVersion: "p" });
    const res = await POST(post());
    expect((await res.json()).response.status).toBe("fallback");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  // Integration: the ACTUAL route (real validator + real guard phrases) rejects restatements.
  const restated = [
    ["EN pre-confirm CTA", "en", "I'll live this relationship today"],
    ["EN confirmed CTA", "en", "I'm living this relationship today"],
    ["EN benediction", "en", "You have entered the relationship with yourself today."],
    ["KO pre-confirm CTA", "ko", "오늘 이 관계로 살아갑니다"],
    ["KO confirmed CTA", "ko", "오늘 이 관계 안에 있습니다"],
    ["KO benediction", "ko", "오늘 당신은 나와의 관계 안으로 들어갔습니다."],
  ] as const;
  for (const [name, locale, line] of restated) {
    it(`model output restating the ${name} → deterministic fallback, exactly one provider call`, async () => {
      authed();
      mockRef.mockResolvedValue({ id: "c1", relationship: "self", dayKey: "2026-07-12", locale });
      mockClaim.mockResolvedValue("CLAIMED");
      mockAssemble.mockResolvedValue(strongSelf);
      mockGenerate.mockResolvedValue({ ok: true, perspective: line, modelVersion: "m", promptVersion: "p" });
      const res = await POST(post());
      expect((await res.json()).response.status).toBe("fallback");
      expect(mockGenerate).toHaveBeenCalledTimes(1); // no looser-validation retry
    });
  }

  it("model output with an EN number-word count → fallback", async () => {
    authed();
    mockClaim.mockResolvedValue("CLAIMED");
    mockAssemble.mockResolvedValue(strongSelf);
    mockGenerate.mockResolvedValue({ ok: true, perspective: "You returned to yourself three times", modelVersion: "m", promptVersion: "p" });
    expect((await (await POST(post())).json()).response.status).toBe("fallback");
  });

  it("GET returns the settled response for the committed day", async () => {
    authed();
    mockGetView.mockResolvedValue(settledView("ready", "A quiet return.", "generated"));
    const res = await GET(get());
    const d = await res.json();
    expect(d).toMatchObject({ ok: true, committed: true });
    expect(d.response.status).toBe("ready");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("GET with no commitment → committed:false, null response", async () => {
    authed();
    mockRef.mockResolvedValue(null);
    const d = await (await GET(get())).json();
    expect(d).toMatchObject({ ok: true, committed: false, response: null });
  });

  it("uses the authenticated user id for claim (never a client value)", async () => {
    authed();
    mockClaim.mockResolvedValue("IN_PROGRESS");
    await POST(post());
    expect(mockClaim.mock.calls[0][1].userId).toBe("user-1");
  });
});
