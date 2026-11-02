/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { ConsentDocumentView } from "./ConsentDocumentView";
import { activeConsentDocument } from "@/domain/legal/consent-document";

/**
 * SLICE 3.2R-R9A — THE PROSE DID NOT CHANGE.
 *
 * R9A moved the consent body out of hardcoded JSX and into the document authority so it could be
 * fingerprinted. That is structural work on the most sensitive text in the product, and "I copied
 * it carefully" is not evidence. This compares the words the PREVIOUS shipped page rendered
 * against the words the NEW renderer produces.
 *
 * The old side is the exact historical file fetched at the shipped ref, frozen as a
 * fixture and checked against its Git blob SHA before reducing the text. This
 * avoids depending on whichever historical Git objects a checkout happens to contain. The new side is really
 * rendered. Both are reduced to a WORD SEQUENCE, so only whitespace amount is ignored: a single
 * added, removed or reordered word in either language fails this test.
 */

/** Exact historical GitHub blob at bd7784de, before the document-authority slice. */
const BASELINE_BLOB = "41296c5558fb377bdbbc941e825ece09f03fe379";

function oldPageSource(): string {
  const bytes = readFileSync(path.resolve(process.cwd(), "src/test/fixtures/legal/consent-page.bd7784de.txt"));
  const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  expect(blob).toBe(BASELINE_BLOB);
  return bytes.toString("utf8");
}

/** Words only: strip JSX tags, drop expression braces, collapse all whitespace. */
function wordsFromJsx(jsx: string): string[] {
  return jsx
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Words as a READER sees them: per block element.
 *
 * `container.textContent` concatenates block elements with no separator, so a heading runs into
 * the paragraph beneath it ("…and consent" + "What bty does" → "consentWhat") and two real words
 * merge into one. That is an artifact of the DOM API, not of the document, so the text is
 * collected per h1/h2/p/li — the blocks the prose is actually written in.
 */
function wordsFromRender(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("h1, h2, p, li"))
    .map((el) => el.textContent ?? "")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

/** The `<article>` block for one locale inside the old page. */
function oldArticle(src: string, which: "en" | "ko"): string {
  const start = src.indexOf('<article className="space-y-5 text-[#1E2A38]">');
  const second = src.indexOf('<article className="space-y-5 text-[#1E2A38]">', start + 10);
  const from = which === "en" ? start : second;
  const end = src.indexOf("</article>", from);
  expect(from).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(from);
  return src.slice(from, end);
}

/**
 * Stripping `</strong>` out of `<strong>Accept</strong>,` leaves a detached "," token that no
 * reader ever sees — the rendered document correctly reads "Accept,". Re-attaching punctuation to
 * the preceding word on BOTH sides removes that extraction artifact symmetrically, without hiding
 * any real difference in the prose.
 */
function comparable(words: string[]): string {
  return words.join(" ").replace(/\s+([,.:;!?])/g, "$1");
}

describe("[3.2R-R9A] the consent wording is byte-for-word what was already shipped", () => {
  const src = oldPageSource();

  it("EN — every word, in order, matches the previously deployed document", () => {
    const before = wordsFromJsx(oldArticle(src, "en"));
    const { container } = render(<ConsentDocumentView doc={activeConsentDocument("en-US")!} />);
    const after = wordsFromRender(container);
    expect(before.length).toBeGreaterThan(200); // the extraction actually found the document
    expect(comparable(after)).toEqual(comparable(before));
  });

  it("KO — every word, in order, matches the previously deployed document", () => {
    const before = wordsFromJsx(oldArticle(src, "ko"));
    const { container } = render(<ConsentDocumentView doc={activeConsentDocument("ko-KR")!} />);
    const after = wordsFromRender(container);
    expect(before.length).toBeGreaterThan(100);
    expect(comparable(after)).toEqual(comparable(before));
  });

  it("the placeholder era is preserved, not quietly resolved", () => {
    // R9A must not improve, translate or finalize legal language.
    const en = render(<ConsentDocumentView doc={activeConsentDocument("en-US")!} />);
    expect(en.container.textContent).toContain("third-party AI services");
    const ko = render(<ConsentDocumentView doc={activeConsentDocument("ko-KR")!} />);
    expect(ko.container.textContent).toContain("AI 서비스로 전송되어");
  });
});
