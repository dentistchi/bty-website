/**
 * POST /api/bty/action-contract/submit-validation
 * G-B06: Layer 1 returns all field failures in one response (multi-field bundle).
 * G-B07: JSON exposes no validator rationale keys (VALIDATOR_ARCHITECTURE_V1 §5).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as validation from "@/lib/bty/validator/runActionContractValidation";
import { POST } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

/** Keys that must never appear in terminal outcomes (rationale / internal evaluation leakage). */
const FORBIDDEN_RATIONALE_KEYS = [
  "rationale",
  "rationale_text",
  "reasoning",
  "layer2_rationale",
  "internal_notes",
  "criteria",
  "layer2_criteria",
  "model_id",
  "confidence",
];

function makeSupabaseForContract(status: "pending" | "rejected" = "pending") {
  const contractRow = {
    id: "contract-1",
    user_id: "user-1",
    status,
    pattern_family: null as string | null,
    arena_scenario_id: "sc1",
  };
  return {
    from: vi.fn((table: string) => {
      if (table !== "bty_action_contracts") {
        return {};
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: contractRow, error: null }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      };
    }),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/bty/action-contract/submit-validation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bty/action-contract/submit-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("G-B06: returns multiple Layer 1 errors simultaneously (single response)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "they",
        what: "nothing",
        when: "later",
        how: "too short",
        raw_text: "This is the raw text line long enough for R6 to pass field presence.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      outcome?: string;
      layer1_errors?: { rule: string; signal: string }[];
    };
    expect(data.outcome).toBe("revise");
    expect(Array.isArray(data.layer1_errors)).toBe(true);
    expect(data.layer1_errors!.length).toBeGreaterThanOrEqual(2);
    const rules = new Set(data.layer1_errors!.map((e) => e.rule));
    expect(rules.has("R1")).toBe(true);
    expect(rules.has("R2")).toBe(true);
  });

  it("G-B07: approve response contains only outcome (no rationale keys)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(["outcome"]);
    expect(data.outcome).toBe("approve");
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("G-B07: reject response contains only outcome", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "reject",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "fail", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.8 },
        non_cosmetic: { outcome: "pass", confidence: 0.85 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(["outcome"]);
    expect(data.outcome).toBe("reject");
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("G-B07: escalate response contains only outcome", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "ambiguous", confidence: 0.5 },
        external_measurability: { outcome: "pass", confidence: 0.8 },
        non_cosmetic: { outcome: "pass", confidence: 0.85 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(["outcome"]);
    expect(data.outcome).toBe("escalate");
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });
});
