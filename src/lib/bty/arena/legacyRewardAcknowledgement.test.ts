import { describe, expect, it } from "vitest";
import {
  legacyRewardFailureMessage,
  requireBeginnerCompletionAcknowledgement,
  requireLegacyChoiceAcknowledgement,
} from "./legacyRewardAcknowledgement";

const receipt = { receiptId: "27e9d375-a6d1-45e1-9b97-f7d3e75a576f", idempotent: false };
const choice = { ok: true, reExposureDueCandidate: false, xp: 37, ...receipt };
const beginner = { ok: true, beginner_maturity_score: 11, band: "aware", label: "Aware", message: "Saved result", ...receipt };

describe("public legacy reward receipt validation", () => {
  it.each([0, 37, 10_000])("accepts stored choice XP %i without deriving another amount", (xp) => {
    const value = { ...choice, xp, idempotent: true };
    expect(requireLegacyChoiceAcknowledgement(value)).toBe(value);
  });

  it.each([0, 11, 20])("accepts stored beginner score %i", (score) => {
    const value = { ...beginner, beginner_maturity_score: score };
    expect(requireBeginnerCompletionAcknowledgement(value)).toBe(value);
  });

  it.each([null, undefined, [], "<html>Sign in</html>", true, 200, {}, { ok: true }])("rejects non-receipt response %j", (value) => {
    expect(() => requireLegacyChoiceAcknowledgement(value)).toThrow("REWARD_ACKNOWLEDGEMENT_INVALID");
    expect(() => requireBeginnerCompletionAcknowledgement(value)).toThrow("REWARD_ACKNOWLEDGEMENT_INVALID");
  });

  it.each([
    { ok: false }, { ok: "true" }, { reExposureDueCandidate: undefined }, { reExposureDueCandidate: true },
    { xp: -1 }, { xp: 10_001 }, { xp: 1.5 }, { xp: "37" }, { xp: NaN }, { xp: Infinity },
    { receiptId: undefined }, { receiptId: "not-a-uuid" }, { receiptId: ` ${receipt.receiptId}` },
    { idempotent: undefined }, { idempotent: "false" },
  ])("rejects malformed choice field %j", (field) => {
    expect(() => requireLegacyChoiceAcknowledgement({ ...choice, ...field })).toThrow();
  });

  it.each([
    { ok: false }, { ok: "true" }, { beginner_maturity_score: -1 }, { beginner_maturity_score: 21 },
    { beginner_maturity_score: 1.5 }, { beginner_maturity_score: "11" }, { beginner_maturity_score: NaN },
    { band: "expert" }, { band: { toString: (): string => "aware" } }, { label: " " }, { label: undefined },
    { message: "\n" }, { message: undefined }, { receiptId: "bad" }, { idempotent: 1 },
  ])("rejects malformed beginner field %j", (field) => {
    expect(() => requireBeginnerCompletionAcknowledgement({ ...beginner, ...field })).toThrow();
  });

  it.each(["reactive", "aware", "intentional"])("accepts public band %s", (band) => {
    expect(requireBeginnerCompletionAcknowledgement({ ...beginner, band }).band).toBe(band);
  });

  it.each(["en", "ko"])("keeps backend details out of %s failure messages", (locale) => {
    for (const code of ["LEGACY_REWARD_REVIEW_REQUIRED", "REWARD_INPUT_CONFLICT", "XP_AWARD_FAILED", "<html>private response</html>"]) {
      const message = legacyRewardFailureMessage(new Error(code), locale);
      expect(message).not.toContain(code);
      expect(message).not.toContain("private response");
      expect(message).toMatch(locale === "ko" ? /[가-힣]/ : /answers are still here/);
    }
  });
});
