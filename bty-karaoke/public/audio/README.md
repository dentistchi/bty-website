# Celebration audio asset — AUDIO ASSET REQUIRED

The Living Stage completion celebration plays a **real recorded applause** file
(V1.5.1 removed the mechanical Web-Audio synthesis). The Display loads it from:

    /audio/applause.mp3      →  public/audio/applause.mp3

## Drop-in instructions (no code change needed)

Place a licensed file at `public/audio/applause.mp3`. The player
(`src/app/r/[slug]/display/stage-sound.ts`) already references this path, is default
OFF, unlocks on the Sound toggle tap, plays once per completion, fades out on a rapid
next song, and is fully fail-safe (a missing file simply stays silent).

## Required characteristics

- Real applause from **several people**, warm indoor room feel.
- **1.5–2.5 s**, with a short fade-out so it never cuts abruptly.
- No whistles, no shouting, no stadium-scale roar.
- Mono or light stereo; small mobile-friendly size (**~100–250 KB**).
- Safari-compatible compressed format (`.mp3` preferred; `.m4a`/`.ogg` acceptable —
  update `APPLAUSE_SRC` if not `.mp3`).

## Allowed sources (license MUST be clear)

- A recording you made yourself, or
- CC0 / public-domain audio, or
- Royalty-free audio licensed for this project.

Do **not** use audio of uncertain license, and do **not** hot-link an external URL.

## Record the provenance here when you add the file

| field | value |
|---|---|
| filename | `applause.mp3` |
| source / how recorded | _(fill in)_ |
| license | _(fill in — CC0 / self-recorded / royalty-free + link)_ |
| edited? | _(e.g. trimmed to 2.0s, added 300ms fade-out)_ |

> This slice ships the player + toggle + celebration visuals. The applause **asset
> itself is not included** — it must be provided as above. Until then the toggle is
> silent (honest, no error). Status: **AUDIO ASSET REQUIRED**.
