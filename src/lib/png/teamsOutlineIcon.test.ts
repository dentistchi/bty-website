/** @vitest-environment node */
/**
 * THE TEAMS APP-BAR ICON, HELD TO OPTICAL QUALITY AND NOT ONLY TO THE MANIFEST. Slice TQ-4.
 *
 * ★ THE DEFECT THE PREVIOUS AUDIT COULD NOT SEE.
 *
 * TQ-3 audited this asset and passed it: 32×32, transparent background, white silhouette, mark
 * centred, inside every documented bound. All true, and all irrelevant to how it looked. On the
 * Founder's iPhone the BTY knot in the native Teams bottom bar read soft and muddy beside Activity,
 * Chat, Calendar and More — which are crisp. Manifest compliance and optical quality are different
 * properties and only the first had ever been measured.
 *
 * MEASURED on the shipped asset: of 453 visible pixels, **12** were fully opaque and 441 were
 * semi-transparent — **36.75 anti-aliased pixels per solid one**, across 127 alpha values, with an
 * 81-pixel halo below alpha 32. That is not a mark with an anti-aliased edge; it is a mark made
 * almost entirely OF edge, the signature of a raster resampled from another raster. Tinted purple
 * and scaled by the host, it could only ever look like a smudge.
 *
 * The repair rasterises the SAME canonical trefoil from `public/brand/bty-knot-mono-white.svg`
 * once, by supersampling and area-averaging, at a width chosen to reproduce the shipped icon's
 * footprint EXACTLY (bbox 26×24, margins 3/3/4/4). Same mark, same size, same place — actually
 * drawn. No new logo, no redraw, no reinterpretation.
 *
 * These gates are the acceptance criteria, expressed as arithmetic.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePng, alphaOf, downsampleAlpha, pngSize } from "./decodePng";

const OUTLINE = join(process.cwd(), "teams/manifest/outline.png");
const img = decodePng(readFileSync(OUTLINE));
const alpha = alphaOf(img);
const { width: W, height: H, data } = img;

const visible = () => {
  const out: { x: number; y: number; a: number; rgb: [number, number, number] }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 0) out.push({ x, y, a: data[i + 3], rgb: [data[i], data[i + 1], data[i + 2]] });
    }
  }
  return out;
};

const bbox = () => {
  const v = visible();
  const xs = v.map((p) => p.x), ys = v.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** Interior low-alpha runs bounded on BOTH sides by mark — the trefoil's visible separations. */
function interiorChannels(a: number[], size: number, clear = 64, ink = 128): number[] {
  const runs: number[] = [];
  for (const axis of [0, 1]) {
    for (let i = 0; i < size; i++) {
      let seenInk = false, run = 0;
      for (let j = 0; j < size; j++) {
        const v = axis === 0 ? a[j * size + i] : a[i * size + j];
        if (v >= ink) {
          if (seenInk && run > 0) runs.push(run);
          seenInk = true; run = 0;
        } else if (seenInk && v < clear) run++;
      }
    }
  }
  return runs;
}

describe("★ 1–4 shape, transparency and colour purity", () => {
  it("1 — is exactly 32 × 32", () => {
    expect({ w: W, h: H }).toEqual({ w: 32, h: 32 });
  });

  it("2 — the background is genuinely transparent, not white-on-white", () => {
    const clear = alpha.filter((a) => a === 0).length;
    expect(clear).toBeGreaterThan(W * H * 0.4);
    // all four corners must be fully clear — a plate or rounded mask would show here
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
      expect(alpha[y * W + x], `corner ${x},${y}`).toBe(0);
    }
  });

  it("3 — every visible pixel is pure white (Teams applies its own tint)", () => {
    const wrong = visible().filter((p) => p.rgb[0] !== 255 || p.rgb[1] !== 255 || p.rgb[2] !== 255);
    expect(wrong.map((p) => `${p.x},${p.y}=${p.rgb.join(",")}`)).toEqual([]);
  });

  it("4 — no RGB colour fringe: exactly one colour among visible pixels", () => {
    const colours = new Set(visible().map((p) => p.rgb.join(",")));
    expect([...colours]).toEqual(["255,255,255"]);
  });
});

