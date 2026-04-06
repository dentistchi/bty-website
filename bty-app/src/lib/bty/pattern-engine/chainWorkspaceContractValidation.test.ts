import { describe, expect, it } from "vitest";
import {
  parseStrictChainListIndex,
  validateChainWorkspaceContract,
  validateContractHow,
  validateContractWho,
} from "./chainWorkspaceContractValidation";

describe("parseStrictChainListIndex", () => {
  it("accepts blank as default", () => {
    expect(parseStrictChainListIndex("", 5)).toBe("default");
    expect(parseStrictChainListIndex("   ", 5)).toBe("default");
  });

  it("accepts exact integers in range", () => {
    expect(parseStrictChainListIndex("1", 3)).toBe(0);
    expect(parseStrictChainListIndex("3", 3)).toBe(2);
    expect(parseStrictChainListIndex("10", 10)).toBe(9);
  });

  it("rejects suffix junk and parseInt-style acceptance", () => {
    expect(parseStrictChainListIndex("1n", 5)).toBeNull();
    expect(parseStrictChainListIndex("2abc", 5)).toBeNull();
    expect(parseStrictChainListIndex("1.5", 5)).toBeNull();
  });

  it("rejects leading zeros and out of range", () => {
    expect(parseStrictChainListIndex("01", 5)).toBeNull();
    expect(parseStrictChainListIndex("0", 5)).toBeNull();
    expect(parseStrictChainListIndex("4", 3)).toBeNull();
  });
});

describe("validateContractWho", () => {
  it("requires 2 letters or numbers", () => {
    expect(validateContractWho("AB")).toBeNull();
    expect(validateContractWho("A2")).toBeNull();
    expect(validateContractWho("李張")).toBeNull();
    expect(validateContractWho("A")).not.toBeNull();
    expect(validateContractWho("!!")).not.toBeNull();
  });
});

describe("validateContractHow", () => {
  it("allows normal sentences", () => {
    expect(validateContractHow("I'd like to talk this week.")).toBeNull();
    expect(validateContractHow("안녕하세요, 잠깐 이야기할게요.")).toBeNull();
  });

  it("rejects punctuation-only and too short", () => {
    expect(validateContractHow("!!!")).not.toBeNull();
    expect(validateContractHow("...")).not.toBeNull();
    expect(validateContractHow("a")).not.toBeNull();
  });
});

describe("validateChainWorkspaceContract", () => {
  it("passes coherent answers", () => {
    const r = validateChainWorkspaceContract({
      who: "Sam Lee",
      what: "the overdue project timeline with Sam",
      when: "Tuesday 10am",
      how: "I want to align on dates before Friday.",
    });
    expect(r.ok).toBe(true);
  });
});
