import { describe, it, expect } from "vitest";
import { derivePdfPageCountDeep } from "./pdfPageCountDeep";
import { derivePdfPageCount } from "@/domain/foundry/events/foundry-pdf-inspect";
import { deflateSync } from "node:zlib";

/**
 * SLICE 3.2R-R6 — UNKNOWN IS NOT ONE.
 *
 * `SafetyToolkit_Huddles.pdf` is four pages. Its page tree lives inside nine Flate-compressed
 * object streams, so the pure byte-scanning inspector found no `/Count` and no `/Type /Page` and
 * honestly reported `null` — exactly as its own header always warned it might.
 *
 * The defect was downstream: publish read `asset.page_count ?? 1`. A four-page document would
 * have shipped with a one-page reading gate, the learner's room would have said "1 / 1", and
 * `document_read_completed_at` — the EXPOSED authority — would have been written for someone who
 * read a quarter of it.
 *
 * Two things had to be true, and both are asserted here: the deep pass must read the real count
 * from the real structure, and an unknown count must never become a number.
 */

/** A minimal PDF whose page tree is plain text — the shape the surface scan already handled. */
function plainPdf(pages: number): Uint8Array {
  const objs = Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj\n<< /Type /Page >>\nendobj\n`).join("");
  return new TextEncoder().encode(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n${objs}%%EOF\n`,
  );
}

/**
 * A PDF whose page tree is ONLY inside a compressed object stream — the structural property of
 * the real failing file, reproduced without shipping someone else's document as a fixture.
 */
function objectStreamPdf(pages: number): Uint8Array {
  const inner = `<< /Type /Pages /Count ${pages} >>`;
  const compressed = deflateSync(Buffer.from(inner, "latin1"));
  const head = Buffer.from(`%PDF-1.6\r%\xe2\xe3\xcf\xd3\r\n84 0 obj\r<</Filter/FlateDecode/N 1/Type/ObjStm>>stream\r\n`, "latin1");
  // The trailing CRLF before `endstream` is the detail that breaks a naive decompressor.
  const tail = Buffer.from(`\r\nendstream\rendobj\r\n%%EOF\r\n`, "latin1");
  return new Uint8Array(Buffer.concat([head, compressed, tail]));
}

describe("[3.2R-R6] the deep pass reads what the surface scan cannot", () => {
  it("a compressed page tree yields the real count, and says which pass found it", async () => {
    const bytes = objectStreamPdf(4);
    expect(derivePdfPageCount(bytes).count, "the surface scan cannot see inside the stream").toBeNull();
    const deep = await derivePdfPageCountDeep(bytes);
    expect(deep.count).toBe(4);
    expect(deep.method).toBe("object_stream_count");
  });

  it("and the trailing EOL before `endstream` does not defeat it", async () => {
    /*
      MEASURED ON THE REAL FILE. `node:zlib` tolerates the byte between the compressed data and
      the `endstream` keyword; `DecompressionStream` does not. With it, all 38 Flate streams in
      SafetyToolkit_Huddles.pdf failed to inflate and the deep pass returned a perfectly honest
      "undeterminable" — useless, and indistinguishable from a genuinely unreadable file.
    */
    for (const eol of ["\r\n", "\r", "\n"]) {
      const inner = "<< /Type /Pages /Count 7 >>";
      const compressed = deflateSync(Buffer.from(inner, "latin1"));
      const bytes = new Uint8Array(Buffer.concat([
        Buffer.from("%PDF-1.6\r\n1 0 obj\r<</Filter/FlateDecode/Type/ObjStm>>stream\r\n", "latin1"),
        compressed,
        Buffer.from(`${eol}endstream\rendobj\r\n%%EOF`, "latin1"),
      ]));
      expect((await derivePdfPageCountDeep(bytes)).count, JSON.stringify(eol)).toBe(7);
    }
  });
});

describe("[3.2R-R6] ordinary PDFs are unchanged, and unknown stays unknown", () => {
  it("a one-page PDF is one page — verified, not defaulted", async () => {
    const deep = await derivePdfPageCountDeep(plainPdf(1));
    expect(deep.count).toBe(1);
    expect(deep.method).toBe("page_tree_count");
  });

  it("a multi-page PDF keeps its count", async () => {
    for (const n of [2, 9, 40]) {
      expect((await derivePdfPageCountDeep(plainPdf(n))).count, `${n} pages`).toBe(n);
    }
  });

  it("malformed, non-PDF and empty bytes are NEVER counted as one", async () => {
    /*
      The whole point. A real single-page PDF and a file whose length cannot be read are
      different facts; sharing the value 1 is what let a four-page document publish as one page.
    */
    for (const [label, bytes] of [
      ["malformed pdf", new TextEncoder().encode("%PDF-1.7\nnot really a pdf\n%%EOF")],
      ["non-pdf bytes", new TextEncoder().encode("hello world, definitely not a pdf")],
      ["empty", new Uint8Array()],
      ["truncated stream", new TextEncoder().encode("%PDF-1.6\r\n1 0 obj\r<</Filter/FlateDecode>>stream\r\n\x78\x9c\x00")],
    ] as const) {
      const deep = await derivePdfPageCountDeep(bytes);
      expect(deep.count, label).toBeNull();
      expect(deep.method, label).toBe("undeterminable");
    }
  });

  it("a stream that is not a page tree contributes nothing rather than a wrong number", async () => {
    const compressed = deflateSync(Buffer.from("just some compressed prose, no page objects", "latin1"));
    const bytes = new Uint8Array(Buffer.concat([
      Buffer.from("%PDF-1.6\r\n1 0 obj\r<</Filter/FlateDecode>>stream\r\n", "latin1"),
      compressed,
      Buffer.from("\r\nendstream\rendobj\r\n%%EOF", "latin1"),
    ]));
    expect((await derivePdfPageCountDeep(bytes)).count).toBeNull();
  });
});
