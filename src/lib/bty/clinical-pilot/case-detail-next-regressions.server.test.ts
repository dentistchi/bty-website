import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryChannel } from "@/domain/clinical-pilot/discovery";
import oracleJson from "../../../../scripts/fixtures/clinical-discovery-case-details-next-independent.v1.json";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

type Probe = { name: string; caseId: string; question: string; channel: DiscoveryChannel;
  mode: string; expectedFactIds: string[]; expectedAvailableFactIds: string[];
  expectedResolution: string; modelSelectedFactIds?: string[]; modelEvidence?: string[] };
const oracle = oracleJson as { packVersion: string; probes: Probe[] };

// Independently frozen questions and expectations. Controlled completions test
// the server boundary; they are not qwen measurements or a hidden benchmark.
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External requests are forbidden in these regressions"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("independent next-case conversational regressions", () => {
  it.each(oracle.probes)("preserves the requested subject and scope: $name", async probe => {
    const controlled = probe.mode === "controlled-model";
    if (controlled) {
      vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "https://synthetic.invalid/v1");
      vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "independent-next-case-stub");
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {
        content: JSON.stringify({ selectedFactIds: probe.modelSelectedFactIds, evidence: probe.modelEvidence, confidence: 0.99 }),
      } }] })));
    }
    const patient = discoveryPatients.find(p => p.caseId === probe.caseId && p.version === oracle.packVersion)!;
    const reply = await respondToDiscovery(probe.question, probe.channel, patient, [], { allowModel: controlled });
    expect([...reply.factIds].sort()).toEqual([...probe.expectedFactIds].sort());
    expect([...reply.availableFactIds].sort()).toEqual([...probe.expectedAvailableFactIds].sort());
    expect(reply.resolution).toBe(probe.expectedResolution);
    expect(fetch).toHaveBeenCalledTimes(controlled ? 1 : 0);
    if (probe.name === "restorative-margin-is-not-caries-boundary") {
      expect(reply.text).not.toMatch(/2\.5\s*mm/iu);
      expect(reply.unavailableTopicIds?.length).toBeGreaterThan(0);
    }
  });

  it("retains prior history followed by a then examination", async () => {
    const patient = discoveryPatients.find(p => p.caseId === "drchi-003" && p.version === oracle.packVersion)!;
    const reply = await respondToDiscovery("What did we do to #30, then percuss #30.", "exam", patient);
    expect([...reply.factIds].sort()).toEqual(["drchi-003:percussion", "drchi-003:treatment-history"]);
    expect(reply.unavailableTopicIds).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps a declined examination separate from the following then request", async () => {
    const patient = discoveryPatients.find(p => p.caseId === "drchi-002" && p.version === oracle.packVersion)!;
    const reply = await respondToDiscovery("Do not cold-test #30, then percuss #30.", "exam", patient);
    expect(reply.factIds).toEqual(["drchi-002:percussion"]);
    expect(reply.availableFactIds).toEqual(reply.factIds);
    expect(fetch).not.toHaveBeenCalled();
  });
});
