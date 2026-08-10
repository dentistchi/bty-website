/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { writeCachedProposal, readCachedProposal, clearCachedProposal, PROPOSAL_CACHE_TTL_MS } from "./proposalContinuity";
import { PROGRAM_AUTHORSHIP_VERSION, type ProgramProposal } from "@/domain/foundry/module/program-authorship";

/**
 * SLICE 3.2P-W4-R1 — a cached proposal is bound to the RULES it was accepted under.
 *
 * The W3 proposal survived in localStorage for 24 hours across four changes to what the
 * validator accepts, and came back on Review re-entry looking current. The fingerprint gate
 * could not see it: the host had changed nothing, so the inputs matched exactly.
 */
const DRAFT = "3e079b1b-0077-48e6-80f7-fb7869b7eef1";
const OTHER = "093b0361-7cc8-4688-9f93-396d60582501";
const FP = "during morning huddles…¦leaders¦¦accountability¦…¦pdf";
const proposal = { displayTitle: "End every huddle with an owner and a deadline", elements: [{ kind: "observable_standard", content: "you must name one owner…" }] } as unknown as ProgramProposal;
const entry = { attemptId: "513e1642-92be-4be6-bb52-50febfe81b3c", contextFingerprint: FP, proposal, evidenceCeiling: "…" };
const KEY = `bty_program_proposal_v2:${DRAFT}`;

beforeEach(() => localStorage.clear());

describe("[3.2P-W4-R1] client continuity binding", () => {
  it("A — same context, same authority: the proposal restores", () => {
    writeCachedProposal(DRAFT, entry);
    const back = readCachedProposal(DRAFT, FP);
    expect(back?.proposal.displayTitle).toBe(proposal.displayTitle);
    expect(back?.authorityVersion).toBe(PROGRAM_AUTHORSHIP_VERSION);
  });

  it("B — same context, OLD authority: it does not restore, and the stale entry is removed", () => {
    // Exactly the shape the real W3 entry has: written under v9, inputs unchanged.
    localStorage.setItem(KEY, JSON.stringify({ ...entry, authorityVersion: "program_authorship_v9", savedAt: Date.now() }));
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
    expect(localStorage.getItem(KEY), "cleared, so it cannot reappear tomorrow").toBeNull();
  });

  it("an entry written before this field existed is treated as not-current", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...entry, savedAt: Date.now() }));
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
  });

  it("C — a cosmetic release keeps the work: only the authority string decides", () => {
    writeCachedProposal(DRAFT, entry);
    // Nothing about a deploy is consulted here — re-reading after any release still restores.
    expect(readCachedProposal(DRAFT, FP)).not.toBeNull();
  });

  it("D — a changed context fingerprint still does not restore", () => {
    writeCachedProposal(DRAFT, entry);
    expect(readCachedProposal(DRAFT, "the host rewrote the problem¦…")).toBeNull();
  });

  it("clearing a stale entry never touches another draft's work", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...entry, authorityVersion: "program_authorship_v9", savedAt: Date.now() }));
    writeCachedProposal(OTHER, entry);
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
    expect(readCachedProposal(OTHER, FP), "unrelated draft untouched").not.toBeNull();
  });

  it("the TTL still applies independently", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...entry, authorityVersion: PROGRAM_AUTHORSHIP_VERSION, savedAt: Date.now() - PROPOSAL_CACHE_TTL_MS - 1 }));
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
  });

  it("M — R7: nothing here leaves the browser", () => {
    writeCachedProposal(DRAFT, entry);
    // The only persistence is this key, in this browser. No network, no server field.
    expect(Object.keys(localStorage).filter((k) => k.startsWith("bty_program_proposal_v2:"))).toEqual([KEY]);
    clearCachedProposal(DRAFT);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
