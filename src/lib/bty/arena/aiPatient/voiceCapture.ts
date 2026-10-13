/**
 * AI PATIENT — capturing one spoken turn on whatever client the learner is using. CLIENT ONLY.
 *
 * Two real transports, chosen by what the host actually supports (no simulated speech anywhere):
 *
 *  - Teams MOBILE (iOS / iPadOS / Android): Microsoft documents microphone access in a tab through
 *    `media.selectMedia({ mediaType: Audio })` — Teams' own recorder — and `getMedia()` for the clip.
 *    HTML5 getUserMedia is not the documented path there.
 *  - Teams DESKTOP / WEB and ordinary browsers: HTML5 `getUserMedia` + `MediaRecorder`.
 *
 * Both need the app manifest to declare `devicePermissions: ["media"]`, and the page to allow
 * `microphone=(self)`. When neither path works the screen stays in typing mode and says why.
 */

export type VoiceMode = "teams_native" | "browser_recorder" | "none";

/**
 * `handoff_failed` (Issue #64): the recording WAS made — Teams' recorder opened and the learner pressed
 * Save — but the clip could not be handed to BTY. It must never be reported as "the microphone didn't
 * start", which sent the Founder looking at permissions when the microphone had worked.
 */
export type CaptureFailure = "permission_denied" | "cancelled" | "unsupported" | "no_audio" | "handoff_failed" | "failed";

/** Where a capture failed. Teams stages are in the order they happen after the learner taps record. */
export type CaptureStage =
  | "select_media_call" // calling Teams' recorder threw before it could open
  | "select_media_callback" // Teams' recorder returned (after Save or cancel) with an error or nothing
  | "get_media_invocation" // calling getMedia() on the returned clip threw
  | "get_media_callback" // getMedia() answered with an SDK error
  | "blob_validation" // a clip arrived but held no usable audio
  | "browser_recorder"; // desktop/web getUserMedia/MediaRecorder path

/**
 * What the Founder sees, and only this: stages, SDK codes, the attachment's declared shape and sizes.
 * Never audio, never a transcript, never content or preview data, never an identity or a credential.
 */
export type CaptureDiagnostic = {
  stage: CaptureStage;
  sdkErrorCode?: number;
  errorName?: string;
  attachmentCount?: number;
  format?: string;
  mimeType?: string;
  hasContent?: boolean;
  hasPreview?: boolean;
  blobSize?: number;
};

export class CaptureError extends Error {
  readonly name = "CaptureError";
  constructor(
    readonly kind: CaptureFailure,
    readonly diagnostic?: CaptureDiagnostic,
  ) {
    super(kind);
  }
}

const SAFE_TOKEN = /^[A-Za-z0-9_.+/-]{1,40}$/;
const safe = (v: unknown): string | undefined => (typeof v === "string" && SAFE_TOKEN.test(v) ? v : undefined);

/** One short, copyable line. Every field is a code, a declared type, a boolean or a size. */
export function formatCaptureDiagnostic(d: CaptureDiagnostic): string {
  const parts = [`AIP-VOICE ${d.stage}`];
  if (typeof d.sdkErrorCode === "number" && Number.isFinite(d.sdkErrorCode)) parts.push(`code=${Math.trunc(d.sdkErrorCode)}`);
  const name = safe(d.errorName);
  if (name) parts.push(`err=${name}`);
  if (typeof d.attachmentCount === "number") parts.push(`n=${d.attachmentCount}`);
  const format = safe(d.format);
  if (format) parts.push(`fmt=${format}`);
  const mime = safe(d.mimeType);
  if (mime) parts.push(`mime=${mime}`);
  if (typeof d.hasContent === "boolean") parts.push(`content=${d.hasContent ? "y" : "n"}`);
  if (typeof d.hasPreview === "boolean") parts.push(`preview=${d.hasPreview ? "y" : "n"}`);
  if (typeof d.blobSize === "number") parts.push(`bytes=${d.blobSize}`);
  return parts.join(" ");
}

