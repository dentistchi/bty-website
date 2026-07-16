import { describe, it, expect } from "vitest";
import { verifyPdfSignature, derivePdfPageCount } from "./foundry-pdf-inspect";

const enc = (s: string) => new TextEncoder().encode(s);

describe("verifyPdfSignature — content, not filename/MIME", () => {
  it("accepts real PDF bytes (%PDF- at start)", () => {
    expect(verifyPdfSignature(enc("%PDF-1.4\n%âãÏÓ\n"))).toBe(true);
  });
  it("accepts %PDF- after a small amount of leading junk (spec allows within 1024b)", () => {
    expect(verifyPdfSignature(enc("\n\n   %PDF-1.7 rest"))).toBe(true);
  });
  it("rejects a non-PDF renamed to .pdf (no signature)", () => {
    expect(verifyPdfSignature(enc("This is a Word doc, not a PDF."))).toBe(false);
    expect(verifyPdfSignature(enc("MZ\x90\x00 executable"))).toBe(false);
  });
  it("rejects empty/short input", () => {
    expect(verifyPdfSignature(new Uint8Array())).toBe(false);
    expect(verifyPdfSignature(enc("%PD"))).toBe(false);
  });
});

describe("derivePdfPageCount — server-side, best-effort", () => {
  it("uses the page-tree root /Count as the total", () => {
    const bytes = enc("%PDF-1.4\n1 0 obj<</Type/Pages/Kids[2 0 R]/Count 7>>endobj\n%%EOF");
    expect(derivePdfPageCount(bytes)).toEqual({ count: 7, method: "page_tree_count" });
  });
  it("falls back to counting /Type /Page object headers", () => {
    const bytes = enc("%PDF-1.4\n2 0 obj<</Type/Page>>endobj 3 0 obj<</Type /Page>>endobj\n%%EOF");
    expect(derivePdfPageCount(bytes)).toEqual({ count: 2, method: "type_page_objects" });
  });
  it("does not count /Type /Pages as a page", () => {
    const bytes = enc("%PDF-1.4\n<</Type/Pages/Kids[]>>\n%%EOF"); // no /Count, no /Page
    expect(derivePdfPageCount(bytes)).toEqual({ count: null, method: "undeterminable" });
  });
  it("returns null (undeterminable) when neither signal is present", () => {
    const bytes = enc("%PDF-1.5\n<< compressed object streams, no cleartext page tree >>");
    expect(derivePdfPageCount(bytes)).toEqual({ count: null, method: "undeterminable" });
  });
  it("caps an absurd /Count at the page bound", () => {
    const bytes = enc("%PDF-1.4\n<</Type/Pages/Count 99999>>\n%%EOF");
    expect(derivePdfPageCount(bytes).count).toBe(2000);
  });
});