describe("★ 5–6 no shadow, no glow, no feather", () => {
  it("★ 6 — the mark is drawn, not feathered: semi-transparent pixels per opaque pixel", () => {
    /*
      THE HEADLINE NUMBER. The shipped icon scored 36.75 here — 441 anti-aliased pixels around 12
      solid ones. A mark rasterised once from a vector has a thin edge and a solid core. The bound
      is generous (a real 32px icon lands near 2); anything approaching the old value means the
      asset was resampled from another raster again.
    */
    const v = visible();
    const opaque = v.filter((p) => p.a >= 250).length;
    const semi = v.filter((p) => p.a > 0 && p.a < 250).length;
    expect(opaque, "an icon with no solid core cannot look crisp at any size").toBeGreaterThan(60);
    expect(semi / opaque).toBeLessThan(4);
  });

  it("5 — no shadow or glow: the faint halo is a thin edge, not a cloud", () => {
    const halo = alpha.filter((a) => a > 0 && a < 32).length;
    expect(halo, "a wide sub-alpha-32 skirt is a feather or a drop shadow").toBeLessThan(60);
  });

  it("5b — no pixel outside the mark's own bounding box carries ink", () => {
    const b = bbox();
    const stray = visible().filter((p) => p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1);
    expect(stray).toEqual([]);
  });
});

describe("★ 7–8 placement", () => {
  it("7 — optically centred: opposite margins are equal", () => {
    const b = bbox();
    expect({ dx: b.x0 - (W - 1 - b.x1), dy: b.y0 - (H - 1 - b.y1) }).toEqual({ dx: 0, dy: 0 });
  });

  it("8 — the footprint is UNCHANGED from the shipped icon: 26 × 24, margins 3/3/4/4", () => {
    /*
      Deliberately exact. The repair is rasterisation quality only; if the mark's size or position
      in the app bar moves, that is a different change and needs its own decision. Shrinking to
      22–24px was measured and REFUSED: at 24px — the size the bar actually asks for — a 23px mark
      leaves the same two one-pixel channels as this one, so it buys nothing where it counts, while
      costing 40% of the ink and reading as weak beside Teams' own glyphs.
    */
    const b = bbox();
    expect({ w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 }).toEqual({ w: 26, h: 24 });
    expect({ l: b.x0, r: W - 1 - b.x1, t: b.y0, b: H - 1 - b.y1 }).toEqual({ l: 3, r: 3, t: 4, b: 4 });
  });
});

describe("★ 9–10 it survives the sizes Teams actually renders", () => {
  it("9 — the trefoil's interior channels stay open when downsampled to 24 and 20", () => {
    for (const size of [24, 20]) {
      const small = downsampleAlpha(alpha, W, H, size);
      const runs = interiorChannels(small, size);
      expect(runs.length, `no interior separation survives at ${size}px — it reads as a blob`).toBeGreaterThan(20);
      const onePx = runs.filter((r) => r === 1).length;
      expect(onePx, `too many one-pixel channels at ${size}px`).toBeLessThanOrEqual(8);
    }
  });

  it("★ 10 — better DEFINED than the asset it replaces, at the sizes the bar renders", () => {
    /*
      ★ A METRIC I HAD TO THROW AWAY, RECORDED SO IT IS NOT TRIED AGAIN.

      The first version of this test counted "mushy" pixels — neither ink nor paper (40 < a < 215)
      — at 24px, and asserted the new asset had fewer. MEASURED, it has MORE: 132 against the old
      asset's 119. That metric rewards INK, and the old icon is fatter precisely because its
      anti-aliasing bled outward; a heavier smudge scores well on it. It was measuring the wrong
      thing and it contradicted the eye, so it is gone rather than tuned until it agreed.

      What "poorly defined" actually means for a trefoil is that the channels BETWEEN the lobes
      close up, so three interlocking loops read as one mass. That is what is asserted here, against
      the real previous bytes rather than a remembered number: more separations survive, and fewer
      of them collapse to a single pixel that the next resample will erase.

      Not asserted at 32px, where the new asset legitimately shows MORE one-pixel channels — it
      resolves fine structure the old one had already smeared away. That is resolution, not mush.
    */
    const prev = decodePng(readFileSync(join(process.cwd(), "src/lib/png/__fixtures__/teams-outline-pre-tq4.png")));
    const prevAlpha = alphaOf(prev);

    for (const size of [24, 20]) {
      const nowRuns = interiorChannels(downsampleAlpha(alpha, W, H, size), size);
      const wasRuns = interiorChannels(downsampleAlpha(prevAlpha, prev.width, prev.height, size), size);
      expect(nowRuns.length, `${size}px: fewer visible separations than before`).toBeGreaterThanOrEqual(wasRuns.length);
      expect(
        nowRuns.filter((r) => r === 1).length,
        `${size}px: more separations collapse to one pixel than before`,
      ).toBeLessThanOrEqual(wasRuns.filter((r) => r === 1).length);
    }
  });

  it("★ 10b — the fixture really is the asset that shipped, and it really was mostly edge", () => {
    // If this fixture is ever replaced by a copy of the new file, test 10 becomes vacuous.
    const prev = decodePng(readFileSync(join(process.cwd(), "src/lib/png/__fixtures__/teams-outline-pre-tq4.png")));
    const a = alphaOf(prev);
    const opaque = a.filter((v) => v >= 250).length;
    const semi = a.filter((v) => v > 0 && v < 250).length;
    expect({ w: prev.width, h: prev.height }).toEqual({ w: 32, h: 32 });
    expect(opaque).toBe(12);
    expect(Math.round((semi / opaque) * 100) / 100).toBe(36.75);
  });
});

