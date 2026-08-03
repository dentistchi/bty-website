import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCallSequenceAllocator } from "@/domain/foundry/arena-draft/generationCallSequence";
import { createCallRecorder, digestModelContent, runInstrumentedCall } from "./generationCallRecorder";

/**
 * PROVIDER-CALL RECORDER LIFECYCLE (Slice 3.2I-R5B2-R5C-2A).
 *
 * The recorder never calls a provider. It decides whether one MAY be called, and the order is the
 * whole contract: a durable row, then a durable `provider_invoked_at`, and only then the network.
 * R4 lost an entire outage because a call happened with nothing written down first.
 *
 * Nothing here touches a network. There is no provider, mocked or otherwise.
 */

type Row = Record<string, unknown>;

/** Records every persistence payload so tests can assert on exactly what would be stored. */
function makeAdmin(fail: { prepare?: boolean; invoke?: boolean; finalize?: boolean } = {}) {
  const rows: Row[] = [];
  const payloads: Row[] = [];
  function from(_table: string) {
    let op: "insert" | "update" = "insert";
    let payload: Row = {};
    const filters: Array<[string, unknown]> = [];
    const api = {
      insert: (r: Row) => {
        op = "insert";
        payload = r;
        payloads.push(r);
        return api;
      },
      update: (p: Row) => {
        op = "update";
        payload = p;
        payloads.push(p);
        return api;
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      select: () => api,
      single: async () => settle(),
      then: (res: (v: unknown) => unknown) => Promise.resolve(settle()).then(res),
    };
    function settle() {
      if (op === "insert") {
        if (fail.prepare) return { data: null, error: { code: "42501", message: "denied" } };
        const row = { id: `call-${rows.length + 1}`, ...payload };
        rows.push(row);
        return { data: row, error: null };
      }
      const isInvoke = payload.lifecycle_state === "in_flight";
      if (isInvoke && fail.invoke) return { data: null, error: { code: "XX000", message: "no" } };
      if (!isInvoke && fail.finalize) return { data: null, error: { code: "XX000", message: "no" } };
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      for (const r of hit) Object.assign(r, payload);
      return { data: hit, error: null };
    }
    return api;
  }
  return { admin: { from } as unknown as SupabaseClient, rows, payloads };
}

const recorderFor = (admin: SupabaseClient, attemptId = "att-1") =>
  createCallRecorder(admin, attemptId, createCallSequenceAllocator());

const PREPARE = {
  kind: "generation" as const,
  model: "gpt-4o-mini",
  providerTimeoutMs: 120_000,
  maxTokens: 16_000,
  structuredOutputMode: "json_schema_strict" as const,
  locale: "en" as const,
};

describe("[R5C-2A] a provider call cannot start before it is written down", () => {
  it("prepare persists a `prepared` row with no invocation timestamp", async () => {
    const { admin, rows } = makeAdmin();
    const handle = await recorderFor(admin).prepare(PREPARE);
    expect(handle).not.toBeNull();
    expect(rows[0].lifecycle_state).toBe("prepared");
    expect(rows[0].provider_invoked_at ?? null).toBeNull();
    expect(rows[0].global_sequence).toBe(1);
    expect(rows[0].kind_sequence).toBe(1);
    expect(rows[0].call_kind).toBe("generation");
  });

  it("PREPARE FAILURE denies the call — the handle is null", async () => {
    const { admin } = makeAdmin({ prepare: true });
    expect(await recorderFor(admin).prepare(PREPARE)).toBeNull();
  });

  it("invoke persists provider_invoked_at BEFORE granting permission", async () => {
    const { admin, rows } = makeAdmin();
    const r = recorderFor(admin);
    const handle = (await r.prepare(PREPARE))!;
    expect(await r.invoke(handle)).toBe(true);
    expect(rows[0].lifecycle_state).toBe("in_flight");
    expect(rows[0].provider_invoked_at).toBeTruthy();
  });

  it("INVOKE FAILURE denies the call", async () => {
    const { admin } = makeAdmin({ invoke: true });
    const r = recorderFor(admin);
    const handle = (await r.prepare(PREPARE))!;
    expect(await r.invoke(handle)).toBe(false);
  });

  it("a prepared-but-uninvoked row is NOT a provider invocation", async () => {
    const { admin, rows } = makeAdmin();
    await recorderFor(admin).prepare(PREPARE);
    // The authoritative count is rows with provider_invoked_at — never the row count.
    expect(rows).toHaveLength(1);
    expect(rows.filter((r) => r.provider_invoked_at).length).toBe(0);
  });
});

describe("[R5C-2A] finalization is scoped, idempotent and one-way", () => {
  const finish = async (admin: SupabaseClient) => {
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    return { r, h };
  };

  it("only an in_flight row can be finalized", async () => {
    const { admin, payloads } = makeAdmin();
    const { r, h } = await finish(admin);
    expect(await r.finalize(h, { outcome: "success", durationMs: 10 })).toBe(true);
    const last = payloads[payloads.length - 1];
    expect(last.lifecycle_state).toBe("completed");
    expect(last.outcome).toBe("success");
  });

  it("a second finalization cannot overwrite the first terminal outcome", async () => {
    const { admin, rows } = makeAdmin();
    const { r, h } = await finish(admin);
    await r.finalize(h, { outcome: "timeout", durationMs: 10 });
    expect(rows[0].outcome).toBe("timeout");
    // The update is scoped to `in_flight`, so this matches nothing.
    await r.finalize(h, { outcome: "success", durationMs: 20 });
    expect(rows[0].outcome).toBe("timeout");
    expect(rows[0].lifecycle_state).toBe("completed");
  });

  it("a completed row cannot be reopened as in-flight", async () => {
    const { admin, rows } = makeAdmin();
    const { r, h } = await finish(admin);
    await r.finalize(h, { outcome: "success", durationMs: 5 });
    expect(await r.invoke(h)).toBe(false); // scoped to `prepared`
    expect(rows[0].lifecycle_state).toBe("completed");
  });

  it("a handle cannot be finalized through another parent's recorder", async () => {
    const { admin, rows } = makeAdmin();
    const { h } = await finish(admin);
    const other = createCallRecorder(admin, "att-OTHER", createCallSequenceAllocator());
    await other.finalize(h, { outcome: "success", durationMs: 1 });
    // Every write is filtered by attempt_id, so the row is untouched.
    expect(rows[0].lifecycle_state).toBe("in_flight");
    expect(rows[0].outcome ?? null).toBeNull();
  });

  it("a failed finalization leaves an observable in_flight row and asks for nothing", async () => {
    const { admin, rows } = makeAdmin({ finalize: true });
    const { r, h } = await finish(admin);
    expect(await r.finalize(h, { outcome: "success", durationMs: 5 })).toBe(false);
    // An orphan is the honest record of a lost answer — never an invented completion.
    expect(rows[0].lifecycle_state).toBe("in_flight");
  });
});

describe("[R5C-2A] runInstrumentedCall enforces the order", () => {
  it("the function runs only AFTER in_flight is durable, and exactly once", async () => {
    const { admin, rows } = makeAdmin();
    const seenAtRun: unknown[] = [];
    const run = vi.fn(async () => {
      seenAtRun.push(rows[0].lifecycle_state, rows[0].provider_invoked_at);
      return "ok";
    });
    const res = await runInstrumentedCall(recorderFor(admin), PREPARE, run, () => ({ outcome: "success" }));
    expect(res).toEqual({ status: "ran", value: "ok" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(seenAtRun[0]).toBe("in_flight");
    expect(seenAtRun[1]).toBeTruthy();
  });

  it("a prepare refusal NEVER runs the function, and is not a provider failure", async () => {
    const { admin } = makeAdmin({ prepare: true });
    const run = vi.fn(async () => "ok");
    const res = await runInstrumentedCall(recorderFor(admin), PREPARE, run, () => ({ outcome: "success" }));
    expect(run).not.toHaveBeenCalled();
    // `blocked` is distinct from any provider outcome.
    expect(res).toEqual({ status: "blocked", at: "prepare" });
  });

  it("an invoke refusal never runs the function", async () => {
    const { admin } = makeAdmin({ invoke: true });
    const run = vi.fn(async () => "ok");
    const res = await runInstrumentedCall(recorderFor(admin), PREPARE, run, () => ({ outcome: "success" }));
    expect(run).not.toHaveBeenCalled();
    expect(res).toEqual({ status: "blocked", at: "invoke" });
  });

  it("a real provider exception is finalized and RE-THROWN, never swallowed into success", async () => {
    const { admin, rows } = makeAdmin();
    const boom = new Error("transport");
    await expect(
      runInstrumentedCall(
        recorderFor(admin),
        PREPARE,
        async () => {
          throw boom;
        },
        () => ({ outcome: "transport_error" }),
      ),
    ).rejects.toBe(boom);
    expect(rows[0].outcome).toBe("transport_error");
    expect(rows[0].lifecycle_state).toBe("completed");
  });

  it("a finalization failure does not run the function again", async () => {
    const { admin } = makeAdmin({ finalize: true });
    const run = vi.fn(async () => "ok");
    const res = await runInstrumentedCall(recorderFor(admin), PREPARE, run, () => ({ outcome: "success" }));
    expect(run).toHaveBeenCalledTimes(1);
    // The provider result is preserved unchanged for the caller.
    expect(res).toEqual({ status: "ran", value: "ok" });
  });

  it("with no recorder the behaviour is unchanged and no telemetry is fabricated", async () => {
    const run = vi.fn(async () => "ok");
    const res = await runInstrumentedCall(null, PREPARE, run, () => ({ outcome: "success" }));
    expect(res).toEqual({ status: "ran", value: "ok" });
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("[R5C-2A] response identity", () => {
  it("identical bytes give an identical digest; one byte changes it", async () => {
    const a = await digestModelContent('{"a":1}');
    const b = await digestModelContent('{"a":1}');
    const c = await digestModelContent('{"a":2}');
    expect(a!.sha256).toBe(b!.sha256);
    expect(a!.sha256).not.toBe(c!.sha256);
    expect(a!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("whitespace and key order are SIGNIFICANT — no canonicalization", async () => {
    const plain = await digestModelContent('{"a":1,"b":2}');
    const spaced = await digestModelContent('{"a": 1, "b": 2}');
    const reordered = await digestModelContent('{"b":2,"a":1}');
    expect(plain!.sha256).not.toBe(spaced!.sha256);
    expect(plain!.sha256).not.toBe(reordered!.sha256);
  });

  it("byte count is UTF-8, not character count", async () => {
    const d = await digestModelContent("한국어");
    expect(d!.bytes).toBe(9);
    expect("한국어".length).toBe(3);
  });

  it("persists the digest as a UNIT and never the content itself", async () => {
    const { admin, payloads } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    const secretish = '{"title":"A teammate flags a safety gap","opening":"Never disclose a patient identifier"}';
    await r.finalize(h, { outcome: "success", durationMs: 12, modelContent: secretish });
    const last = payloads[payloads.length - 1];
    expect(last.response_digest_scope).toBe("model_content_utf8");
    expect(typeof last.response_byte_count).toBe("number");
    expect(last.response_sha256).toMatch(/^[0-9a-f]{64}$/);
    // The content itself is nowhere in what would be stored.
    expect(JSON.stringify(last)).not.toContain("teammate");
    expect(JSON.stringify(last)).not.toContain("patient identifier");
    expect(JSON.stringify(last)).not.toContain(secretish);
  });

  it("absent content leaves the whole identity unit NULL", async () => {
    const { admin, payloads } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    await r.finalize(h, { outcome: "empty_output", durationMs: 3 });
    const last = payloads[payloads.length - 1];
    expect(last.response_digest_scope).toBeNull();
    expect(last.response_byte_count).toBeNull();
    expect(last.response_sha256).toBeNull();
  });

  it("an empty string is treated as no content — not as a digest of nothing", async () => {
    const { admin, payloads } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    await r.finalize(h, { outcome: "empty_output", durationMs: 3, modelContent: "" });
    expect(payloads[payloads.length - 1].response_sha256).toBeNull();
  });
});

describe("[R5C-2A] nothing but shape reaches persistence", () => {
  it("prose, secrets and headers cannot enter any payload", async () => {
    const { admin, payloads } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    await r.finalize(h, {
      outcome: "http_error",
      durationMs: 8,
      providerHttpStatus: 429,
      providerErrorCategory: "rate_limited",
      // Everything hostile a caller could try to smuggle through the typed surface.
      modelContent: "Authorization: Bearer sk-live-SECRET; Set-Cookie: a=b; Never disclose a patient identifier",
      finishReason: "length",
    });
    const all = JSON.stringify(payloads);
    for (const leak of ["Bearer", "sk-live-SECRET", "Set-Cookie", "patient identifier", "Authorization"]) {
      expect(all).not.toContain(leak);
    }
    const last = payloads[payloads.length - 1];
    expect(last.provider_http_status).toBe(429);
    expect(last.provider_error_category).toBe("rate_limited");
    expect(last.finish_reason).toBe("length");
  });

  it("a long finish reason is bounded", async () => {
    const { admin, payloads } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    await r.finalize(h, { outcome: "success", durationMs: 1, finishReason: "x".repeat(500) });
    expect(String(payloads[payloads.length - 1].finish_reason).length).toBeLessThanOrEqual(40);
  });

  it("token usage and finish reason stay NULL when not supplied", async () => {
    const { admin, payloads } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    await r.finalize(h, { outcome: "success", durationMs: 1 });
    const last = payloads[payloads.length - 1];
    for (const k of ["prompt_tokens", "completion_tokens", "total_tokens", "finish_reason", "provider_http_status"]) {
      expect(last[k]).toBeNull();
    }
  });

  it("the recorder issues no network call of its own", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { admin } = makeAdmin();
    const r = recorderFor(admin);
    const h = (await r.prepare(PREPARE))!;
    await r.invoke(h);
    await r.finalize(h, { outcome: "success", durationMs: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("no raw database id is exposed on the handle surface product code reads", async () => {
    const { admin } = makeAdmin();
    const h = (await recorderFor(admin).prepare(PREPARE))!;
    // The id exists but is deliberately name-mangled and never rendered anywhere.
    expect(Object.keys(h).sort()).toEqual(["__callId", "kind", "startedAtMs"]);
  });
});
