/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  PROPOSAL_CACHE_TTL_MS,
  clearAllCachedProposals,
  clearCachedProposal,
  readCachedProposal,
  writeCachedProposal,
} from "./proposalContinuity";
import type { ProgramProposal } from "@/domain/foundry/module/program-authorship";

/**
 * SLICE 3.2L-R11.4K — the cache restores what to RENDER and is never authority.
 */
const FP = "our handoffs are inconsistent.¦everyone¦¦¦create a shared handoff standard.";
const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";
const PROPOSAL = {
  displayTitle: "Handing over without gaps",
  elements: [
    { kind: "why_it_matters", content: "When a handover misses a step, the next person starts blind.", rationale: "" },
    { kind: "observable_standard", content: "State each open item aloud.", rationale: "" },
  ],
  assumptions: [],
  warnings: [],
} as unknown as ProgramProposal;

const entry = { attemptId: "496302b6", contextFingerprint: FP, proposal: PROPOSAL, evidenceCeiling: "Nothing here shows change." };

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

describe("[3.2L-R11.4K] proposal continuity", () => {
  it("survives an unmount: what was written is what comes back", () => {
    writeCachedProposal(DRAFT, entry);
    const back = readCachedProposal(DRAFT, FP);
    expect(back).toMatchObject(entry);
    expect(typeof back?.savedAt).toBe("number");
  });

  it("is scoped to its draft — another draft never sees it", () => {
    writeCachedProposal(DRAFT, entry);
    expect(readCachedProposal("35773b57-219b-43fb-829e-80f0656ccb66", FP)).toBeNull();
  });

  it("a changed draft context makes it ineligible, rather than showing a stale program", () => {
    writeCachedProposal(DRAFT, entry);
    expect(readCachedProposal(DRAFT, `${FP} plus a new answer`)).toBeNull();
  });

  it("a newer generation supersedes the older one", () => {
    writeCachedProposal(DRAFT, entry);
    const newer = { ...entry, attemptId: "aaaaaaaa", proposal: { ...PROPOSAL, displayTitle: "A different program" } as ProgramProposal };
    writeCachedProposal(DRAFT, newer);
    expect(readCachedProposal(DRAFT, FP)?.proposal.displayTitle).toBe("A different program");
    expect(readCachedProposal(DRAFT, FP)?.attemptId).toBe("aaaaaaaa");
  });

  it("Apply and Discard both end it", () => {
    writeCachedProposal(DRAFT, entry);
    clearCachedProposal(DRAFT);
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
  });

  /*
    R11.4K-R2. Measured in a real browser against the deployed origin: a NEW TAB in the SAME
    browsing session reads sessionStorage as null while localStorage is shared. That is the
    live failure — the Founder opened the review link from a chat, which is a new tab.
  */
  it("is SHARED across tabs, not per-tab — the R11.4K-R2 failure", () => {
    writeCachedProposal(DRAFT, entry);
    expect(window.localStorage.length, "a second tab reads this one").toBe(1);
    expect(window.sessionStorage.length, "and never this one").toBe(0);
  });

  it("expires: work older than the TTL is not offered, and is not left behind", () => {
    writeCachedProposal(DRAFT, entry);
    const raw = JSON.parse(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)!);
    raw.savedAt = Date.now() - (PROPOSAL_CACHE_TTL_MS + 1000);
    window.localStorage.setItem(`bty_program_proposal_v2:${DRAFT}`, JSON.stringify(raw));
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
    expect(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)).toBeNull();
  });

  it("an entry with no savedAt is treated as expired, never as fresh", () => {
    window.localStorage.setItem(`bty_program_proposal_v2:${DRAFT}`, JSON.stringify(entry));
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
  });

  it("logout purges every draft's pending proposal, and nothing else", () => {
    writeCachedProposal(DRAFT, entry);
    writeCachedProposal("35773b57-219b-43fb-829e-80f0656ccb66", entry);
    window.localStorage.setItem("bty_last_visit", "keep-me");
    clearAllCachedProposals();
    expect(readCachedProposal(DRAFT, FP)).toBeNull();
    expect(window.localStorage.getItem("bty_last_visit")).toBe("keep-me");
  });

  it("a corrupted or truncated entry is ignored, never half-rendered", () => {
    for (const junk of ["", "{", "null", '{"contextFingerprint":"x"}', JSON.stringify({ ...entry, proposal: { displayTitle: "t" } })]) {
      window.localStorage.setItem(`bty_program_proposal_v2:${DRAFT}`, junk);
      expect(readCachedProposal(DRAFT, FP), junk).toBeNull();
    }
  });

  it("a tampered proposal is still returned to the caller — the SERVER is what refuses it", () => {
    // Deliberate: the cache does not police content. Apply recomputes journeyDigest from
    // what is being adopted and compares it with attempt.proposal_digest, so one changed
    // character fails there with proposal_mismatch. Policing here would imply authority.
    writeCachedProposal(DRAFT, entry);
    const tampered = JSON.parse(window.localStorage.getItem(`bty_program_proposal_v2:${DRAFT}`)!);
    tampered.proposal.elements[0].content = "When a handover misses a step, the next person starts BLIND.";
    window.localStorage.setItem(`bty_program_proposal_v2:${DRAFT}`, JSON.stringify(tampered));
    const back = readCachedProposal(DRAFT, FP);
    expect(back?.proposal.elements[0].content).toContain("BLIND");
    expect(back?.attemptId).toBe("496302b6");
  });
});
