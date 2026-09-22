/**
 * The Host-facing reading of a failed delivery. Slice Teams Delivery Diagnostics V1.
 *
 * The defect: the API returned a product reason per recipient and the client discarded it, so four
 * different problems — three of which the Host cannot fix, one of which they can — reached them as
 * one undifferentiated failure.
 */
import { describe, it, expect } from "vitest";
import { EVENT_ROOMS_COPY } from "@/components/foundry/event-rooms/copy";
import { deliveryReasonSentence, groupUndeliverable, isDeliveryReason, DELIVERY_REASONS } from "./deliveryReason";

const en = EVENT_ROOMS_COPY.en;

describe("★ a Host can tell the four causes apart", () => {
  it("each reason maps to its own ordinary-language sentence", () => {
    expect(deliveryReasonSentence("not_installed", en)).toBe("BTY isn't installed for this employee in Teams.");
    expect(deliveryReasonSentence("not_eligible", en)).toBe("This account can't receive this training.");
    expect(deliveryReasonSentence("no_route", en)).toBe("BTY can't reach Teams for this organization yet.");
    expect(deliveryReasonSentence("unknown", en)).toBe("Teams couldn't confirm delivery.");
    expect(deliveryReasonSentence("failed", en)).toBe("BTY couldn't send the training.");
  });

  it("no two reasons share a sentence — otherwise they would be indistinguishable again", () => {
    const sentences = DELIVERY_REASONS.map((r) => deliveryReasonSentence(r, en));
    expect(new Set(sentences).size).toBe(DELIVERY_REASONS.length);
  });

  it("the app-not-installed case is stated as an INSTALL problem, which is the actionable one", () => {
    expect(deliveryReasonSentence("not_installed", en)).toMatch(/isn't installed/i);
  });

  it("Korean carries the same five distinct sentences", () => {
    const ko = EVENT_ROOMS_COPY.ko;
    const sentences = DELIVERY_REASONS.map((r) => deliveryReasonSentence(r, ko));
    expect(new Set(sentences).size).toBe(DELIVERY_REASONS.length);
    expect(sentences.every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe("★ no Microsoft string can reach the Host", () => {
  it("an unrecognised or hostile reason reads as the honest generic, never raw", () => {
    for (const raw of [
      "BotNotInConversationRoster",
      "403 Forbidden",
      "Authorization_RequestDenied",
      "",
      null,
      undefined,
      42,
      {},
      "not_installed ",
      "NOT_INSTALLED",
    ]) {
      const out = deliveryReasonSentence(raw, en);
      // It is always one of the five approved sentences...
      expect(DELIVERY_REASONS.map((r) => deliveryReasonSentence(r, en))).toContain(out);
      // ...and never echoes the raw value back. (Empty string trivially "contains", so skip it.)
      if (String(raw).trim().length > 0) expect(out).not.toContain(String(raw));
    }
  });

  it("only the five product reasons are recognised", () => {
    for (const r of DELIVERY_REASONS) expect(isDeliveryReason(r)).toBe(true);
    for (const r of ["ok", "sent", "forbidden", "401", "", null, 1]) expect(isDeliveryReason(r)).toBe(false);
  });
});

describe("grouping by cause", () => {
  it("one sentence per cause, with the affected names under it", () => {
    const grouped = groupUndeliverable(
      [
        { displayName: "Ari Kim", reason: "not_installed" },
        { displayName: "Bo Lee", reason: "not_installed" },
        { displayName: "Cam Doe", reason: "not_eligible" },
      ],
      en,
    );
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.sentence).toBe(en.sendReasonNotInstalled);
    expect(grouped[0]!.names).toEqual(["Ari Kim", "Bo Lee"]);
    expect(grouped[1]!.sentence).toBe(en.sendReasonNotEligible);
    expect(grouped[1]!.names).toEqual(["Cam Doe"]);
  });

  it("a recipient with no resolvable name still contributes their cause", () => {
    const grouped = groupUndeliverable([{ displayName: null, reason: "unknown" }], en);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.sentence).toBe(en.sendReasonUnknown);
    expect(grouped[0]!.names).toEqual([]);
  });

  it("is deterministic and empty for an empty list", () => {
    expect(groupUndeliverable([], en)).toEqual([]);
    const rows = [{ displayName: "A", reason: "unknown" }, { displayName: "B", reason: "not_installed" }];
    expect(groupUndeliverable(rows, en)).toEqual(groupUndeliverable(rows, en));
    // First-seen order, so the output does not shuffle between renders.
    expect(groupUndeliverable(rows, en)[0]!.sentence).toBe(en.sendReasonUnknown);
  });
});
