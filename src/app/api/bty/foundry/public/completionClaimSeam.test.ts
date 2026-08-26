import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * THE SEAM THAT SHIPPED BROKEN — service result → completion route JSON.
 *
 * FIRST CONTROLLED PRE-RELEASE COMPLETION, on a real device. The server minted the claim code,
 * hashed it, and stored a correct 90-day expiry — `claim_secret_hash` NON-NULL on progress
 * `c206971f`. The terminal showed nothing, because all three completion routes serialized
 *
 *     { ok: true, ...r.snapshot, applyWindow: r.applyWindow }
 *
 * and `claimCode` lives on the RESULT, not on the snapshot. The route dropped it, the client never
 * saw it, and the raw value is gone for good: only the hash is stored, by design.
 *
 * WHY THE EXISTING SUITE MISSED IT. It asserted both ends and never the wire between them — that
 * the services issue, and that the three clients read `d.claimCode` and render it. Nothing checked
 * that a claim code gets from one to the other, and no test invoked a completion route at all.
 * The pattern was already in the repo one file away: `applyNarration.test.ts` asserts
 * `applyWindow: r.applyWindow` across all six public routes. I read that file during this slice
 * and did not notice it was the shape I needed.
 *
 * SO THIS TEST INVOKES THE REAL ROUTE HANDLERS. The service is mocked to return a known result;
 * everything after it — the handler, the payload construction, the JSON — is the shipped code.
 * A source-substring assertion would have caught this particular line, but not a future refactor
 * that keeps the words and loses the field.
 */

// `vi.mock` is hoisted, so the stubs are created inside the factories and read back afterwards.
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/bty/foundry/events/foundryTrainingService", () => ({ completeTraining: vi.fn() }));
vi.mock("@/lib/bty/foundry/events/foundryDocumentService", () => ({ completeDocumentTraining: vi.fn() }));
// The guidance ROUTE also imports `resolveGuidanceType`, so the real module is kept and only the
// completion function is replaced.
// The guidance ROUTE resolves the content type before completing, so that lookup is stubbed too —
// it is a precondition of reaching the payload, not part of the seam under test.
vi.mock("@/lib/bty/foundry/events/foundryGuidanceService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bty/foundry/events/foundryGuidanceService")>()),
  resolveGuidanceType: vi.fn(async () => "written"),
  completeGuidanceTraining: vi.fn(),
}));

import { completeTraining } from "@/lib/bty/foundry/events/foundryTrainingService";
import { completeDocumentTraining } from "@/lib/bty/foundry/events/foundryDocumentService";
import { completeGuidanceTraining } from "@/lib/bty/foundry/events/foundryGuidanceService";

import { POST as videoPOST } from "@/app/api/bty/foundry/public/[token]/progress/complete/route";
import { POST as docPOST } from "@/app/api/bty/foundry/public/[token]/doc/complete/route";
import { POST as guidancePOST } from "@/app/api/bty/foundry/public/[token]/guidance/complete/route";

/** What an ANONYMOUS completion returns: a snapshot, an Apply outcome, and the one-time code. */
const anonymousResult = {
  ok: true,
  snapshot: { stage: "completed_claimable", content_type: "document", follow_up_days: 7 },
  applyWindow: "created",
  claimCode: "ABCD1234EFGH",
  claimExpiresAt: "2026-11-24T20:00:10.491Z",
} as never;

/** What a SIGNED-IN completion returns: no code, because the completion already has an owner. */
const identifiedResult = {
  ok: true,
  snapshot: { stage: "completed_awarded", content_type: "document", follow_up_days: 7 },
  applyWindow: "created",
} as never;

const req = () =>
  new NextRequest("https://app.test/api/bty/foundry/public/tok/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_text: "…" }),
  });
const ctx = { params: Promise.resolve({ token: "tok" }) };

const FAMILIES = [
  ["video", videoPOST, vi.mocked(completeTraining)],
  ["document", docPOST, vi.mocked(completeDocumentTraining)],
  ["guidance", guidancePOST, vi.mocked(completeGuidanceTraining)],
] as const;

beforeEach(() => {
  for (const [, , fn] of FAMILIES) fn.mockReset();
});

describe("[claim seam · T1-T6] every completion route puts the claim code on the wire", () => {
  for (const [name, handler, service] of FAMILIES) {
    it(`${name} route serializes claimCode and claimExpiresAt`, async () => {
      service.mockResolvedValue(anonymousResult);
      const body = await (await handler(req(), ctx)).json();
      expect(body.ok).toBe(true);
      expect(body.claimCode, `${name} claimCode`).toBe("ABCD1234EFGH");
      expect(body.claimExpiresAt, `${name} claimExpiresAt`).toBe("2026-11-24T20:00:10.491Z");
    });
  }
});

describe("[claim seam · T7-T12] and nothing else on the wire moved", () => {
  for (const [name, handler, service] of FAMILIES) {
    it(`${name} still serializes applyWindow and the whole snapshot`, async () => {
      service.mockResolvedValue(anonymousResult);
      const body = await (await handler(req(), ctx)).json();
      expect(body.applyWindow, name).toBe("created");
      expect(body.stage, name).toBe("completed_claimable");
      expect(body.content_type, name).toBe("document");
      expect(body.follow_up_days, name).toBe(7);
    });

    it(`${name} T12 a signed-in completion returns no code, and the payload is still valid`, async () => {
      service.mockResolvedValue(identifiedResult);
      const body = await (await handler(req(), ctx)).json();
      expect(body.ok, name).toBe(true);
      expect(body.stage, name).toBe("completed_awarded");
      // Undefined, not empty-string: the client renders the block only on a truthy code.
      expect(body.claimCode ?? null, name).toBeNull();
      expect(body.claimExpiresAt ?? null, name).toBeNull();
    });
  }

  it("T10 no private learner field is serialized by any completion route", async () => {
    for (const [name, handler, service] of FAMILIES) {
      service.mockResolvedValue(anonymousResult);
      const body = await (await handler(req(), ctx)).json();
      for (const priv of ["response_text", "decision_response_text", "learner_reflection_text", "shared_understanding_response"]) {
        expect(Object.keys(body), `${name}/${priv}`).not.toContain(priv);
      }
    }
  });

  it("T9 no completion route logs anything", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const p of ["progress", "doc", "guidance"]) {
      const src = readFileSync(join(process.cwd(), `src/app/api/bty/foundry/public/[token]/${p}/complete/route.ts`), "utf8");
      expect(src, p).not.toContain("console.");
    }
  });
});
