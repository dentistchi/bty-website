/**
 * CAPTURED-EVIDENCE COMPATIBILITY UNDER RULE-KIND SCOPE (Slice 3.2I-R5B1A.1-R2.56 Part 10).
 *
 * A scoping change to the canonical table is a change to how EVERY row ever measured is read. The
 * risk is not that the fix fails — it is that it also silently reclassifies evidence that was never
 * in question, and that the reclassification is only noticed on a live run.
 *
 * R2.55 measured the exposure across all retained boundary replays: 232 model-authored assessments,
 * four distinct fact triples, and ZERO occurrences of the prohibition-only triple. This file re-runs
 * that measurement against the code as it stands, so "nothing else moved" is asserted rather than
 * asserted-about.
 *
 * Two sources are used, deliberately:
 *   - the TRACKED captured DTO fixtures, which travel with the repository and cannot go missing;
 *   - the retained `.eval-artifacts` replays, when present. Those are untracked working evidence, so
 *     the sweep degrades to a stated skip rather than a false pass.
 *
 * No artifact is rewritten, and no fixture is edited. R2.56 applies the corrected authority TO this
 * evidence; it never writes into it.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyTruthState } from "./boundaryTruthStates";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { C18_BOUNDARY } from "./c18BoundaryFixture";
import { R248_ATTEMPT_1, R248_WHOLE_ROW_REPAIR } from "./r248LiveDtoFixture";
import { R252_CAPTURED_GROUP_SELECTION, R252_CAPTURED_PATCH, R252_MEASURED } from "./r252LiveDtoFixture";

/** c18 is the only boundary any captured artifact carries, and it is a prerequisite rule. */
const C18_RULE_KIND = buildSemanticFrames([C18_BOUNDARY])[0]!.ruleKind;

type Facts = { governedActionStatus?: string; prerequisiteStatus?: string; temporalRelation?: string };
const key = (a: Facts) => `${a.governedActionStatus}/${a.prerequisiteStatus}/${a.temporalRelation}`;

/**
 * What R2.55 measured, and what every captured row must still classify to.
 *
 * This is the WHOLE distribution, not a sample: an entry that stopped appearing would be as much a
 * regression as one that changed meaning.
 */
const EXPECTED_LIVE_DISTRIBUTION: Record<string, { count: number; stateId: string | null }> = {
  "absent/not_applicable/not_applicable": { count: 135, stateId: "non_governing" },
  "present/explicitly_missing/action_before_prerequisite": { count: 47, stateId: "governed_action_prerequisite_missing" },
  "present/satisfied/prerequisite_before_action": { count: 9, stateId: "governed_action_prerequisite_satisfied" },
  "present/not_established/unrelated": { count: 1, stateId: "governed_action_prerequisite_not_established" },
  /** The patch-response evidence entries carry `repairs[]`, so their rows have no facts at all. */
  "undefined/undefined/undefined": { count: 52, stateId: null },
};

/**
 * R2.55 measured 232 rows; the R2.57 controlled live replay then added its own attempt-1 response,
 * which is byte-identical to `R248_ATTEMPT_1` — 10 administrative rows and 2 violating ones. The
 * TOTAL moved because the evidence set grew, not because any row reclassified: every distinct triple
 * and every state below is unchanged, and the R2.57 rows land in two buckets that already existed.
 */
const R255_MEASURED_ROWS = 232;
const R257_ADDED_ROWS = 12;

const ARTIFACT_DIR = join(process.cwd(), ".eval-artifacts");
const replayFiles = (): string[] => {
  try {
    return readdirSync(ARTIFACT_DIR).filter((f) => f.startsWith("practice-review.boundaryreplay.") && f.endsWith(".json"));
  } catch {
    return [];
  }
};

