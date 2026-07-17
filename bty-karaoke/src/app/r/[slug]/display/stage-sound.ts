'use client';

// Celebration audio for the Living Stage — SYNTHESIZED with the Web Audio API. No
// audio file ships in the repo, no external provider, no network, no license: the
// applause is generated in-code as shaped filtered noise. Design constraints:
//   • default OFF — nothing plays until the user taps the Sound toggle (that tap is
//     the user gesture that unlocks the AudioContext, honoring iOS Safari autoplay).
//   • soft: a low master gain, band-passed so it never spikes the room's volume.
//   • once per completion; never blocks the UI; a failure is swallowed (no-op).
//   • no rAF loop, no asset decode — one short buffer per applause, source
//     auto-stops and is GC'd.

export interface StageSound {
  enabled: boolean;
  /** MUST be called from a user gesture; creates/resumes the context. */
  enable(): void;
  disable(): void;
  /** Soft applause — no-op when disabled or unsupported; never throws. */
  applause(): void;
}

type Ctor = typeof AudioContext;

function getCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

// Build ~1.6s of soft crowd applause: many short exponential-decay noise "claps"
// summed and normalized low. Cached per context.
function buildApplause(ctx: AudioContext): AudioBuffer {
  const dur = 1.6;
  const sr = ctx.sampleRate;
  const n = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const claps = 150;
  for (let c = 0; c < claps; c++) {
    const start = Math.floor(Math.random() * n * 0.9);
    const len = Math.max(1, Math.floor(sr * 0.02 * (0.5 + Math.random())));
    const amp = 0.3 + Math.random() * 0.7;
    for (let i = 0; i < len && start + i < n; i++) {
      const env = Math.exp(-i / (len * 0.3));
      d[start + i] += (Math.random() * 2 - 1) * env * amp;
    }
  }
  // Normalize, then apply a gentle overall fade in / out so it swells and settles.
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(d[i]));
  const norm = max > 0 ? 0.5 / max : 0;
  const fin = Math.floor(sr * 0.2);
  const fout = Math.floor(sr * 0.45);
  for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < fin) g = i / fin;
    else if (i > n - fout) g = (n - i) / fout;
    d[i] = d[i] * norm * g;
  }
  return buf;
}

export function createStageSound(): StageSound {
  let ctx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;

  const sound: StageSound = {
    enabled: false,
    enable() {
      try {
        const Ctor = getCtor();
        if (!Ctor) return; // unsupported → toggle still flips, applause no-ops
        if (!ctx) ctx = new Ctor();
        void ctx.resume?.();
        if (!buffer && ctx) buffer = buildApplause(ctx);
        sound.enabled = true;
      } catch {
        sound.enabled = true; // remember the preference even if audio is unavailable
      }
    },
    disable() {
      sound.enabled = false;
    },
    applause() {
      if (!sound.enabled || !ctx || !buffer) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1800;
        band.Q.value = 0.7;
        const gain = ctx.createGain();
        gain.gain.value = 0.18; // soft — well below any music
        src.connect(band).connect(gain).connect(ctx.destination);
        src.start();
        src.onended = () => {
          try {
            src.disconnect();
            band.disconnect();
            gain.disconnect();
          } catch {
            /* already torn down */
          }
        };
      } catch {
        /* audio failure never affects the UI or the queue */
      }
    },
  };
  return sound;
}
