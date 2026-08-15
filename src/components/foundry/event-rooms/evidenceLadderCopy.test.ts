import { describe, it, expect } from "vitest";
import { EVIDENCE_LADDER } from "@/domain/foundry/module/program-authorship";
import {
  EVIDENCE_DISPLAY_ORDER,
  HOST_RUNG_LABEL,
  LEARNER_RUNG_LABEL,
} from "./evidenceLadderCopy";

/**
 * Slice 3.2R-R1 — the copy module restates the ladder order instead of importing the value, to
 * keep a 2,700-line domain module out of the client bundle. This is the test that makes the
 * restatement safe: a rung added to `EVIDENCE_LADDER` fails here, loudly, instead of silently
 * failing to render on either surface.
 */
describe("evidence rung copy", () => {
  it("display order is byte-identical to the canonical EVIDENCE_LADDER", () => {
    expect([...EVIDENCE_DISPLAY_ORDER]).toEqual([...EVIDENCE_LADDER]);
  });

  it("every rung has a learner label and a Host label in BOTH locales", () => {
    for (const level of EVIDENCE_LADDER) {
      for (const loc of ["en", "ko"] as const) {
        expect(LEARNER_RUNG_LABEL[loc][level], `learner ${loc} ${level}`).toBeTruthy();
        expect(HOST_RUNG_LABEL[loc][level], `host ${loc} ${level}`).toBeTruthy();
      }
    }
  });

  it("the Host never reads a bare 'Applied' — a self-report is labelled as one", () => {
    /*
      The learner reading their own record may say "Applied"; they know what they meant. A Host
      reading someone ELSE's record must not mistake a self-report for a confirmed fact, so the
      two vocabularies deliberately differ exactly here.
    */
    expect(HOST_RUNG_LABEL.en.applied).toMatch(/self-report/i);
    expect(HOST_RUNG_LABEL.en.applied).not.toBe(LEARNER_RUNG_LABEL.en.applied);
    expect(HOST_RUNG_LABEL.ko.applied).toContain("본인");
    expect(HOST_RUNG_LABEL.ko.applied).not.toBe(LEARNER_RUNG_LABEL.ko.applied);
  });

  it("OBSERVED names its source so it cannot be read as the row above it", () => {
    expect(HOST_RUNG_LABEL.en.observed).toMatch(/independent/i);
    expect(HOST_RUNG_LABEL.ko.observed).toContain("제3자");
  });

  it("no label anywhere implies failure, lateness or a score", () => {
    /*
      An unestablished rung has not failed — it has not happened yet, and for most trainings most
      rungs never will. A single "missing"/"overdue"/"0/7" string would turn a learning history
      into a compliance dashboard, which the R1 UX gate explicitly refuses.
    */
    const forbidden = [
      /missing/i, /incomplete/i, /fail/i, /overdue/i, /not yet/i, /pending/i,
      /score/i, /rating/i, /%/, /\d\s*\/\s*\d/,
      /미완/, /실패/, /지연/, /점수/, /평가/,
    ];
    const all = [
      ...Object.values(LEARNER_RUNG_LABEL.en), ...Object.values(LEARNER_RUNG_LABEL.ko),
      ...Object.values(HOST_RUNG_LABEL.en), ...Object.values(HOST_RUNG_LABEL.ko),
    ];
    for (const label of all) {
      for (const bad of forbidden) {
        expect(bad.test(label), `${label} matched ${bad}`).toBe(false);
      }
    }
  });
});
