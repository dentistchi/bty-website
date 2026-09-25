import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const regenerateArenaDraft = vi.fn();
const readGenerationGovernance = vi.fn();

vi.mock("@/lib/bty/foundry/events/managerGate", () => ({
  requireManager: async () => ({ ok: true, ctx: { user: { id: "owner-1" }, admin: {}, base: NextResponse.json({ ok: true }) } }),
  managerJson: (_base: NextResponse, _req: NextRequest, body: unknown, status = 200) => NextResponse.json(body, { status }),
}));
vi.mock("@/lib/bty/foundry/arena/foundryArenaDraftService", () => ({
  regenerateArenaDraft: (...args: unknown[]) => regenerateArenaDraft(...args),
  readGenerationGovernance: (...args: unknown[]) => readGenerationGovernance(...args),
  toClientArenaDraft: (row: unknown) => row,
}));

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  regenerateArenaDraft.mockReset();
  readGenerationGovernance.mockReset();
});

const params = { params: Promise.resolve({ id: "draft-1" }) };
const intent = "11111111-1111-4111-8111-111111111111";
const post = () =>
  POST(
    new NextRequest("http://localhost/api/bty/foundry/arena-drafts/draft-1/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: "ko", submissionIntentId: intent, expectedGenerationInputRevision: 3, confirmSameInputRetry: true }),
    }),
    params,
  );

const revisionRequired = {
  generationInputRevision: 3,
  generationLocale: "ko" as const,
  refusalCount: 2,
  state: "revision_required" as const,
  canStartGeneration: false,
  requiresExplicitConfirmation: false,
  reviewSetupRecommended: true,
};

describe("POST /api/bty/foundry/arena-drafts/[id]/regenerate post-attempt governance", () => {
  it("returns the current two-refusal Korean governance after an acknowledged terminal quality refusal", async () => {
    regenerateArenaDraft.mockResolvedValue({
      ok: false,
      reason: "scenario_quality_rejected",
      outcome: "scenario_quality_rejected",
      attemptRef: "3ded4df1d93f",
    });
    readGenerationGovernance.mockResolvedValue(revisionRequired);

    const res = await post();
    expect(res.status).toBe(422);
    expect(readGenerationGovernance).toHaveBeenCalledWith({}, "owner-1", "draft-1", "ko");
    expect(await res.json()).toMatchObject({
      code: "scenario_quality_rejected",
      supportRef: "3ded4df1d93f",
      governance: revisionRequired,
    });
  });

  it("preserves admission governance and does not perform a second read when no attempt was created", async () => {
    const admissionGovernance = { ...revisionRequired, refusalCount: 1, state: "confirm_second_attempt" as const, requiresExplicitConfirmation: true };
    regenerateArenaDraft.mockResolvedValue({ ok: false, reason: "generation_retry_confirmation_required", governance: admissionGovernance });

    const res = await post();
    expect(res.status).toBe(409);
    expect(readGenerationGovernance).not.toHaveBeenCalled();
    expect((await res.json()).governance).toEqual(admissionGovernance);
  });
});
