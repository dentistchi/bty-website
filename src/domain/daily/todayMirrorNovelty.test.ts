import { describe, it, expect } from "vitest";
import {
  actionVerbOf, openingPatternOf, noveltySignatureOf, checkNovelty,
} from "@/domain/daily/todayMirrorNovelty";
import { EMPTY_RECENT_CONTEXT, type TodayMirrorResponse } from "@/domain/daily/todayMirror.types";

function resp(over: Partial<TodayMirrorResponse>): TodayMirrorResponse {
  return {
    mirror: "After letting something slip, you came back to it.",
    perspective: "The edge today may be starting a little earlier.",
    suggestedStep: { text: "Reach out with one question.", observableCompletion: "sent", timeWindow: "today" },
    uncertaintyNote: null,
    lens: "return_after_miss",
    evidenceIds: ["f0"],
    noveltySignature: "",
    ...over,
  };
}

describe("today mirror novelty", () => {
  it("derives verb + opening + signature", () => {
    expect(actionVerbOf("Reach out with one question.")).toBe("reach");
    expect(openingPatternOf("After letting something slip, you came back.")).toContain("after letting");
    const sig = noveltySignatureOf("return_after_miss", "After X", "Reach out");
    expect(sig).toBe("return_after_miss|after x|reach");
  });

  it("no violations against empty recent context", () => {
    const r = resp({ noveltySignature: noveltySignatureOf("return_after_miss", "After X", "Reach out") });
    expect(checkNovelty(r, EMPTY_RECENT_CONTEXT)).toEqual([]);
  });

  it("flags repeated signature", () => {
    const sig = noveltySignatureOf("return_after_miss", "After letting something slip", "Reach out");
    const r = resp({ noveltySignature: sig });
    expect(checkNovelty(r, { ...EMPTY_RECENT_CONTEXT, recentNoveltySignatures: [sig] })).toContain("REPEAT_SIGNATURE");
  });

  it("flags lens overuse (>=2 in recent)", () => {
    const r = resp({ noveltySignature: "x" });
    expect(checkNovelty(r, { ...EMPTY_RECENT_CONTEXT, recentLenses: ["return_after_miss", "return_after_miss"] }))
      .toContain("REPEAT_LENS_OVERUSE");
  });

  it("flags repeated action verb", () => {
    const r = resp({ noveltySignature: "x" });
    expect(checkNovelty(r, { ...EMPTY_RECENT_CONTEXT, recentActionVerbs: ["reach"] })).toContain("REPEAT_ACTION_VERB");
  });
});
