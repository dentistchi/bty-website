import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

const version = "discovery-2026-10-31.1-review-a";
const patientFor = (id: string) => discoveryPatients.find(p => p.caseId === id && p.version === version)!;
beforeEach(() => {
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_KEY", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Scope regression must not call a network service"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("independently reproduced review-pack scope defects", () => {
  it.each(["patient", "exam"] as const)("retains both known #30 procedures in %s mode", async channel => {
    const reply = await respondToDiscovery("What did we do to #30?", channel, patientFor("drchi-005"));
    expect(reply.factIds).toEqual(["drchi-005:rct-history", "drchi-005:crown-history"]);
    expect(reply.availableFactIds).toEqual(reply.factIds);
    expect(reply.text).toMatch(/root canal treatment eight months ago/iu);
    expect(reply.text).toMatch(/crown[\s\S]*three weeks ago/iu);
    expect(reply.responseKind).toBe("history");
  });

  it("does not substitute #30 crown margins for #29 in a compound examination", async () => {
    const reply = await respondToDiscovery("Check #29 crown margins and percuss #30.", "exam", patientFor("drchi-005"));
    expect(reply.factIds).toEqual(["drchi-005:percussion"]);
    expect(reply.availableFactIds).toEqual(["drchi-005:percussion"]);
    expect(reply.text).toMatch(/mildly tender to percussion/iu);
    expect(reply.text).toMatch(/#\s*29|tooth\s*29/iu);
    expect(reply.text).toMatch(/margins?/iu);
    expect(reply.text).toMatch(/not (?:supplied|available|established|recorded)|unavailable/iu);
    expect(reply.unavailableTopicIds?.length).toBeGreaterThan(0);
  });

  it("does not answer an objective excursion examination with a patient jaw-shift denial", async () => {
    const reply = await respondToDiscovery("Check the occlusal contacts as the jaw moves sideways.", "exam", patientFor("drchi-005"));
    // The first independent probe expected the existing occlusion source as a
    // direction-of-subject check. Clinical review clarified that it records only
    // light closure, not actual lateral findings. Do not invent normal excursions
    // or count closure alone as answering the requested dynamic examination.
    expect(reply).toMatchObject({ factIds: [], availableFactIds: [], resolution: "unavailable", responseKind: "case-information" });
    expect(reply.text).toMatch(/lateral|excursi\w*|sideways/iu);
    expect(reply.text).toMatch(/not (?:supplied|available|established|recorded)|unavailable/iu);
    expect(reply.text).not.toMatch(/I do not deliberately move my jaw/iu);
    expect(reply.unavailableTopicIds?.length).toBeGreaterThan(0);
  });

  it("does not substitute #30 fixture stability for #29 when #30 screw inspection is also requested", async () => {
    const reply = await respondToDiscovery("Check #29 fixture stability and inspect #30 screw condition.", "exam", patientFor("drchi-011"));
    expect(reply.factIds).toEqual(["drchi-011:screw-examination"]);
    expect(reply.availableFactIds).toEqual(["drchi-011:screw-examination"]);
    expect(reply.text).toMatch(/retrieved screw is intact/iu);
    expect(reply.text).toMatch(/#\s*29|tooth\s*29/iu);
    expect(reply.text).toMatch(/fixture/iu);
    expect(reply.text).toMatch(/not (?:supplied|available|established|recorded)|unavailable/iu);
    expect(reply.unavailableTopicIds?.length).toBeGreaterThan(0);
  });

  it("keeps an implicit focal request separate from another clause's explicit tooth", async () => {
    const reply = await respondToDiscovery("Check the crown margins and percuss #29.", "exam", patientFor("drchi-005"));
    expect(reply.factIds).toEqual(["drchi-005:crown-integrity", "drchi-005:adjacent-percussion-29"]);
    expect(reply.text).toMatch(/Accessible margins are intact/iu);
    // #29 was already known in a paired control record. It is not unavailable;
    // the issued fact must now name #29 alone instead of acquiring #31 as well.
    expect(reply.text).toMatch(/#29 is not tender/iu);
    expect(reply.text).not.toContain("#31");
    expect(reply.text).not.toMatch(/mildly tender to percussion/iu);
  });

  it.each(["drchi-005", "drchi-006"])("does not substitute patient cold symptoms for an unsupplied cold test in %s", async caseId => {
    const reply = await respondToDiscovery("Perform a cold test on #30.", "exam", patientFor(caseId));
    expect(reply).toMatchObject({ factIds: [], availableFactIds: [], resolution: "unavailable", responseKind: "case-information" });
    expect(reply.text).toMatch(/Cold sensibility testing.*not supplied/iu);
    expect(reply.unavailableTopicIds?.length).toBeGreaterThan(0);
  });

  it.each(["patient", "exam"] as const)("still answers an actual patient jaw-history question through %s", async channel => {
    const reply = await respondToDiscovery("Do you move your jaw backward or sideways to make your teeth fit?", channel, patientFor("drchi-005"));
    expect(reply.factIds).toEqual(["drchi-005:jaw-shift"]);
    expect(reply.responseKind).toBe("history");
    expect(reply.text).toBe("I do not deliberately move my jaw backward or sideways to make my teeth fit.");
  });

  it.each([29, 31])("discloses only the requested control tooth %s for cold testing", async tooth => {
    const reply = await respondToDiscovery(`Cold-test tooth #${tooth}.`, "exam", patientFor("drchi-005"));
    expect(reply.factIds).toEqual([`drchi-005:adjacent-cold-${tooth}`]);
    expect(reply.text).toContain(`#${tooth}`);
    expect(reply.text).not.toContain(`#${tooth === 29 ? 31 : 29}`);
  });
});
