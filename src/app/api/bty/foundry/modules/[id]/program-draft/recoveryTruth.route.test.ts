import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE R4-R9A TEST T1 — THE ROUTE SEAM MY OWN SLICE-A TEST MOCKED AWAY.
 *
 * `hostAuthoringSimplificationA.test.tsx` T17 asserted "a provider failure offers a retry and the
 * retry makes a second call" against a stub that SUCCEEDS on retry. It proved the client re-POSTs
 * and nothing else. It could not see that the server had already established the refusal was not
 * retryable, because the server never said so and the client never asked.
 *
 * These two tests are that seam: what the failure response CARRIES, and whether a context the
 * ledger has already refused can be asked about without spending.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const getOwnerDraft = vi.fn();
const generateProgram = vi.fn();
const terminalVerdict = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => true }));
vi.mock("@/lib/bty/foundry/events/foundryModuleService", () => ({
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
}));
vi.mock("@/lib/bty/foundry/events/draftAssetService", () => ({ listDraftAssets: async () => [] }));
vi.mock("@/lib/bty/foundry/events/programGenerationRecorder", () => ({
  resolveProgramGenerationAuthority: async () => ({ state: "clear" }),
  readResumeEligibility: async () => ({ ok: false, reason: "attempt_not_found" }),
  readTerminalVerdictForContext: (...a: unknown[]) => terminalVerdict(...a),
}));
vi.mock("@/lib/bty/foundry/events/programAuthorshipService", () => ({
  generateProgram: (...a: unknown[]) => generateProgram(...a),
}));
vi.mock("@/lib/bty/foundry/arena/sourceIdentity", () => ({
  currentSourceIdentity: () => ({ sourceCommitSha: "test-sha" }),
}));

let POST: typeof import("./route").POST;
let GET: typeof import("./route").GET;
beforeAll(async () => { ({ POST, GET } = await import("./route")); });

const DRAFT = "a1000000-0000-4000-8000-000000000001";
const USER = "u1000000-0000-4000-8000-000000000002";

/** The Founder's own measured draft shape. */
const ANSWERS = {
  title: "업무 인계 확인하기",
  problem: "업무를 인계한 뒤 서로 확인하지 않아 중요한 일이 빠진다.",
  audienceType: "leaders",
  recurringMoment: "업무를 다른 사람에게 넘길 때",
  observableBehavior: "업무를 넘길 때 해야 할 일과 완료 시점을 분명히 말하고, 상대가 이해한 내용을 한 번 확인한다.",
  successEvidence: "업무를 받은 사람이 해야 할 일과 완료 시점을 정확히 설명할 수 있고, 정한 시점에 완료 여부가 확인된다.",
  evidenceType: "seen",
  materialIntent: "written",
  materialText: "인계 기준 한 장.",
} as unknown as BuilderAnswers;

const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);
const params = Promise.resolve({ id: DRAFT });

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockReturnValue({ id: USER });
  getOwnerDraft.mockResolvedValue({ id: DRAFT, status: "draft", answers: ANSWERS });
  terminalVerdict.mockResolvedValue(null);
});

describe("[R4-R9A · T1] the failure response carries the server's own verdict", () => {
  it("a refused program serialises regenerate_allowed and the Host answer to revisit", async () => {
    // EXACTLY the measured refusal: attempt `0382af99`, both calls, on live deploy 8266f35f.
    generateProgram.mockResolvedValue({
      ok: false,
      code: "invalid_output",
      refusal: "non_observable_standard",
      refusalKind: "observable_standard",
    });
    const req = new NextRequest("http://x/api/bty/foundry/modules/a/program-draft", {
      method: "POST",
      body: JSON.stringify({ locale: "ko", submission_intent_id: "b2000000-0000-4000-8000-000000000003", context_fingerprint: FINGERPRINT }),
    });
    const res = await POST(req, { params });
    const body = (await res.json()) as Record<string, unknown>;
    /*
      CORRECTED BY R9B. Attempt #3 on the Founder's draft succeeded on the SAME fingerprint two
      refusals had rejected, so a semantic refusal is a fact about one response, not the context.
      The Host may ask BTY again; what they are told is `regenerate_allowed`, not "retry".
    */
    expect(body.recovery_mode).toBe("regenerate_allowed");
    expect(body.retryable).toBe(true);
    expect(body.recovery_target).toEqual({ field: "observableBehavior", step: 4 });
    // The Host-facing surface renders from these two; the raw codes stay for the ledger.
    expect(body.refusal).toBe("non_observable_standard");
  });

  it("a provider outage serialises retryable=true and no source to revisit", async () => {
    generateProgram.mockResolvedValue({ ok: false, code: "provider_unavailable", refusalKind: null });
    const req = new NextRequest("http://x/api/bty/foundry/modules/a/program-draft", {
      method: "POST",
      body: JSON.stringify({ locale: "ko", submission_intent_id: "b3000000-0000-4000-8000-000000000004", context_fingerprint: FINGERPRINT }),
    });
    const body = (await (await POST(req, { params })).json()) as Record<string, unknown>;
    expect(body.recovery_mode).toBe("transient_retry");
    expect(body.retryable).toBe(true);
    expect(body.recovery_target).toBeNull();
  });
});

describe("[R4-R9A · T7] the ledger can be asked about a context without spending", () => {
  const ask = (fp: string) =>
    GET(new NextRequest(`http://x/api/bty/foundry/modules/a/program-draft?context=${encodeURIComponent(fp)}`), { params });

  it("an already-refused context answers with the recovery, and calls no provider", async () => {
    terminalVerdict.mockResolvedValue({ code: "invalid_output", refusal: "non_observable_standard", kind: "observable_standard" });
    const body = (await (await ask(FINGERPRINT)).json()) as { refusal: Record<string, unknown> | null };
    expect(body.refusal).toMatchObject({ recovery_mode: "regenerate_allowed", recovery_target: { field: "observableBehavior", step: 4 } });
    expect(generateProgram, "asking must never generate").not.toHaveBeenCalled();
  });

  it("a context with no verdict answers null, so generation proceeds normally", async () => {
    terminalVerdict.mockResolvedValue(null);
    const body = (await (await ask(FINGERPRINT)).json()) as { refusal: unknown };
    expect(body.refusal).toBeNull();
  });

  it("a TRANSIENT terminal verdict is not restored — it decided nothing about the training", async () => {
    // A provider outage last night must not strand a Host behind a failure that has since ended.
    // A regenerable refusal IS restored (above): it decided something, and reopening must not spend.
    terminalVerdict.mockResolvedValue({ code: "provider_unavailable", refusal: null, kind: null });
    const body = (await (await ask(FINGERPRINT)).json()) as { refusal: unknown };
    expect(body.refusal).toBeNull();
  });

  it("a fingerprint the draft no longer has answers nothing", async () => {
    terminalVerdict.mockResolvedValue({ code: "invalid_output", refusal: "non_observable_standard", kind: "observable_standard" });
    const body = (await (await ask("a-fingerprint-from-before-the-edit")).json()) as { refusal: unknown };
    expect(body.refusal).toBeNull();
    expect(terminalVerdict, "a moved context is not even looked up").not.toHaveBeenCalled();
  });
});

