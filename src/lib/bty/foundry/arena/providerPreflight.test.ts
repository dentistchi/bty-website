import { describe, it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PREFLIGHT_STRICT_SCHEMA,
  formatPreflightResult,
  runProviderPreflight,
  type PreflightClient,
} from "./providerPreflight";

/**
 * PROVIDER PREFLIGHT (Slice 3.2I-R5B1A.1-R2.23D-R2).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R1 runner passed all 22 contract checks, read the operator's credential, and then died
 * with `Top-level await is currently not supported with the "cjs" output format` — before any
 * request left the machine. The provider preflight was inline TypeScript that nobody had ever run.
 *
 * So these tests do two things: exercise both capability checks against an injected client, and
 * execute the REAL entry point the runner invokes, so a transform error can never again be
 * discovered by an operator who has already typed a key.
 */

const CONFIG = { model: "test-model", timeoutMs: 1_000 };
const okResponse = { choices: [{ message: { content: '{"ok":true}', refusal: null }, finish_reason: "stop" }] };

const clientOf = (impl: (params: Record<string, unknown>) => Promise<unknown>): PreflightClient => ({
  chat: { completions: { create: impl } },
});

describe("1/2. both capability checks", () => {
  it("1/2. a client that answers both requests PASSES, and both checks are recorded", async () => {
    const create = vi.fn(async () => okResponse);
    const r = await runProviderPreflight(clientOf(create), CONFIG);
    expect(r).toEqual({ ok: true, checks: { capability: true, strictSchema: true }, model: "test-model" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("the checks are SEPARATE — credential validity alone never reports success", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await runProviderPreflight(clientOf(async (p) => (calls.push(p), okResponse)), CONFIG);
    // A: minimal, no schema. B: strict json_schema with additionalProperties:false.
    expect(calls[0].response_format).toBeUndefined();
    expect(calls[0].max_tokens).toBe(1);
    const rf = calls[1].response_format as { type: string; json_schema: { strict: boolean; schema: typeof PREFLIGHT_STRICT_SCHEMA } };
    expect(rf.type).toBe("json_schema");
    expect(rf.json_schema.strict).toBe(true);
    expect(rf.json_schema.schema.additionalProperties).toBe(false);
    expect(rf.json_schema.schema.required).toEqual(Object.keys(rf.json_schema.schema.properties));
  });

  it("neither check writes Practice content — no scenario is ever requested", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await runProviderPreflight(clientOf(async (p) => (calls.push(p), okResponse)), CONFIG);
    for (const c of calls) {
      expect(JSON.stringify(c)).not.toMatch(/primaryChoices|boundaryGrounding|scenario|opening/i);
      expect(c.max_tokens as number).toBeLessThanOrEqual(16);
    }
  });
});

describe("3-8. every failure mode is classified, never swallowed", () => {
  it("3. the FIRST request rejecting is a capability failure, and B is never attempted", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    });
    const r = await runProviderPreflight(clientOf(create), CONFIG);
    expect(r).toEqual({ ok: false, code: "credential_or_model_unavailable", failedCheck: "capability", status: 401 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("4. the STRICT-SCHEMA request rejecting is its own failure — a valid credential is not enough", async () => {
    let n = 0;
    const r = await runProviderPreflight(
      clientOf(async () => {
        if (++n === 1) return okResponse;
        throw Object.assign(new Error("response_format not supported"), { status: 400 });
      }),
      CONFIG,
    );
    expect(r).toEqual({ ok: false, code: "structured_output_unavailable", failedCheck: "strict_schema", status: 400 });
  });

  it("5. a provider refusal is a refusal, not a pass", async () => {
    const refusal = { choices: [{ message: { content: null, refusal: "I cannot help with that" } }] };
    expect(await runProviderPreflight(clientOf(async () => refusal), CONFIG)).toMatchObject({
      ok: false,
      code: "provider_refusal",
      failedCheck: "capability",
    });
  });

  it("6. a malformed response is malformed — not silently treated as success", async () => {
    for (const bad of [null, {}, { choices: "not-an-array" }, 42]) {
      expect(await runProviderPreflight(clientOf(async () => bad), CONFIG), String(bad)).toMatchObject({
        ok: false,
        code: "malformed_provider_response",
      });
    }
  });

  it("7. a SECRET-BEARING error yields a code and a status — never its message or headers", async () => {
    const leaky = Object.assign(new Error("401 from https://api.example/v1 key=sk-live-SECRET-VALUE"), {
      status: 401,
      request: { headers: { Authorization: "Bearer sk-live-SECRET-VALUE" } },
      response: { body: "sk-live-SECRET-VALUE" },
    });
    const r = await runProviderPreflight(
      clientOf(async () => {
        throw leaky;
      }),
      CONFIG,
    );
    const printed = formatPreflightResult(r);
    expect(printed).toBe("PROVIDER PREFLIGHT FAIL · check=capability · code=credential_or_model_unavailable · status=401");
    expect(printed).not.toContain("sk-live-SECRET-VALUE");
    expect(printed).not.toMatch(/Authorization|Bearer|api\.example/);
    expect(JSON.stringify(r)).not.toContain("sk-live-SECRET-VALUE");
  });

  it("8. a hanging provider times out rather than blocking the runner forever", async () => {
    const r = await runProviderPreflight(
      clientOf(() => new Promise(() => {})),
      { model: "test-model", timeoutMs: 20 },
    );
    expect(r).toMatchObject({ ok: false, code: "provider_timeout", failedCheck: "capability" });
  });

  it("a success line names both checks and the model, and carries nothing else", () => {
    expect(formatPreflightResult({ ok: true, checks: { capability: true, strictSchema: true }, model: "gpt-4o-mini" })).toBe(
      "PROVIDER PREFLIGHT PASS · capability=ok · strict_schema=ok · model=gpt-4o-mini",
    );
  });
});

// ---------------------------------------------------------------------------
// 9/10 + PART 5 — the REAL entry point, executed
// ---------------------------------------------------------------------------

const ENTRY = "scripts/practice-provider-preflight.ts";
const entrySource = () => readFileSync(join(process.cwd(), ENTRY), "utf8");

/** Run the actual CLI. `reject: false` so a nonzero exit is an assertion, not a throw. */
function runEntry(env: Record<string, string>): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("npx", ["tsx", ENTRY], {
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

describe("PART 5 — CommonJS / Node 24 regression", () => {
  it("1. the tracked entry point contains NO top-level await", () => {
    const src = entrySource();
    expect(src).toMatch(/async function main\(\): Promise<void>/);
    expect(src).toMatch(/void main\(\)\.catch\(/);
    // Every `await` in executable code must sit after `async function main` — a bare top-level one
    // is the measured R2.23D-R1 fault. Comments are stripped so prose about the defect is exempt.
    const code = src.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const mainAt = code.indexOf("async function main");
    expect(mainAt).toBeGreaterThan(-1);
    for (const m of code.matchAll(/\bawait\b/g)) {
      expect(m.index, `top-level await at offset ${m.index}`).toBeGreaterThan(mainAt);
    }
    // …and the guard is not vacuous: the file really does contain awaits.
    expect([...code.matchAll(/\bawait\b/g)].length).toBeGreaterThan(0);
  });

  it("2/3/4. it COMPILES AND RUNS under the repository's actual tsx invocation and Node", () => {
    // This is the test that would have caught the R2.23D-R1 failure before an operator did.
    const r = runEntry({ BTY_PREFLIGHT_MOCK: "1" });
    expect(r.stderr).not.toMatch(/Top-level await|cjs output format|Transform failed/);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("PROVIDER PREFLIGHT MOCK PASS · LIVE PROVIDER NOT CALLED");
  });

  it("5/6. it needs no generated eval file and contains no inline provider code", () => {
    expect(entrySource()).not.toMatch(/tsx -e|eval\.ts|new Function|eval\(/);
  });

  it("7/9. a failure reaches the sanitized handler and exits NONZERO", () => {
    const r = runEntry({ BTY_PREFLIGHT_MOCK: "0", LLM_API_KEY: "", OPENAI_API_KEY: "", LLM_BASE_URL: "" });
    expect(r.code).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/PROVIDER PREFLIGHT FAIL · check=\w+ · code=\w+ · status=/);
  });

  it("10. no secret in the environment reaches stdout or stderr", () => {
    const SENTINEL = "sk-sentinel-MUST-NOT-APPEAR-9f3a";
    const envs: Record<string, string>[] = [
      { BTY_PREFLIGHT_MOCK: "1", LLM_API_KEY: SENTINEL, OPENAI_API_KEY: SENTINEL },
      { BTY_PREFLIGHT_MOCK: "0", LLM_API_KEY: SENTINEL, OPENAI_API_KEY: SENTINEL, LLM_BASE_URL: "" },
    ];
    for (const env of envs) {
      const r = runEntry(env);
      expect(r.stdout, JSON.stringify(env)).not.toContain(SENTINEL);
      expect(r.stderr, JSON.stringify(env)).not.toContain(SENTINEL);
    }
  });

  it("the mock is TEST-ONLY — it is env-guarded and prints a distinct marker", () => {
    const src = entrySource();
    expect(src).toContain('const MOCK_ENV = "BTY_PREFLIGHT_MOCK"');
    expect(src).toContain("PROVIDER PREFLIGHT MOCK PASS · LIVE PROVIDER NOT CALLED");
    // It cannot report the LIVE success marker, so a mock run can never be mistaken for a real one.
    expect(src).not.toMatch(/useMock[\s\S]{0,200}PROVIDER PREFLIGHT PASS ·/);
    // And it is not exposed as a command-line flag on the runner.
    expect(src).not.toMatch(/--mock|--skip-provider|--offline/);
  });
});
