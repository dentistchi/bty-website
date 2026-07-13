import { describe, it, expect } from "vitest";
import { buildLivingResponseMessages } from "@/lib/bty/daily/livingResponsePrompt";
import { deriveCommitmentFrame, selectProposition } from "@/domain/daily/livingResponseFrame";
import type { LivingResponsePacket, LivingResponseYesterday } from "@/domain/daily/livingResponse";
import { evidenceFingerprint } from "@/domain/daily/livingResponse";

const frame = deriveCommitmentFrame("self")!;
const proposition = selectProposition(frame, "commitment", [], "2026-07-13:self");

function packet(yesterday?: LivingResponseYesterday): LivingResponsePacket {
  return {
    commitmentId: "c1",
    userId: "u1",
    dayKey: "2026-07-13",
    relationship: "self",
    commitmentFrame: frame,
    facts: [],
    concepts: [],
    ...(yesterday ? { yesterday } : {}),
    prohibitedFieldsPresent: false,
    evidenceFingerprint: evidenceFingerprint([], frame),
  };
}

const userText = (p: LivingResponsePacket) =>
  buildLivingResponseMessages(p, { locale: "en", recentTexts: [], proposition }).find((m) => m.role === "user")!.content;
const systemText = () =>
  buildLivingResponseMessages(packet(), { locale: "en", recentTexts: [], proposition }).find((m) => m.role === "system")!.content;

describe("Living Memory V0 — hidden yesterday prompt", () => {
  it("the system prompt bans the memory-exposure words", () => {
    const s = systemText();
    expect(s).toMatch(/BANNED memory words/i);
    expect(s).toMatch(/yesterday/i);
    expect(s).toMatch(/FEEL the thread, never READ it/i);
  });

  it("no yesterday → no hidden-continuity block in the user prompt", () => {
    expect(userText(packet())).not.toMatch(/Hidden continuity/i);
    expect(userText(packet({ existed: false, relationship: null, livingResponse: null, completed: null }))).not.toMatch(/Hidden continuity/i);
  });

  it("with yesterday → hidden-continuity block carries relationship, completion, and the prior line (do-not-echo)", () => {
    const u = userText(packet({ existed: true, relationship: "others", livingResponse: "Care reaches when it is received.", completed: false }));
    expect(u).toMatch(/Hidden continuity \(background ONLY/i);
    expect(u).toMatch(/prior focus was others/i);
    expect(u).toMatch(/left unfinished/i);
    expect(u).toMatch(/do NOT echo, quote, or paraphrase it/i);
    expect(u).toMatch(/FEEL the thread, never READ it/i);
  });

  it("yesterday with no prior line → block present but no quoted line", () => {
    const u = userText(packet({ existed: true, relationship: "self", livingResponse: null, completed: true }));
    expect(u).toMatch(/Hidden continuity/i);
    expect(u).toMatch(/carried through/i);
    expect(u).not.toMatch(/prior line read/i);
  });
});
