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

export type CaptureFailure = "permission_denied" | "cancelled" | "unsupported" | "no_audio" | "failed";
export class CaptureError extends Error {
  readonly name = "CaptureError";
  constructor(readonly kind: CaptureFailure) {
    super(kind);
  }
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

/** Teams mobile: open Teams' recorder for one clip and return it as a Blob. */
export async function recordWithTeams(maxMinutes = 1): Promise<Blob> {
  const { media } = await import("@microsoft/teams-js");
  const attachments = await new Promise<InstanceType<typeof media.Media>[]>((resolve, reject) => {
    media.selectMedia({ mediaType: media.MediaType.Audio, maxMediaCount: 1, audioProps: { maxDuration: maxMinutes } }, (error, files) => {
      if (error) reject(new CaptureError(teamsErrorKind(error.errorCode)));
      else resolve(files ?? []);
    });
  });
  const clip = attachments[0];
  if (!clip) throw new CaptureError("cancelled");
  return new Promise<Blob>((resolve, reject) => {
    clip.getMedia((error, blob) => {
      if (error) reject(new CaptureError(teamsErrorKind(error.errorCode)));
      else if (!blob || blob.size === 0) reject(new CaptureError("no_audio"));
      else resolve(blob.type ? blob : new Blob([blob], { type: clip.mimeType || "audio/mp4" }));
    });
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
      throw new CaptureError(browserErrorKind((e as { name?: string })?.name));
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
    if (blob.size < 1000) throw new CaptureError("no_audio");
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
