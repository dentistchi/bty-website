import { describe, expect, it } from "vitest";
import { shouldCloseQrPanel } from "./MyPageLeadershipConsole";

/**
 * Flicker regression guard: the actor's QR panel must NOT close from a residual
 * completion prop belonging to a *prior* contract. Only the currently-shown
 * contract's verification (matching id) — or the serverPack awaiting→empty
 * transition — closes it.
 */
describe("shouldCloseQrPanel", () => {
  const base = {
    qrPanelOpen: true,
    completionSuccess: false,
    completionContractId: null as string | null,
    qrContractId: null as string | null,
    hasAwaitingVerification: true, // contract is awaiting witness
    serverPackLoaded: true,
    openActionContractPresent: false,
  };

  it("does NOT close when a prior completion (different contractId) is present", () => {
    expect(
      shouldCloseQrPanel({
        ...base,
        completionSuccess: true,
        completionContractId: "prior-contract",
        qrContractId: "current-contract",
      }),
    ).toBe(false);
  });

  it("closes when the completion matches the currently-shown contract", () => {
    expect(
      shouldCloseQrPanel({
        ...base,
        completionSuccess: true,
        completionContractId: "current-contract",
        qrContractId: "current-contract",
      }),
    ).toBe(true);
  });

  it("does NOT close on completion when qrContractId is unknown (null) — no false match", () => {
    expect(
      shouldCloseQrPanel({
        ...base,
        completionSuccess: true,
        completionContractId: "prior-contract",
        qrContractId: null,
      }),
    ).toBe(false);
  });

  it("closes on the awaiting→empty fallback (verify transition), no completion prop needed", () => {
    expect(
      shouldCloseQrPanel({
        ...base,
        hasAwaitingVerification: false,
        openActionContractPresent: false,
      }),
    ).toBe(true);
  });

  it("does NOT close while still awaiting and no matching completion", () => {
    expect(shouldCloseQrPanel({ ...base })).toBe(false);
  });

  it("never closes when the panel is not open", () => {
    expect(
      shouldCloseQrPanel({
        ...base,
        qrPanelOpen: false,
        hasAwaitingVerification: false,
      }),
    ).toBe(false);
  });
});
