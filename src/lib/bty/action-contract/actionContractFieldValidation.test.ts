import { describe, expect, it } from "vitest";
import {
  validateContractHow,
  validateContractWhat,
  validateContractWhenDetailed,
  validateContractWho,
} from "./actionContractFieldValidation";

describe("validateContractWho", () => {
  it("accepts a real name", () => {
    expect(validateContractWho("Jordan Park")).toBeNull();
  });

  it("rejects group-only answers", () => {
    expect(validateContractWho("everyone")).not.toBeNull();
    expect(validateContractWho("the team")).not.toBeNull();
    expect(validateContractWho("staff")).not.toBeNull();
  });
});

describe("validateContractWhat", () => {
  it("rejects one word", () => {
    expect(validateContractWhat("deadlines")).not.toBeNull();
  });

  it("rejects person-label phrasing", () => {
    expect(validateContractWhat("she is difficult to work with")).not.toBeNull();
  });

  it("accepts situation-focused text", () => {
    expect(
      validateContractWhat("the budget numbers we have not reviewed together since Q2"),
    ).toBeNull();
  });
});

describe("validateContractWhenDetailed", () => {
  it("rejects distant or vague times", () => {
    expect(validateContractWhenDetailed("in 1 year")?.rule).toBe("R5");
    expect(validateContractWhenDetailed("someday")?.rule).toBe("R5");
    expect(validateContractWhenDetailed("later")?.rule).toBe("R5");
  });

  it("accepts near anchors", () => {
    expect(validateContractWhenDetailed("tomorrow 9am")).toBeNull();
    expect(validateContractWhenDetailed("this week Thursday")).toBeNull();
  });
});

describe("validateContractHow", () => {
  it("rejects accusation-first openings", () => {
    expect(validateContractHow("You never listen to feedback.")).not.toBeNull();
    expect(validateContractHow("you are always late")).not.toBeNull();
  });

  it("accepts responsibility-first", () => {
    expect(validateContractHow("I want to clear up what happened on the handoff.")).toBeNull();
  });
});
