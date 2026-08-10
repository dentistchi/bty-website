import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHILD_REFUSAL_DIAGNOSTICS_ENABLED,
  DEPENDENCY_DIAGNOSTICS_ENABLED,
  BEHAVIOR_CONTRACT_DIAGNOSTICS_ENABLED,
  finalizeProgramCall,
} from "./programGenerationRecorder";

/**
 * SLICE 3.2P-R0.2 — EVERY CALL KEEPS ITS OWN REASON.
 *
 * The parent attempt stores one refusal: the last one. A repaired attempt makes two calls that
 * can fail for different reasons, and the fourth pilot window paid for that gap — its first
 * call was refused on `elements.reflection`, its repair was refused for something else, and
 * afterwards nothing could say which honesty rule the first refusal had been.
 *
 * These fixtures drive the real recorder against a captured update payload. Zero provider
 * calls, zero network.
 */
type Payload = Record<string, unknown>;

function makeAdmin() {
  const writes: { id: string; payload: Payload }[] = [];
  const admin = {
    from() {
      let captured: Payload = {};
      const b: Record<string, unknown> = {
        update(payload: Payload) {
          captured = payload;
          return b;
        },
        eq(_col: string, id: string) {
          writes.push({ id, payload: captured });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { admin, writes };
}

let harness: ReturnType<typeof makeAdmin>;
beforeEach(() => {
  harness = makeAdmin();
});

const finalize = (input: Parameters<typeof finalizeProgramCall>[1]) => finalizeProgramCall(harness.admin, input);
const written = (i = 0) => harness.writes[i].payload;

const semantic = (path: string) => ({
  stage: "semantic" as const,
  path,
  expected: "a grounded, honest value",
  actual: "string",
  retryable: false,
});

describe("[3.2P-R0.2] the flags are live", () => {
  it("all three diagnostic families are enabled", () => {
    expect(CHILD_REFUSAL_DIAGNOSTICS_ENABLED).toBe(true);
    expect(DEPENDENCY_DIAGNOSTICS_ENABLED).toBe(true);
    expect(BEHAVIOR_CONTRACT_DIAGNOSTICS_ENABLED).toBe(true);
  });
});

describe("[3.2P-R0.2] A — repair SUCCESS does not erase child 1's refusal", () => {
  it("child 1 keeps evidence_overclaim/reflection while child 2 records success", async () => {
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 5000,
      refusal: { code: "evidence_overclaim", kind: "reflection" },
      diagnosis: semantic("elements.reflection"),
    });
    await finalize({ callId: "c2", outcome: "success", durationMs: 4000 });

    expect(written(0)).toMatchObject({
      outcome: "schema_invalid",
      refusal_code: "evidence_overclaim",
      refusal_kind: "reflection",
      offending_path: "elements.reflection",
      validation_stage: "semantic",
    });
    // The successful repair writes its own row and cannot reach back into call 1's.
    expect(written(1)).toMatchObject({ outcome: "success", refusal_code: null, refusal_kind: null });
    expect(harness.writes[0].id).toBe("c1");
    expect(harness.writes[1].id).toBe("c2");
  });
});

describe("[3.2P-R0.2] B — repair FAILURE keeps BOTH histories, independently", () => {
  it("child 1 material_fabrication/reflection, child 2 its own refusal", async () => {
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 5000,
      refusal: { code: "material_fabrication", kind: "reflection" },
      diagnosis: semantic("elements.reflection"),
    });
    await finalize({
      callId: "c2", outcome: "schema_invalid", durationMs: 3000,
      refusal: { code: "missing_required_kind", kind: "follow_up" },
      diagnosis: semantic("elements.follow_up"),
    });

    expect(written(0)).toMatchObject({
      refusal_code: "material_fabrication", refusal_kind: "reflection", offending_path: "elements.reflection",
    });
    expect(written(1)).toMatchObject({
      refusal_code: "missing_required_kind", refusal_kind: "follow_up", offending_path: "elements.follow_up",
    });
    // Neither row's reason leaked into the other.
    expect(written(0).refusal_code).not.toBe(written(1).refusal_code);
  });
});

describe("[3.2P-R0.2] C — the bounded pressure repair keeps its first refusal", () => {
  it("child 1 scenario_without_pressure/scenario survives a successful repair", async () => {
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 5500,
      refusal: { code: "scenario_without_pressure", kind: "scenario" },
      diagnosis: semantic("elements.scenario"),
    });
    await finalize({ callId: "c2", outcome: "success", durationMs: 3800 });
    expect(written(0)).toMatchObject({ refusal_code: "scenario_without_pressure", refusal_kind: "scenario" });
    expect(written(1).refusal_code).toBeNull();
  });
});

