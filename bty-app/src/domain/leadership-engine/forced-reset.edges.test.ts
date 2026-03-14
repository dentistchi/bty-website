/**
 * leadership-engine/forced-reset — 경계 테스트.
 * forced-reset.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateForcedReset,
  FORCED_RESET_NO_QR_DAYS_THRESHOLD,
  type ResetEvalInputs,
} from "./forced-reset";

describe("forced-reset (edges)", () => {
  it("noQrVerificationDays just below threshold does not add no_qr reason", () => {
    const result = evaluateForcedReset({
      stage3SelectedCountIn14d: 0,
      air7dBelow70ForTwoConsecutiveWeeks: false,
      noQrVerificationDays: FORCED_RESET_NO_QR_DAYS_THRESHOLD - 1,
      tspDecliningTwoConsecutiveWeeks: false,
    });
    expect(result.reasons).not.toContain("no_qr_verification_7_days");
    expect(result.shouldTrigger).toBe(false);
  });
});
