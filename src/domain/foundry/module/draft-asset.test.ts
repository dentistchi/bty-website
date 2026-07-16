import { describe, it, expect } from "vitest";
import { inspectAsset, MAX_ASSET_BYTES, previewSupported, participantDeliveryReady } from "./draft-asset";

/** Build a byte buffer from ascii strings and raw byte arrays. */
function buf(...parts: Array<string | number[]>): Uint8Array {
  const chunks: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") for (const ch of p) chunks.push(ch.charCodeAt(0));
    else chunks.push(...p);
  }
  return new Uint8Array(chunks);
}
const pad = (b: Uint8Array, n = 64): Uint8Array => {
  if (b.length >= n) return b;
  const out = new Uint8Array(n);
  out.set(b);
  return out;
};

const PDF = buf("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<</Type/Catalog/Count 3>>\n");
const PNG = pad(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "\0\0\0\rIHDR", [0, 0, 3, 0x20, 0, 0, 2, 0x58]));
const JPEG = pad(buf([0xff, 0xd8, 0xff, 0xe0, 0, 0x10], "JFIF\0", [0x01, 0x01, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 0x11, 8, 0x02, 0x58, 0x03, 0x20]));
const OLE = pad(buf([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
const DOCX = buf([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....word/document.xml....");
const PPTX = buf([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....ppt/presentation.xml....");
const XLSX = buf([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....xl/workbook.xml....");
const GENERIC_ZIP = buf([0x50, 0x4b, 0x03, 0x04], "....random/thing.bin....");
const HEIC = pad(buf([0, 0, 0, 0x18], "ftyp", "heic", "\0\0\0\0mif1heic"));
const TXT = buf("name,role\nAda,Lead\nGrace,Eng\n");
const EXE = pad(buf([0x4d, 0x5a], "\0\0this is a windows executable"));

describe("inspectAsset — accepts allowlisted formats with valid signatures", () => {
  it("PDF", () => {
    const r = inspectAsset("Care.pdf", PDF);
    expect(r.ok && r.value.fileKind).toBe("pdf");
  });
  it("DOCX (OOXML word package)", () => {
    const r = inspectAsset("Standard.docx", DOCX);
    expect(r.ok && r.value.fileKind).toBe("document");
  });
  it("PPTX (OOXML ppt package)", () => {
    const r = inspectAsset("Deck.pptx", PPTX);
    expect(r.ok && r.value.fileKind).toBe("presentation");
  });
  it("XLSX (OOXML xl package)", () => {
    const r = inspectAsset("Sheet.xlsx", XLSX);
    expect(r.ok && r.value.fileKind).toBe("spreadsheet");
  });
  it("legacy DOC via OLE signature", () => {
    const r = inspectAsset("Old.doc", OLE);
    expect(r.ok && r.value.fileKind).toBe("document");
  });
  it("CSV/TXT/MD as text", () => {
    expect(inspectAsset("data.csv", TXT).ok).toBe(true);
    expect(inspectAsset("notes.txt", TXT).ok).toBe(true);
    expect(inspectAsset("readme.md", TXT).ok).toBe(true);
  });
  it("PNG with parsed dimensions", () => {
    const r = inspectAsset("shot.png", PNG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.fileKind).toBe("image");
      expect(r.value.width).toBe(0x0320);
      expect(r.value.height).toBe(0x0258);
    }
  });
  it("JPEG image", () => {
    expect(inspectAsset("photo.jpg", JPEG).ok).toBe(true);
    expect(inspectAsset("photo.jpeg", JPEG).ok).toBe(true);
  });
  it("HEIC with accepted ftyp brand", () => {
    const r = inspectAsset("iphone.heic", HEIC);
    expect(r.ok && r.value.fileKind).toBe("image");
  });
});

describe("inspectAsset — rejects unsafe or mismatched files", () => {
  it("rejects an executable extension", () => {
    expect(inspectAsset("malware.exe", EXE)).toEqual({ ok: false, reason: "unsupported_file_type" });
  });
  it("rejects an archive", () => {
    expect(inspectAsset("bundle.zip", GENERIC_ZIP)).toEqual({ ok: false, reason: "unsupported_file_type" });
  });
  it("rejects a generic ZIP masquerading as DOCX (not an OOXML package)", () => {
    expect(inspectAsset("fake.docx", GENERIC_ZIP)).toEqual({ ok: false, reason: "invalid_file_signature" });
  });
  it("rejects an extension/content mismatch (.pdf that is actually PNG)", () => {
    expect(inspectAsset("fake.pdf", PNG)).toEqual({ ok: false, reason: "invalid_file_signature" });
  });
  it("rejects a .png that is actually a PDF", () => {
    expect(inspectAsset("fake.png", PDF)).toEqual({ ok: false, reason: "invalid_file_signature" });
  });
  it("rejects binary content claimed as text", () => {
    const binary = new Uint8Array([0x00, 0x01, 0x02, 0x00, 0xff, 0x00, 0x13]);
    expect(inspectAsset("notes.txt", binary)).toEqual({ ok: false, reason: "invalid_file_signature" });
  });
  it("rejects an empty file", () => {
    expect(inspectAsset("x.pdf", new Uint8Array(0))).toEqual({ ok: false, reason: "file_empty" });
  });
  it("rejects an oversized file before signature checks", () => {
    const big = new Uint8Array(MAX_ASSET_BYTES + 1);
    expect(inspectAsset("huge.pdf", big)).toEqual({ ok: false, reason: "file_too_large" });
  });
});

describe("inspectAsset — iOS generic MIME is irrelevant to the decision", () => {
  it("accepts a valid file regardless of MIME (decision is extension + signature)", () => {
    // the function ignores MIME entirely; a valid .pdf with any/empty MIME passes.
    expect(inspectAsset("Care.pdf", PDF).ok).toBe(true);
  });
});

describe("readiness projection", () => {
  it("pdf is preview + delivery ready; images preview but not delivery; office neither", () => {
    expect(previewSupported("pdf")).toBe(true);
    expect(participantDeliveryReady("pdf")).toBe(true);
    expect(previewSupported("image")).toBe(true);
    expect(participantDeliveryReady("image")).toBe(false);
    expect(previewSupported("document")).toBe(false);
    expect(participantDeliveryReady("spreadsheet")).toBe(false);
  });
});
