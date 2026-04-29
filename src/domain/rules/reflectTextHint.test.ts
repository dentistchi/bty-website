import { describe, it, expect } from "vitest";
import { reflectTextLengthHintKey } from "./reflectTextHint";

describe("reflectTextLengthHintKey", () => {
  const max = 1000;

  it("bands by length ratio", () => {
    expect(reflectTextLengthHintKey(0, max)).toBe("reflect_hint_empty");
    expect(reflectTextLengthHintKey(50, max)).toBe("reflect_hint_short");
    expect(reflectTextLengthHintKey(200, max)).toBe("reflect_hint_developing");
    expect(reflectTextLengthHintKey(600, max)).toBe("reflect_hint_substantial");
    expect(reflectTextLengthHintKey(960, max)).toBe("reflect_hint_near_limit");
    expect(reflectTextLengthHintKey(1000, max)).toBe("reflect_hint_at_limit");
  });
});