describe("[R2.56][10] the TRACKED captured fixtures classify exactly as before", () => {
  it("every retained R2.48 attempt-1 row keeps its state", () => {
    const seen = R248_ATTEMPT_1.map((r) => ({ ref: r.surfaceRef, id: classifyTruthState(r, C18_RULE_KIND)?.id ?? null }));
    // 10 administrative rows, 2 governed. None of them is the prohibition triple.
    expect(seen.filter((x) => x.id === "non_governing")).toHaveLength(10);
    expect(seen.filter((x) => x.id === "governed_action_prerequisite_missing")).toHaveLength(2);
    expect(seen.filter((x) => x.id === null)).toHaveLength(0);
    expect(seen.filter((x) => x.id === "prohibited_action_present")).toHaveLength(0);
  });

  it("every retained R2.48 whole-row repair row keeps its state", () => {
    for (const r of R248_WHOLE_ROW_REPAIR) {
      const id = classifyTruthState(r, C18_RULE_KIND)?.id ?? null;
      expect(id, `${r.surfaceRef} ${key(r)}`).not.toBeNull();
      expect(id, r.surfaceRef).not.toBe("prohibited_action_present");
    }
  });

  it("the captured R2.52 patch selection is unaffected — its defect was never the prohibition row", () => {
    // It chose `not_established`, which is still canonical here. R2.56 changes nothing about the
    // R2.53 arc; that refusal remains a reason-authority refusal.
    expect(R252_CAPTURED_GROUP_SELECTION.prerequisiteStatus).toBe("not_established");
    const s = classifyTruthState(
      {
        governedActionStatus: "present",
        prerequisiteStatus: R252_CAPTURED_GROUP_SELECTION.prerequisiteStatus,
        temporalRelation: R252_CAPTURED_GROUP_SELECTION.temporalRelation,
      } as never,
      C18_RULE_KIND,
    );
    expect(s?.id).toBe("governed_action_prerequisite_not_established");
    expect(s?.reasonAuthority).toBe("model_required");
    expect(R252_MEASURED.mergedRowRefusalCode).toBe("boundary_reason_required_missing");
    expect(R252_CAPTURED_PATCH).toHaveLength(13);
  });
});

describe("[R2.56][10] the retained live replays reclassify identically", () => {
  const sweep = () => {
    const counts: Record<string, number> = {};
    const states: Record<string, Set<string | null>> = {};
    let rows = 0;
    for (const f of replayFiles()) {
      const b = JSON.parse(readFileSync(join(ARTIFACT_DIR, f), "utf8")) as {
        boundaryReviewEvidence?: Array<{ parsed?: { assessments?: Facts[] } }>;
      };
      for (const ev of b.boundaryReviewEvidence ?? []) {
        for (const a of ev?.parsed?.assessments ?? []) {
          rows++;
          const k = key(a);
          counts[k] = (counts[k] ?? 0) + 1;
          (states[k] ??= new Set()).add(classifyTruthState(a as never, C18_RULE_KIND)?.id ?? null);
        }
      }
    }
    return { counts, states, rows };
  };

  it("the measured distribution is unchanged, row for row", () => {
    if (replayFiles().length === 0) return expect(replayFiles()).toHaveLength(0); // stated skip, never a silent pass
    const { counts, states, rows } = sweep();
    expect(rows).toBe(R255_MEASURED_ROWS + R257_ADDED_ROWS);
    expect(Object.keys(counts).sort()).toEqual(Object.keys(EXPECTED_LIVE_DISTRIBUTION).sort());
    for (const [k, expected] of Object.entries(EXPECTED_LIVE_DISTRIBUTION)) {
      expect(counts[k], k).toBe(expected.count);
      expect([...states[k]!], k).toEqual([expected.stateId]);
    }
  });

  it("the prohibition-only triple occurs ZERO times, exactly as R2.55 measured", () => {
    if (replayFiles().length === 0) return expect(replayFiles()).toHaveLength(0);
    const { counts } = sweep();
    expect(counts["present/not_applicable/not_applicable"]).toBeUndefined();
    // So no captured run's classification could have moved, whatever the scope now says.
    expect(Object.keys(counts)).not.toContain("present/not_applicable/not_applicable");
  });

  it("no captured row anywhere classifies to the prohibition state under c18", () => {
    if (replayFiles().length === 0) return expect(replayFiles()).toHaveLength(0);
    const { states } = sweep();
    for (const [k, ids] of Object.entries(states)) expect([...ids], k).not.toContain("prohibited_action_present");
  });

  it("historical artifacts stay readable, and every retained artifact version still parses", () => {
    const files = replayFiles();
    if (files.length === 0) return expect(files).toHaveLength(0);
    const versions = new Set<string>();
    for (const f of files) {
      const b = JSON.parse(readFileSync(join(ARTIFACT_DIR, f), "utf8")) as { artifactVersion?: string };
      if (b.artifactVersion) versions.add(b.artifactVersion);
    }
    expect(versions.size).toBeGreaterThan(0);
    for (const v of versions) expect(v).toMatch(/^practice-narrow-boundary-replay\/\d+$/);
  });
});
