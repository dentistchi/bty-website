import { describe, it, expect } from "vitest";
import {
  isValidSourceCommitSha,
  resolveSourceIdentity,
  SOURCE_COMMIT_SHA_PATTERN,
} from "./sourceCommitIdentity";

/**
 * WHAT COUNTS AS DEPLOYMENT IDENTITY (Slice 3.2I-R5B2-R5C-3V2).
 *
 * The previous resolver could not fail: four environment variables and a hardcoded `"0.1.0"` meant
 * it always produced something, and what it produced was a release label that had been wrong since
 * April. These tests hold the replacement to the opposite property — everything that is not an
 * exact commit is refused.
 */

const REAL = "cf7e3720f739c952c86324a668b6ffd98f5ea6b1";

describe("[R5C-3V2] an exact commit is identity", () => {
  it("accepts a 40-character lowercase sha", () => {
    const r = resolveSourceIdentity(REAL);
    expect(r).toEqual({ ok: true, identity: { sourceCommitSha: REAL, identityKind: "git_commit" } });
    expect(isValidSourceCommitSha(REAL)).toBe(true);
  });

  it("the pattern is anchored at both ends", () => {
    // Without anchors, a label CONTAINING a sha would pass and name the wrong build.
    expect(SOURCE_COMMIT_SHA_PATTERN.test(`v1-${REAL}`)).toBe(false);
    expect(SOURCE_COMMIT_SHA_PATTERN.test(`${REAL}-dirty`)).toBe(false);
  });
});

describe("[R5C-3V2] everything else is refused", () => {
  it.each([
    ["the stale April release label", "2026-04-27-api-version-endpoint-v1"],
    ["a short sha", "cf7e3720"],
    ["a 12-character sha", "cf7e3720f739"],
    ["a branch name", "inner-main"],
    ["another branch name", "main"],
    ["a date", "2026-08-03"],
    ["a package version", "0.1.0"],
    ["a random uuid", "d0d8b6aa-f979-4adb-83ae-02987b604132"],
    ["the word unknown", "unknown"],
    ["the word development", "development"],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["41 hex characters", `${REAL}a`],
    ["39 hex characters", REAL.slice(0, 39)],
    ["non-hex characters of the right length", "z".repeat(40)],
  ])("rejects %s", (_label, value) => {
    expect(resolveSourceIdentity(value).ok).toBe(false);
    expect(isValidSourceCommitSha(value)).toBe(false);
  });

  it.each([
    ["undefined", undefined, "absent"],
    ["null", null, "absent"],
    ["a number", 12345, "not_a_string"],
    ["an object", { sha: REAL }, "not_a_string"],
  ])("rejects %s with a named reason", (_l, value, reason) => {
    expect(resolveSourceIdentity(value)).toEqual({ ok: false, reason });
  });

  it("names WHY, so an operator can tell a label from an absence", () => {
    expect(resolveSourceIdentity("2026-04-27-api-version-endpoint-v1").ok).toBe(false);
    expect(resolveSourceIdentity("").ok).toBe(false);
    // A release label and a missing value demand different responses.
    const label = resolveSourceIdentity("2026-04-27-api-version-endpoint-v1");
    const blank = resolveSourceIdentity("");
    expect(label.ok === false && label.reason).not.toBe(blank.ok === false && blank.reason);
  });
});

describe("[R5C-3V2] the uppercase policy is refusal, not normalization", () => {
  it("rejects an uppercase sha", () => {
    // `git rev-parse HEAD` emits lowercase, always. An uppercase value did NOT come from the one
    // trusted producer, and lower-casing it here would accept a value of unknown origin.
    expect(resolveSourceIdentity(REAL.toUpperCase())).toEqual({ ok: false, reason: "not_lowercase_hex" });
  });

  it("rejects a mixed-case sha", () => {
    const mixed = REAL.slice(0, 20) + REAL.slice(20).toUpperCase();
    expect(resolveSourceIdentity(mixed).ok).toBe(false);
  });
});

describe("[R5C-3V2] surrounding whitespace is not repaired", () => {
  it.each([[` ${REAL}`], [`${REAL} `], [`${REAL}\n`]])("rejects %j", (value) => {
    // Silently trimming would hide whatever mangled the value on its way here.
    expect(resolveSourceIdentity(value).ok).toBe(false);
  });
});

describe("[R5C-3V2] there is no fallback chain", () => {
  it("is a pure function of its single argument", () => {
    // No environment, no clock, no I/O: the rule is testable independently of how a value arrives.
    const before = { ...process.env };
    process.env.BTY_DEPLOY_VERSION = "2026-04-27-api-version-endpoint-v1";
    process.env.BTY_APP_VERSION = "0.1.0";
    expect(resolveSourceIdentity(undefined)).toEqual({ ok: false, reason: "absent" });
    process.env = before;
  });
});