describe("[3.2P-R0.2] D — a dependency refusal stores everything at once", () => {
  it("code, kind and all three dependency facts coexist", async () => {
    // The exact shape of pilot attempt 2, which the columns would now fully describe.
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 4112,
      refusal: { code: "dependency_inversion", kind: "completion_check" },
      diagnosis: semantic("elements.completion_check"),
      dependency: { branch: "used_before_defined", constructKind: "standard", counterpartKind: null },
    });
    expect(written(0)).toMatchObject({
      refusal_code: "dependency_inversion",
      refusal_kind: "completion_check",
      offending_path: "elements.completion_check",
      dependency_branch: "used_before_defined",
      dependency_construct_kind: "standard",
      dependency_counterpart_kind: null,
    });
  });

  it("a behaviour-contract refusal keeps its own two fields alongside the code", async () => {
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 3000,
      refusal: { code: "non_observable_standard", kind: "observable_standard" },
      diagnosis: semantic("elements.observable_standard"),
      behaviorContract: { field: "observable_action", reason: "meta_only" },
    });
    expect(written(0)).toMatchObject({
      refusal_code: "non_observable_standard",
      behavior_contract_field: "observable_action",
      behavior_contract_reason: "meta_only",
    });
  });

  it("[3.2P-R3] the interrogative refusal now records ALL FIVE diagnostics", async () => {
    /*
      The full end-to-end shape a question-shaped `observable_action` produces. Withheld for
      one deploy while the live CHECK still pinned six reasons; `20260816000000` is applied and
      the live constraint was probed without writing a row, so the seventh is now storable.
    */
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 3000,
      refusal: { code: "non_observable_standard", kind: "observable_standard" },
      diagnosis: semantic("elements.observable_standard"),
      behaviorContract: { field: "observable_action", reason: "interrogative_action" },
    });
    expect(written(0)).toMatchObject({
      refusal_code: "non_observable_standard",
      refusal_kind: "observable_standard",
      offending_path: "elements.observable_standard",
      behavior_contract_field: "observable_action",
      behavior_contract_reason: "interrogative_action",
    });
  });

  it("[3.2P-R3] a reason the live schema does NOT know is still withheld, not written blind", async () => {
    // The guard is about what the SCHEMA accepts, so it must keep refusing anything the live
    // CHECK has not been widened for — otherwise the next domain-first addition breaks writes.
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 3000,
      refusal: { code: "non_observable_standard", kind: "observable_standard" },
      diagnosis: semantic("elements.observable_standard"),
      behaviorContract: { field: "observable_action", reason: "a_reason_no_migration_added" },
    });
    expect(written(0)).toMatchObject({
      refusal_code: "non_observable_standard",
      behavior_contract_field: "observable_action",
      behavior_contract_reason: null,
    });
  });
});

describe("[3.2P-R0.2] E — the window-4 freeze case, recorded truthfully", () => {
  it("child 1 keeps its original refusal; child 2 records the retry's own outcome", async () => {
    /*
      The envelope discards the out-of-license repair and the PARENT terminates on the original
      refusal. The children still describe themselves: call 2 is not rewritten as call 1's
      failure, and call 1 is not rewritten as the consequence of the repair.
    */
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 5590,
      refusal: { code: "evidence_overclaim", kind: "reflection" },
      diagnosis: semantic("elements.reflection"),
    });
    await finalize({
      callId: "c2", outcome: "schema_invalid", durationMs: 3926,
      refusal: { code: "evidence_overclaim", kind: "reflection" },
      diagnosis: semantic("elements.reflection"),
    });
    expect(written(0).refusal_code).toBe("evidence_overclaim");
    expect(written(0).refusal_kind).toBe("reflection");
    expect(written(1).refusal_code, "the retry's recorded reason is its own").toBe("evidence_overclaim");
    // And nothing anywhere records the consequence as if it were the cause.
    for (const w of harness.writes) expect(w.payload.refusal_code).not.toBe("missing_required_kind");
  });
});

describe("[3.2P-R0.2] F — non-semantic failures invent nothing", () => {
  it("timeout, transport, http and unparseable output all leave both fields NULL", async () => {
    const cases = [
      { callId: "t1", outcome: "timeout" as const },
      { callId: "t2", outcome: "transport_error" as const, providerErrorCategory: "network" },
      { callId: "t3", outcome: "http_error" as const, providerHttpStatus: 503 },
      { callId: "t4", outcome: "malformed_output" as const },
      { callId: "t5", outcome: "empty_output" as const },
      { callId: "t6", outcome: "success" as const },
    ];
    for (const c of cases) await finalize({ ...c, durationMs: 1000 });
    for (let i = 0; i < cases.length; i++) {
      expect(written(i).refusal_code, cases[i].outcome).toBeNull();
      expect(written(i).refusal_kind, cases[i].outcome).toBeNull();
    }
  });

  it("a STRUCTURAL fault records its shape diagnosis and may carry its code, never a guessed one", async () => {
    await finalize({
      callId: "s1", outcome: "schema_invalid", durationMs: 900,
      refusal: { code: "field_type", kind: null },
      diagnosis: { stage: "structural", path: "program.behavior_contract.actor", expected: "string", actual: "number", retryable: true },
    });
    expect(written(0)).toMatchObject({
      refusal_code: "field_type", refusal_kind: null,
      validation_stage: "structural", offending_path: "program.behavior_contract.actor",
      expected_type: "string", actual_type: "number", structural_retryable: true,
    });
  });
});

describe("[3.2P-R0.2] R7 — no proposal prose reaches the ledger", () => {
  it("the payload carries codes, paths and digests only", async () => {
    await finalize({
      callId: "c1", outcome: "schema_invalid", durationMs: 4000,
      refusal: { code: "material_fabrication", kind: "reflection" },
      diagnosis: semantic("elements.reflection"),
      responseSha256: "a".repeat(64), responseBytes: 2400,
    });
    const payload = JSON.stringify(written(0));
    // Nothing that could be a sentence the model wrote.
    for (const f of ["content", "proposal", "display_title", "pressure_condition", "observable_action"]) {
      expect(payload, f).not.toContain(f);
    }
    expect(written(0).response_sha256).toBe("a".repeat(64));
  });
});
