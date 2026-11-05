import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

// Exercise the real authentication/consent gate and consent-version primitive.
// Only the Supabase and rate-limit I/O boundaries are replaced; no live calls occur.
const getUser = vi.fn();
const readProfile = vi.fn();
const budget = vi.fn();
const create = vi.fn();
const client = {
  auth: { getUser: () => getUser() },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => readProfile() }) }) }),
};

vi.mock("@/lib/bty/arena/supabaseServer", () => ({ getSupabaseServerClient: async () => client }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => client }));
vi.mock("@/lib/bty/arena/requireApprovedMembership", () => ({ requireApprovedMembership: async () => ({ approved: false }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKV: (...args: unknown[]) => budget(...args) }));
vi.mock("@/lib/bty/llm/client", () => ({ getLlmClient: () => ({ chat: { completions: { create } } }) }));

import { GET as access } from "./access/route";
import { POST as start } from "./start/route";
import { POST as turn } from "./turn/route";
import { POST as speech } from "./speech/route";
import { POST as feedback } from "./feedback/route";

const json = (body: unknown) => new Request("http://localhost/api", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const callEveryRoute = () => Promise.all([
  access(), start(json({ acknowledged: true })), turn(json({ state: "unread", text: "hello" })),
  speech(json({ state: "unread", index: 0 })), feedback(json({ state: "unread" })),
]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_PATIENT_ACCESS_MODE", "all_consented");
  vi.stubEnv("AI_PATIENT_ALLOWED_USER_IDS", "");
  vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "dedicated-test-key");
  vi.stubEnv("AI_PATIENT_SESSION_SECRET", "test-session-secret");
  getUser.mockResolvedValue({ data: { user: { id: "consented-staff-user" } }, error: null });
  readProfile.mockResolvedValue({ data: { consent_version: ACTIVE_CONSENT_VERSION }, error: null });
  budget.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("AI Patient all-consented mode retains the real consent gate", () => {
  it("current consent permits an authenticated user without membership or a pilot invitation", async () => {
    expect(await (await access()).json()).toEqual({ enabled: true });
    expect((await start(json({ acknowledged: true }))).status).toBe(200);
    expect(readProfile).toHaveBeenCalledTimes(2);
    expect(budget).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([null, "2026-05-pending-v1", "invented-version"])("consent version %j refuses every route before budgets or models", async (consentVersion) => {
    readProfile.mockResolvedValue({ data: { consent_version: consentVersion }, error: null });
    for (const response of await callEveryRoute()) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "consent_required" });
    }
    expect(budget).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("a consent read failure fails closed on every route", async () => {
    readProfile.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    for (const response of await callEveryRoute()) expect(response.status).toBe(403);
    expect(budget).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("an absent session is refused before consent, budgets and models", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    for (const response of await callEveryRoute()) expect(response.status).toBe(401);
    expect(readProfile).not.toHaveBeenCalled();
    expect(budget).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