const MOBILE_HOSTS = new Set(["ios", "ipados", "android"]);

/** Which transport this client can use. Never throws. */
export async function detectVoiceMode(): Promise<VoiceMode> {
  if (typeof window === "undefined") return "none";
  try {
    const { app } = await import("@microsoft/teams-js");
    if (app.isInitialized()) {
      const ctx = await app.getContext();
      if (MOBILE_HOSTS.has(String(ctx.app.host.clientType))) return "teams_native";
    }
  } catch {
    // Not inside Teams, or the SDK is unavailable: fall through to the browser recorder.
  }
  const hasRecorder = typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  return hasRecorder ? "browser_recorder" : "none";
}

/** The attachment fields BTY reads. Typed loosely: a host may return a plain object, not a `Media`. */
type TeamsClip = {
  format?: unknown;
  mimeType?: unknown;
  content?: unknown;
  preview?: unknown;
  getMedia?: (cb: (error: { errorCode?: number } | null | undefined, blob: Blob) => void) => void;
};

/** Largest base64 payload decoded in the browser: a 45-second clip is far below this. */
const MAX_BASE64_CHARS = 8_000_000;

/** Decode base64 audio carried on the attachment itself. Returns null for anything that is not base64 audio data. */
export function decodeBase64Clip(data: unknown, mimeType: string): Blob | null {
  if (typeof data !== "string") return null;
  const b64 = data.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!b64 || b64.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(b64)) return null;
  try {
    const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

/** Codes Teams uses for "the user/host cannot do this" — reported as such, at any stage. */
function stageKind(code: number | undefined, afterSave: boolean): CaptureFailure {
  const k = teamsErrorKind(code);
  return k === "failed" && afterSave ? "handoff_failed" : k;
}

/**
 * Teams mobile: open Teams' recorder for one clip and return it as a Blob.
 *
 * After Save, Teams returns the clip as an attachment. TeamsJS 2.55 `Media.getMedia()` validates
 * `mimeType`, `format` and `content` first and answers 4000 INVALID_ARGUMENTS with an empty Blob unless
 * `format === "id"` (internal/mediaUtil.js `validateGetMediaInputs`). An attachment that carries its
 * audio inline (`format: "base64"`, as Microsoft's audio sample reads it from the attachment) can never
 * pass that check, so it is decoded here instead. A `format: "id"` attachment still goes through
 * getMedia() exactly as before. Every failure names its stage (Issue #64).
 */
export async function recordWithTeams(maxMinutes = 1): Promise<Blob> {
  let media: typeof import("@microsoft/teams-js").media;
  try {
    ({ media } = await import("@microsoft/teams-js"));
  } catch (e) {
    throw new CaptureError("unsupported", { stage: "select_media_call", errorName: (e as Error)?.name });
  }

  const attachments = await new Promise<TeamsClip[]>((resolve, reject) => {
    try {
      media.selectMedia({ mediaType: media.MediaType.Audio, maxMediaCount: 1, audioProps: { maxDuration: maxMinutes } }, (error, files) => {
        const n = Array.isArray(files) ? files.length : 0;
        if (error) reject(new CaptureError(stageKind(error.errorCode, true), { stage: "select_media_callback", sdkErrorCode: error.errorCode, attachmentCount: n }));
        else resolve(Array.isArray(files) ? (files as unknown as TeamsClip[]) : []);
      });
    } catch (e) {
      reject(new CaptureError("failed", { stage: "select_media_call", errorName: (e as Error)?.name }));
    }
  });

  const clip = attachments[0];
  if (!clip) throw new CaptureError("cancelled", { stage: "select_media_callback", attachmentCount: 0 });

  const mimeType = typeof clip.mimeType === "string" && clip.mimeType ? clip.mimeType : "audio/mp4";
  const shape: CaptureDiagnostic = {
    stage: "blob_validation",
    attachmentCount: attachments.length,
    format: typeof clip.format === "string" ? clip.format : undefined,
    mimeType: typeof clip.mimeType === "string" ? clip.mimeType : undefined,
    hasContent: typeof clip.content === "string" && clip.content.length > 0,
    hasPreview: typeof clip.preview === "string" && clip.preview.length > 0,
  };

  // Inline audio: getMedia() would refuse it (format must be "id"), so read it from the attachment.
  if (clip.format !== "id") {
    const blob = decodeBase64Clip(clip.content, mimeType) ?? decodeBase64Clip(clip.preview, mimeType);
    if (!blob || blob.size === 0) throw new CaptureError("no_audio", { ...shape, blobSize: blob?.size ?? 0 });
    return blob;
  }

  return new Promise<Blob>((resolve, reject) => {
    try {
      if (typeof clip.getMedia !== "function") throw new TypeError("getMedia unavailable");
      clip.getMedia((error, blob) => {
        if (error) reject(new CaptureError(stageKind(error.errorCode, true), { ...shape, stage: "get_media_callback", sdkErrorCode: error.errorCode }));
        else if (!blob || blob.size === 0) reject(new CaptureError("no_audio", { ...shape, blobSize: blob?.size ?? 0 }));
        else resolve(blob.type ? blob : new Blob([blob], { type: mimeType }));
      });
    } catch (e) {
      reject(new CaptureError("handoff_failed", { ...shape, stage: "get_media_invocation", errorName: (e as Error)?.name }));
    }
  });
}

/** Teams SDK error codes (documented: 1000 permission denied, 8000 user abort, 100/9000 unsupported). */
export function teamsErrorKind(code: number | undefined): CaptureFailure {
  if (code === 1000) return "permission_denied";
  if (code === 8000) return "cancelled";
  if (code === 100 || code === 9000 || code === 3000) return "unsupported";
  return "failed";
}

/**
 * getUserMedia failure names → what the learner can do about it. A denied permission and a policy
 * block are told how to allow the microphone; an unsupported host goes straight to typing; anything
 * else (device busy, transient) may be retried.
 */
export function browserErrorKind(name: string | undefined): CaptureFailure {
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "permission_denied";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no_audio";
  return "failed";
}

/** The first MIME type this browser's MediaRecorder can produce, in order of provider support. */
export function pickRecorderMime(isSupported: (t: string) => boolean): string {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    try {
      if (isSupported(t)) return t;
    } catch {
      /* keep looking */
    }
  }
  return "";
}

