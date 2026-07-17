'use client';

// Celebration applause for the Living Stage — plays a REAL recorded-applause asset
// (an in-repo file under /public/audio), NOT synthesized noise. V1.5's Web-Audio
// synthesis sounded mechanical and is removed. Design constraints:
//   • default OFF — nothing plays until the user taps the Sound toggle. That tap is
//     the user gesture that unlocks HTMLAudioElement playback on iOS Safari; enable()
//     plays a short low-volume preview to unlock AND confirm the asset is present.
//   • once per completion; a rapid next song fades it out fast so it never lingers.
//   • soft but audible; a single reused <audio> element (never one per poll).
//   • fully fail-safe: a missing asset / rejected play() is swallowed — audio never
//     breaks the UI or the queue. `available` reflects whether the asset loaded.
//
// AUDIO ASSET: /public/audio/applause.mp3 — see /public/audio/README.md for the
// required source/license. When absent, the toggle still works and simply stays
// silent (available=false); dropping the licensed file in needs no code change.

export const APPLAUSE_SRC = '/audio/applause.mp3';

export interface StageSound {
  enabled: boolean;
  /** true once the applause asset has loaded and is playable. */
  available: boolean;
  /** MUST be called from a user gesture: unlocks audio + plays a short preview. */
  enable(): void;
  disable(): void;
  /** Play the applause once (soft) — no-op when disabled/unavailable; never throws. */
  applause(): void;
  /** Fade out + stop quickly (e.g. a new song started). */
  stop(): void;
}

export function createStageSound(src: string = APPLAUSE_SRC): StageSound {
  let el: HTMLAudioElement | null = null;
  let fade: number | null = null;
  const VOL = 0.55;

  function ensure(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!el) {
      try {
        el = new Audio(src);
        el.preload = 'auto';
        el.volume = VOL;
        el.addEventListener('canplaythrough', () => { sound.available = true; }, { once: true });
        el.addEventListener('error', () => { sound.available = false; });
        el.load();
      } catch {
        el = null;
      }
    }
    return el;
  }

  function clearFade() {
    if (fade != null) { window.clearInterval(fade); fade = null; }
  }

  const sound: StageSound = {
    enabled: false,
    available: false,
    enable() {
      sound.enabled = true;
      const a = ensure();
      if (!a) return;
      // Preview at a low volume: unlocks iOS playback within this gesture AND lets the
      // user hear the real applause once. Stopped after ~0.6s so it isn't intrusive.
      try {
        a.currentTime = 0;
        a.volume = 0.32;
        const p = a.play();
        if (p && typeof p.then === 'function') p.then(() => { sound.available = true; }).catch(() => undefined);
        window.setTimeout(() => sound.stop(), 600);
      } catch {
        /* unlock/preview failed — remembered preference stands, applause no-ops */
      }
    },
    disable() {
      sound.enabled = false;
      sound.stop();
    },
    applause() {
      if (!sound.enabled) return;
      const a = ensure();
      if (!a) return;
      try {
        clearFade();
        a.pause();
        a.currentTime = 0;
        a.volume = VOL;
        const p = a.play();
        if (p && typeof p.then === 'function') p.then(() => { sound.available = true; }).catch(() => undefined);
      } catch {
        /* audio failure never affects the UI or the queue */
      }
    },
    stop() {
      const a = el;
      if (!a) return;
      clearFade();
      try {
        // Quick 400ms fade so a cut-off never sounds abrupt when the next song starts.
        const step = a.volume / 8;
        fade = window.setInterval(() => {
          try {
            if (!a || a.volume <= step) {
              a?.pause();
              if (a) a.volume = VOL;
              clearFade();
            } else {
              a.volume = Math.max(0, a.volume - step);
            }
          } catch {
            clearFade();
          }
        }, 50);
      } catch {
        try { a.pause(); } catch { /* ignore */ }
      }
    },
  };
  return sound;
}
