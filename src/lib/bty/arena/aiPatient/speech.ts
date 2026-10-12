/**
 * AI PATIENT — speech in and out, through BTY's server only.
 *
 * The browser never holds a provider credential, not even a short-lived one: it sends a recorded clip
 * to BTY, and BTY returns text and audio. Audio is forwarded to the provider for this one request and
 * not stored by BTY.
 *
 * Speech needs the OpenAI audio endpoints, so it uses OPENAI_API_KEY directly rather than the
 * chat-compatible LLM_BASE_URL switch (a local chat model has no audio endpoint).
 */

export const SPEECH_MODELS = {
  transcribe: process.env.AI_PATIENT_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
  speak: process.env.AI_PATIENT_TTS_MODEL ?? "gpt-4o-mini-tts",
  voice: process.env.AI_PATIENT_TTS_VOICE ?? "coral",
};

export class SpeechUnavailableError extends Error {
  readonly name = "SpeechUnavailableError";
}
export class SpeechProviderError extends Error {
  readonly name = "SpeechProviderError";
  constructor(readonly status: number) {
    super(`speech provider error ${status}`);
  }
}

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY ?? (process.env.LLM_BASE_URL ? "" : process.env.LLM_API_KEY) ?? "";
  if (!k.trim()) throw new SpeechUnavailableError("speech is not configured");
  return k;
}

export const isSpeechAvailable = (): boolean => {
  try {
    apiKey();
    return true;
  } catch {
    return false;
  }
};

/** Extension the provider recognises for a recorded clip's MIME type. */
export function audioFileName(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "clip.webm";
  if (m.includes("ogg")) return "clip.ogg";
  if (m.includes("wav")) return "clip.wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "clip.mp3";
  if (m.includes("aac")) return "clip.aac";
  return "clip.m4a"; // mp4 / x-m4a / unknown mobile recorders
}

const TRANSCRIBE_PROMPT =
  "A Treatment Coordinator at a dental practice is speaking with a patient about a recommended crown, the cost estimate, insurance, and next steps.";

export async function transcribeClip(audio: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("file", audio, audioFileName(audio.type));
  form.append("model", SPEECH_MODELS.transcribe);
  form.append("language", "en");
  form.append("prompt", TRANSCRIBE_PROMPT);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
    signal,
  });
  if (!res.ok) throw new SpeechProviderError(res.status);
  const json = (await res.json()) as { text?: unknown };
  return typeof json.text === "string" ? json.text : "";
}

const VOICE_DIRECTION =
  "Speak as an ordinary adult dental patient in a calm office: natural, a little hesitant and thoughtful, conversational pace. Not dramatic.";

export async function synthesizePatientLine(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: SPEECH_MODELS.speak, voice: SPEECH_MODELS.voice, input: text, instructions: VOICE_DIRECTION, response_format: "mp3" }),
    signal,
  });
  if (!res.ok) throw new SpeechProviderError(res.status);
  return res.arrayBuffer();
}