/**
 * Desktop/web recorder for one turn. `start()` asks for the microphone; `stop()` returns the clip.
 * Recording stops itself at `maxSeconds`, and every path releases the microphone.
 */
export class BrowserTurnRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private done: Promise<Blob> | null = null;

  constructor(private readonly maxSeconds: number, private readonly onAutoStop?: () => void) {}

  get recording(): boolean {
    return this.recorder?.state === "recording";
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      throw new CaptureError(browserErrorKind(name), { stage: "browser_recorder", errorName: name });
    }
    const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    const recorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    this.recorder = recorder;
    this.chunks = [];
    this.done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
      };
      recorder.onstop = () => {
        this.release();
        resolve(new Blob(this.chunks, { type: recorder.mimeType || mime || "audio/webm" }));
      };
    });
    recorder.start();
    this.timer = setTimeout(() => {
      if (this.recording) {
        recorder.stop();
        this.onAutoStop?.();
      }
    }, this.maxSeconds * 1000);
  }

  /** Stop and return the clip. A clip with no sound in it is refused, not sent. */
  async stop(): Promise<Blob> {
    if (!this.recorder || !this.done) throw new CaptureError("failed");
    if (this.recording) this.recorder.stop();
    const blob = await this.done;
    if (blob.size < 1000) throw new CaptureError("no_audio", { stage: "browser_recorder", blobSize: blob.size });
    return blob;
  }

  /** Abandon a recording (navigation, End, error). */
  cancel(): void {
    try {
      if (this.recording) this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.release();
  }

  private release(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
