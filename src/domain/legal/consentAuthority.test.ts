import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACTIVE_CONSENT_VERSION,
  activeConsentDocument,
  canonicalConsentPayload,
  consentSatisfied,
  isConsentLocale,
  type ConsentDocument,
} from "./consent-document";
import { consentDocumentFingerprint } from "./consent-fingerprint";

/**
 * SLICE 3.2R-R9A — CONSENT AUTHORITY CORE.
 *
 * Founder decision: one server-owned active consent version, satisfied only by exact equality.
 * A historical acceptance never satisfies a future consent version.
 */

const EN = activeConsentDocument("en-US")!;
const KO = activeConsentDocument("ko-KR")!;

describe("[3.2R-R9A] the gate — exact equality, never presence", () => {
  it("case 1 — a null profile version requires consent", () => {
    expect(consentSatisfied(null)).toBe(false);
    expect(consentSatisfied(undefined)).toBe(false);
    expect(consentSatisfied("")).toBe(false);
  });

  it("case 2 — an OLD version requires consent (the whole point of the slice)", () => {
    // 13 live rows carry exactly this. Under the old rule they passed forever.
    expect(consentSatisfied("2026-05-pending-v1")).toBe(false);
  });

  it("case 3 — the exact active version is allowed", () => {
    expect(consentSatisfied(ACTIVE_CONSENT_VERSION)).toBe(true);
  });

  it("case 4 — an arbitrary or future non-empty version requires consent", () => {
    for (const bogus of ["2099-12-anything", "yes", "true", "2026-05-v2", " 2026-05-v1"]) {
      expect(consentSatisfied(bogus), bogus).toBe(false);
    }
  });

  it("the OLD rule and the NEW rule genuinely disagree — this is not a no-op refactor", () => {
    const presenceOnly = (v: unknown) => Boolean(v);
    for (const v of ["2026-05-pending-v1", "2099-12-anything"]) {
      expect(presenceOnly(v)).toBe(true); // would have passed
      expect(consentSatisfied(v)).toBe(false); // now correctly gated
    }
  });
});

describe("[3.2R-R9A] document binding — content and version cannot diverge", () => {
  it("case 18 — changing canonical content changes the fingerprint", () => {
    const before = consentDocumentFingerprint(EN);
    const edited: ConsentDocument = {
      ...EN,
      sections: EN.sections.map((s, i) =>
        i === 0 ? { ...s, paragraphs: [["bty is a training tool for your dental practice!"]] } : s,
      ),
    };
    expect(consentDocumentFingerprint(edited)).not.toBe(before);
  });

  it("case 18b — moving a word into bold changes it too: emphasis is part of how it reads", () => {
    const plain: ConsentDocument = {
      ...EN,
      sections: EN.sections.map((s, i) => (i === 0 ? { ...s, paragraphs: [["Accept now"]] } : s)),
    };
    const bold: ConsentDocument = {
      ...EN,
      sections: EN.sections.map((s, i) =>
        i === 0 ? { ...s, paragraphs: [[{ strong: "Accept now" }]] } : s,
      ),
    };
    expect(consentDocumentFingerprint(plain)).not.toBe(consentDocumentFingerprint(bold));
  });

  it("case 20 — the same prose under a different VERSION cannot collide", () => {
    const bumped: ConsentDocument = { ...EN, version: "2027-01-final-v1" };
    expect(consentDocumentFingerprint(bumped)).not.toBe(consentDocumentFingerprint(EN));
  });

  it("case 20b — the same prose under a different CLASSIFICATION cannot collide", () => {
    const final: ConsentDocument = { ...EN, classification: "final" };
    expect(consentDocumentFingerprint(final)).not.toBe(consentDocumentFingerprint(EN));
  });

  it("identical content is identical every time — deterministic, not incidental", () => {
    expect(consentDocumentFingerprint(EN)).toBe(consentDocumentFingerprint(EN));
    expect(canonicalConsentPayload(EN)).toBe(canonicalConsentPayload(EN));
    expect(consentDocumentFingerprint(EN)).toMatch(/^bty_consent_document_v1:[0-9a-f]{64}$/);
  });

  it("EN and KO are distinct documents under one legal version", () => {
    expect(EN.version).toBe(KO.version);
    expect(consentDocumentFingerprint(EN)).not.toBe(consentDocumentFingerprint(KO));
  });

  it("an unpublished locale is refused, never served another language's agreement", () => {
    expect(activeConsentDocument("fr-FR")).toBeNull();
    expect(activeConsentDocument(undefined)).toBeNull();
    expect(isConsentLocale("en-US")).toBe(true);
    expect(isConsentLocale("en")).toBe(false);
  });
});

describe("[3.2R-R9A] the active document is still the placeholder", () => {
  it("R9A did not bump the version or resolve the placeholder", () => {
    expect(ACTIVE_CONSENT_VERSION).toBe("2026-05-v1");
    expect(EN.classification).toBe("placeholder");
    expect(KO.classification).toBe("placeholder");
  });

  it("the shipped prose is carried over unedited — spot-checked against the live wording", () => {
    const en = canonicalConsentPayload(EN);
    expect(EN.title).toBe("bty — information notice and consent");
    expect(en).toContain("Do not include patient names or protected health information (PHI)");
    expect(en).toContain("supports chat, mentor, and training-related AI features");
    expect(en).toContain("You may request deletion of your account information through your practice administrator.");
    const ko = canonicalConsentPayload(KO);
    expect(KO.title).toBe("bty 안내 및 동의");
    expect(ko).toContain("bty는 치과 진료실 팀을 위한 훈련 도구입니다.");
    expect(ko).toContain("계정 정보의 삭제는 진료실 관리자를 통해 요청하실 수 있습니다.");
  });
});

describe("[3.2R-R9A] case 24 — historical acceptance rows stay immutable", () => {
  /** Every .ts/.tsx under src, so a future UPDATE/DELETE path cannot slip in unnoticed. */
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sourceFiles(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("no code path updates or deletes an arena_consent_log row", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("arena_consent_log")) continue;
      // The only writer may INSERT. `.update(` / `.delete(` / `.upsert(` chained onto this table
      // would rewrite evidence of what a user agreed to, which must never become possible.
      const chained = /arena_consent_log"\)\s*\.\s*(update|delete|upsert)\s*\(/.test(src);
      if (chained) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("the acceptance writer INSERTs and does not carry an update/delete of its own", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/legal/accept/route.ts"),
      "utf8",
    );
    expect(route).toContain('from("arena_consent_log").insert(');
    expect(route).not.toMatch(/arena_consent_log"\)\s*\.\s*(update|delete)\s*\(/);
  });
});