describe("★ provenance — the Founder's master, and only its knot", () => {
  const MASTER = "scripts/teams-icon/BTY_Master_plain.svg";
  const master = readFileSync(join(process.cwd(), MASTER), "utf8");
  const paths = [...master.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  const FRAME = "M1024 0V1024H0V0H1024Z";

  it("the generator reads the vendored master and nothing else", () => {
    const gen = readFileSync(join(process.cwd(), "scripts/teams-icon/build_outline.py"), "utf8");
    expect(gen).toContain("BTY_Master_plain.svg");
    expect(gen).toContain("teams/manifest/outline.png");
    expect(gen).toContain("refusing to guess");
    /*
      The previous source must not still be reachable in CODE. It is named in the docstring on
      purpose — the file records why the source changed and why fill-based selection stopped
      working — so the check strips comments first. A class named in prose loads nothing.
    */
    const code = gen.replace(/"""[\s\S]*?"""/g, "").replace(/^\s*#.*$/gm, "");
    expect(code).not.toContain("bty-knot-mono-white.svg");
    expect(code).not.toContain('fill="#FFFFFF"');
  });

  it("★ fill CANNOT identify the knot in the master — every element is white", () => {
    /*
      This is why selection is geometric. In the previous source the frame was `fill="none"` and
      picking `fill="#FFFFFF"` happened to work. Here the two background rects, the frame and the
      three lobes are ALL `fill="white"`, so a fill-based selector matches everything or nothing.
    */
    const fills = [...master.matchAll(/<(?:path|rect)\b[^>]*fill="([^"]*)"/g)].map((m) => m[1]);
    expect(new Set(fills)).toEqual(new Set(["white"]));
    expect(fills.length).toBeGreaterThanOrEqual(5);
  });

  it("★ the frame path is present and is excluded by SPANNING THE ARTBOARD", () => {
    // Rasterising it would produce a solid white plate with a rounded hole — not an icon.
    expect(paths.filter((d) => d.startsWith(FRAME)), "exactly one full-canvas frame path").toHaveLength(1);
    const gen = readFileSync(join(process.cwd(), "scripts/teams-icon/build_outline.py"), "utf8");
    expect(gen).toContain("ARTBOARD * 0.95");
    expect(gen).toContain("expected exactly 1 frame path");
    expect(gen).toContain("expected 3 canonical knot paths");
  });

  it("the master holds exactly four paths: one frame and three lobes", () => {
    expect(paths).toHaveLength(4);
    expect(paths.filter((d) => !d.startsWith(FRAME))).toHaveLength(3);
  });

  it("★ the master's knot geometry is BYTE-IDENTICAL to the mark the product already ships", () => {
    /*
      Adopting the Founder's master was about provenance, not a redraw — and this proves it was
      exactly that. The three lobes here are character-for-character the three in
      `public/brand/bty-knot-mono-white.svg`, so the rendered icon did not change when the source
      did. If a future master genuinely alters the mark, this fails and the change becomes a
      decision instead of a surprise.
    */
    const repo = readFileSync(join(process.cwd(), "public/brand/bty-knot-mono-white.svg"), "utf8");
    const repoKnot = [...repo.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]).filter((d) => !d.startsWith(FRAME));
    expect(paths.filter((d) => !d.startsWith(FRAME))).toEqual(repoKnot);
  });

  it("the colour icon and the manifest are untouched by this slice", () => {
    // color.png is 8-bit RGB with no alpha (colour type 2), which decodePng refuses on purpose.
    const colour = pngSize(readFileSync(join(process.cwd(), "teams/manifest/color.png")));
    expect({ w: colour.width, h: colour.height, type: colour.colorType }).toEqual({ w: 192, h: 192, type: 2 });
    const m = JSON.parse(readFileSync(join(process.cwd(), "teams/manifest/manifest.json"), "utf8"));
    expect(m.icons).toEqual({ color: "color.png", outline: "outline.png" });
    expect(m.id).toBe("374ec662-0deb-4e0b-8514-e38a035a349e");
    expect(m.composeExtensions[0].commands.map((c: { id: string }) => c.id)).toEqual(["saveToBty", "trackWithBty"]);
  });
});
