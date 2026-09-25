import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const getOwnerArenaDraft = vi.fn();
const readGenerationGovernance = vi.fn();

vi.mock("@/lib/bty/foundry/events/managerGate", () => ({
  requireManager: async () => ({ ok: true, ctx: { user: { id: "owner-1" }, admin: {}, base: NextResponse.json({ ok: true }) } }),
  managerJson: (_base: NextResponse, _req: NextRequest, body: unknown, status = 200) => NextResponse.json(body, { status }),
}));

vi.mock("@/lib/bty/foundry/arena/foundryArenaDraftService", () => ({
  getOwnerArenaDraft: (...args: unknown[]) => getOwnerArenaDraft(...args),
  readGenerationGovernance: (...args: unknown[]) => readGenerationGovernance(...args),
  saveArenaDraftEdits: vi.fn(),
  toClientArenaDraft: (draft: unknown) => draft,
}));

let GET: typeof import("./route").GET;

beforeAll(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  getOwnerArenaDraft.mockReset();
  readGenerationGovernance.mockReset();
  getOwnerArenaDraft.mockResolvedValue({ id: "draft-1", owner_user_id: "owner-1" });
});

const params = { params: Promise.resolve({ id: "draft-1" }) };
const governance = (locale: "en" | "ko") => ({
  generationInputRevision: 3,
  generationLocale: locale,
  refusalCount: locale === "ko" ? 1 : 0,
  state: locale === "ko" ? "confirm_second_attempt" : "ready",
  canStartGeneration: locale !== "ko",
  requiresExplicitConfirmation: locale === "ko",
  reviewSetupRecommended: locale === "ko",
});

function req(locale: "en" | "ko") {
  return new NextRequest(`http://localhost/api/bty/foundry/arena-drafts/draft-1?locale=${locale}`);
}

describe("GET /api/bty/foundry/arena-drafts/[id] governance locale", () => {
  it("returns the Korean epoch's confirmation governance without merging English refusal history", async () => {
    readGenerationGovernance.mockResolvedValue(governance("ko"));
    const res = await GET(req("ko"), params);
    expect(res.status).toBe(200);
    expect(readGenerationGovernance).toHaveBeenCalledWith({}, "owner-1", "draft-1", "ko");
    expect((await res.json()).governance).toMatchObject({ generationLocale: "ko", refusalCount: 1, state: "confirm_second_attempt" });
  });

  it("keeps English governance independent when locale=en is explicit", async () => {
    readGenerationGovernance.mockResolvedValue(governance("en"));
    const res = await GET(req("en"), params);
    expect(res.status).toBe(200);
    expect(readGenerationGovernance).toHaveBeenCalledWith({}, "owner-1", "draft-1", "en");
    expect((await res.json()).governance).toMatchObject({ generationLocale: "en", refusalCount: 0, state: "ready" });
  });
});
