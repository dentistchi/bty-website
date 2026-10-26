import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare, Response as MiniflareResponse } from "miniflare";
import { resolve } from "node:path";

// Use the actual router and the installed workerd runtime, not a fetch double in Node.
// All outbound traffic is intercepted locally. No patient packs, gateway or real key are used.
const MODEL_URL = "https://model.test/v1/chat/completions";
const TEST_KEY = "synthetic-worker-transport-key";
const FIXTURE_ID = "transport-fixture:cold";
type Call = { url: string; method: string; authorization: string | null };

describe("Clinical Discovery transport in the Cloudflare Worker runtime", () => {
  let worker: Miniflare;
  let responseStatus = 200;
  let calls: Call[] = [];

  beforeAll(async () => {
    const root = process.cwd();
    const bundled = await build({
      stdin: {
        contents: `
          import { respondToDiscovery } from ${JSON.stringify(resolve(root, "src/lib/bty/clinical-pilot/discovery-router.server.ts"))};
          const patient = {
            caseId: "transport-fixture", version: "fixture/v1", chiefComplaint: "Synthetic concern.",
            facts: [{ id: ${JSON.stringify(FIXTURE_ID)}, channel: "patient", topic: "Cold drink sensitivity",
              patterns: ["^never-match-this-fixture$"], answer: "Synthetic patient response." }],
          };
          export default { async fetch() {
            const result = await respondToDiscovery("Do frosty drinks bother you?", "patient", patient, [], { allowModel: true });
            return Response.json(result);
          } };
        `,
        resolveDir: root,
        sourcefile: "clinical-worker-transport-fixture.ts",
        loader: "ts",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
      alias: { "@": resolve(root, "src") },
      define: {
        "process.env.CLINICAL_DISCOVERY_LLM_BASE_URL": JSON.stringify("https://model.test/v1"),
        "process.env.CLINICAL_DISCOVERY_LLM_MODEL": JSON.stringify("transport-fixture-model"),
        "process.env.CLINICAL_DISCOVERY_LLM_KEY": JSON.stringify(TEST_KEY),
      },
    });
    worker = new Miniflare({
      modules: true,
      script: bundled.outputFiles[0].text,
      compatibilityDate: "2026-04-26",
      compatibilityFlags: ["nodejs_compat"],
      outboundService: async request => {
        calls.push({ url: request.url, method: request.method, authorization: request.headers.get("authorization") });
        if (request.url === MODEL_URL && responseStatus !== 200) {
          return new MiniflareResponse("Redirect must be refused", { status: responseStatus,
            headers: { Location: "https://off-host.invalid/stolen-key" } });
        }
        return MiniflareResponse.json({ choices: [{ message: { content: JSON.stringify({
          selectedFactIds: [FIXTURE_ID], evidence: ["frosty drinks"], confidence: 0.99,
        }) } }] });
      },
    });
    await worker.ready;
  }, 30_000);

  beforeEach(() => { responseStatus = 200; calls = []; });
  afterAll(async () => { await worker?.dispose(); }, 10_000);

  it("reaches the authored model fixture through native Worker fetch", async () => {
    const response = await worker.dispatchFetch("https://practice.test/check");
    const reply = await response.json() as { routing: { method: string; fallback?: string }; factIds: string[] };
    expect(reply.routing.method).toBe("local-model");
    expect(reply.routing.fallback).toBeUndefined();
    expect(reply.factIds).toEqual([FIXTURE_ID]);
    expect(calls).toEqual([{ url: MODEL_URL, method: "POST", authorization: `Bearer ${TEST_KEY}` }]);
  }, 15_000);

  it.each([301, 302, 303, 307, 308])("refuses HTTP %i without following the redirect or forwarding the Bearer key off-host", async status => {
    responseStatus = status;
    const response = await worker.dispatchFetch("https://practice.test/check");
    const reply = await response.json() as { routing: { method: string; fallback?: string }; factIds: string[] };
    expect(reply.routing).toMatchObject({ method: "authored-rules", fallback: "local_model_http_error" });
    expect(reply.factIds).toEqual([]);
    expect(calls).toEqual([{ url: MODEL_URL, method: "POST", authorization: `Bearer ${TEST_KEY}` }]);
  }, 15_000);
});
