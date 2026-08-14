import { derivePdfPageCount, countPagesInPdfText, type PdfPageCountResult } from "@/domain/foundry/events/foundry-pdf-inspect";

/**
 * DEEP PDF PAGE COUNT — for the PDFs that hide their page tree (Slice 3.2R-R6).
 *
 * WHAT FORCED THIS. `SafetyToolkit_Huddles.pdf` is a four-page PDF 1.6 whose page tree lives
 * inside nine Flate-compressed object streams. The pure inspector scans the raw bytes for
 * `/Count n` and `/Type /Page`; neither appears, so it honestly reported `null` — exactly as its
 * own header always said it might. The defect was downstream, where publish turned that `null`
 * into `1` and would have told a learner a four-page document was fully read after page one.
 *
 * WHY NOT A PDF LIBRARY. `pdfjs-dist` is present, but only as a transitive dependency of
 * `react-pdf` — the learner's renderer. Promoting a browser-oriented renderer into the upload
 * path to read one integer means a new direct dependency, a large bundle on a Worker, and a
 * second definition of "how many pages does this have". The counting RULES already exist and are
 * already the authority; what was missing was a view of the bytes they could read.
 *
 * WHY NOT node:zlib. `DecompressionStream` is a Web Standard present in both Node and workerd,
 * so this file needs no runtime-specific import and no `nodejs_compat` assumption.
 *
 * BEST-EFFORT, STILL HONEST. If inflation yields nothing this returns `null` exactly as before.
 * Nothing here manufactures a count, and the caller must still treat `null` as unverified.
 */

/** Bounded so a malformed or hostile file cannot turn inspection into a long job. */
const MAX_STREAMS_INFLATED = 64;
const MAX_INFLATED_BYTES = 8 * 1024 * 1024;

async function inflate(bytes: Uint8Array, format: "deflate" | "deflate-raw"): Promise<string | null> {
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
    const buf = await new Response(stream).arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_INFLATED_BYTES) return null;
    return new TextDecoder("latin1").decode(buf);
  } catch {
    // A stream that is not Flate, or is damaged, simply contributes nothing.
    return null;
  }
}

/**
 * The page count, looking inside compressed object streams when the surface scan finds nothing.
 *
 * Returns the SAME shape as the pure inspector, so callers cannot tell — or need to tell — which
 * pass produced the answer. `method` reports `object_stream_count` when the deep pass was the one
 * that succeeded, so a future forensic can see which files needed it.
 */
export async function derivePdfPageCountDeep(bytes: Uint8Array): Promise<PdfPageCountResult> {
  const surface = derivePdfPageCount(bytes);
  if (surface.count !== null) return surface;

  const text = new TextDecoder("latin1").decode(bytes);
  let inflatedAll = "";
  let inflatedStreams = 0;

  /*
    Walk every `stream … endstream` and try to inflate it. PDF writers disagree about whether the
    keyword is followed by CRLF or LF, and about zlib headers vs raw deflate, so both are tried
    and failures are silent — a stream that is an image, a font or damaged is simply not a page
    tree, and skipping it is the correct outcome rather than an error.
  */
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && inflatedStreams < MAX_STREAMS_INFLATED) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endstream", start);
    if (end < 0) continue;
    /*
      TRIM THE TRAILING EOL. Writers put a CR, LF or CRLF between the compressed data and the
      `endstream` keyword. `node:zlib` tolerates that trailing byte; `DecompressionStream` does
      NOT — measured on this exact file, all 38 Flate streams failed with it and all 38 inflated
      without it. Silently dropping every stream would have made the deep pass useless while
      still looking like an honest "undeterminable".
    */
    let end2 = end;
    while (end2 > start && (bytes[end2 - 1] === 0x0a || bytes[end2 - 1] === 0x0d)) end2--;
    const slice = bytes.subarray(start, end2);
    if (slice.byteLength === 0) continue;
    const out = (await inflate(slice, "deflate")) ?? (await inflate(slice, "deflate-raw"));
    if (out === null) continue;
    inflatedStreams++;
    inflatedAll += out;
    if (inflatedAll.length > MAX_INFLATED_BYTES) break;
  }

  if (inflatedAll.length === 0) return surface;
  const deep = countPagesInPdfText(inflatedAll);
  if (deep.count === null) return surface;
  return { count: deep.count, method: "object_stream_count" };
}
