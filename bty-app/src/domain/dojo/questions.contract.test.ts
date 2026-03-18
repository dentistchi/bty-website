import { describe, it, expect } from "vitest";
import {
  DOJO_50_QUESTION_SET_VERSION,
  validateDojo50QuestionIdsChecksum,
  validateDojo50QuestionSetContract,
} from "./questions";

const IDS_1_50 = Array.from({ length: 50 }, (_, i) => i + 1);

describe("dojo50 question set version/checksum (244)", () => {
  it("validateDojo50QuestionIdsChecksum", () => {
    expect(validateDojo50QuestionIdsChecksum(IDS_1_50)).toBe(true);
    expect(validateDojo50QuestionIdsChecksum(IDS_1_50.slice(0, 49))).toBe(false);
    expect(validateDojo50QuestionIdsChecksum([...IDS_1_50.slice(0, 49), 51])).toBe(false);
    expect(validateDojo50QuestionIdsChecksum([2, ...IDS_1_50.slice(1)])).toBe(false);
  });

  it("validateDojo50QuestionSetContract", () => {
    expect(
      validateDojo50QuestionSetContract({
        setVersion: DOJO_50_QUESTION_SET_VERSION,
        questionIds: IDS_1_50,
      }).ok
    ).toBe(true);
    expect(
      validateDojo50QuestionSetContract({ setVersion: "wrong", questionIds: IDS_1_50 })
        .error
    ).toBe("version");
    expect(
      validateDojo50QuestionSetContract({
        setVersion: DOJO_50_QUESTION_SET_VERSION,
        questionIds: IDS_1_50.slice(0, 10),
      }).error
    ).toBe("checksum");
  });
});
