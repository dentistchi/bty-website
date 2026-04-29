#!/usr/bin/env node
// scripts/merge-human-model.mjs
//
// Merges human_model (including reflection_bank) from arena_human_model.json
// into arena_program.json. Server-only calibration; do not expose to UI.
//
// Modes:
//   tracks (default) - Only program.tracks[].levels[]; uses .level as id. Safe and minimal.
//   recursive       - Finds levels anywhere (map keys or array items with id/level/etc). Report + strict + dry-run.
//
// Usage (from bty-app):
//   node scripts/merge-human-model.mjs
//   node scripts/merge-human-model.mjs --out ./data/arena_program.merged.json
//   node scripts/merge-human-model.mjs --mode recursive --strict true --dry false
//
// Options:
//   --program  path to program JSON (default: src/lib/bty/arena/arena_program.json)
//   --human    path to human model JSON (default: src/lib/bty/arena/arena_human_model.json)
//   --out      output path (default: src/lib/bty/arena/arena_program.merged.json)
//   --mode     tracks | recursive (default: tracks)
//   --strict   true|false - fail if merge incomplete (default: true)
//   --dry      true|false - no write, only report (default: false)
//   --levels   comma-separated level ids for recursive (default: from human model keys)

import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--") && a.length > 2) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const val = next != null && !String(next).startsWith("--") ? next : undefined;
      if (val !== undefined) {
        args[key] = val;
        i++;
      }
    }
  }
  return args;
}

function toBool(v, def = false) {
  if (v === undefined) return def;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function readJson(p) {
  const resolved = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return JSON.parse(fs.readFileSync(resolved, "utf-8"));
}

function writeJson(p, obj) {
  const resolved = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(obj, null, 2), "utf-8");
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

// --- Mode: tracks (explicit structure for this repo) ---
function mergeTracks(program, humanModel) {
  const levelsMap = humanModel?.levels ?? {};
  const version = humanModel?.version ?? "1.0.0";
  const levelIds = Object.keys(levelsMap);

  if (!program.tracks || !Array.isArray(program.tracks)) {
    return { merged: program, report: { injectedByLevel: {}, missing: levelIds, notInjected: levelIds } };
  }

  const injectedByLevel = {};
  for (const id of levelIds) injectedByLevel[id] = 0;

  const tracks = program.tracks.map((track) => {
    const levels = Array.isArray(track.levels)
      ? track.levels.map((lvl) => {
          const id = lvl.level ?? lvl.id ?? lvl.levelId ?? lvl.key;
          if (!id || !levelsMap[id]) return lvl;
          injectedByLevel[id] = (injectedByLevel[id] ?? 0) + 1;
          return {
            ...lvl,
            human_model: levelsMap[id],
            human_model_version: version,
          };
        })
      : track.levels;
    return { ...track, levels };
  });

  const merged = { ...program, tracks };
  const missing = levelIds.filter((id) => !(id in levelsMap)); // always [] if we used levelIds from human
  const notInjected = levelIds.filter((id) => (injectedByLevel[id] ?? 0) === 0);
  return { merged, report: { injectedByLevel, missing, notInjected, humanVersion: version } };
}

// --- Mode: recursive (find levels anywhere) ---
const ID_FIELDS = ["level", "id", "levelId", "level_id", "code", "key", "slug", "name"];

function extractLevelIdFromObject(obj) {
  if (!isPlainObject(obj)) return null;
  for (const f of ID_FIELDS) {
    const val = obj[f];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const k of Object.keys(obj)) out[k] = deepClone(obj[k]);
  return out;
}

function recursiveMerge(root, humanModel, levelIds) {
  const humanLevels = humanModel?.levels ?? {};
  const humanVersion = humanModel?.version ?? "unknown";
  const injectedPaths = [];
  const seenLevelIds = new Set();
  const visited = new WeakSet();

  function visit(node, pathStr) {
    if (!node || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    if (isPlainObject(node)) {
      for (const k of Object.keys(node)) {
        const child = node[k];
        if (levelIds.includes(k) && isPlainObject(child)) {
          seenLevelIds.add(k);
          const hm = humanLevels[k];
          if (hm) {
            child.human_model = hm;
            child.human_model_version = humanVersion;
            injectedPaths.push({ levelId: k, path: `${pathStr}.${k}`, kind: "map-key" });
          }
        }
      }
    }

    if (Array.isArray(node)) {
      node.forEach((item, idx) => {
        const maybeId = extractLevelIdFromObject(item);
        if (maybeId && levelIds.includes(maybeId) && isPlainObject(item)) {
          seenLevelIds.add(maybeId);
          const hm = humanLevels[maybeId];
          if (hm) {
            item.human_model = hm;
            item.human_model_version = humanVersion;
            injectedPaths.push({ levelId: maybeId, path: `${pathStr}[${idx}]`, kind: "array-item" });
          }
        }
      });
    }

    if (Array.isArray(node)) {
      node.forEach((child, idx) => visit(child, `${pathStr}[${idx}]`));
    } else if (isPlainObject(node)) {
      for (const [k, child] of Object.entries(node)) visit(child, `${pathStr}.${k}`);
    }
  }

  visit(root, "$");
  const missing = levelIds.filter((id) => !seenLevelIds.has(id));
  const injectedByLevel = {};
  for (const id of levelIds) injectedByLevel[id] = 0;
  injectedPaths.forEach((x) => { injectedByLevel[x.levelId] = (injectedByLevel[x.levelId] ?? 0) + 1; });
  const notInjected = levelIds.filter((id) => (injectedByLevel[id] ?? 0) === 0);

  return {
    report: { injectedPaths, injectedByLevel, missing, notInjected, humanVersion },
  };
}

function main() {
  const args = parseArgs(process.argv);
  const defaultDir = "src/lib/bty/arena";
  const programPath = args.program ?? path.join(defaultDir, "arena_program.json");
  const humanPath = args.human ?? path.join(defaultDir, "arena_human_model.json");
  const outPath = args.out ?? path.join(defaultDir, "arena_program.merged.json");
  const mode = (args.mode ?? "tracks").toLowerCase() === "recursive" ? "recursive" : "tracks";
  const strict = toBool(args.strict, true);
  const dry = toBool(args.dry, false);

  const program = readJson(programPath);
  const human = readJson(humanPath);
  const levelIds = args.levels
    ? String(args.levels)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : Object.keys(human?.levels ?? {});

  if (levelIds.length === 0) {
    console.error("No level IDs (human model has no levels or --levels empty).");
    process.exit(1);
  }

  let merged;
  let report;

  if (mode === "tracks") {
    const result = mergeTracks(program, human);
    merged = result.merged;
    report = result.report;
  } else {
    const clone = deepClone(program);
    const result = recursiveMerge(clone, human, levelIds);
    merged = clone;
    report = result.report;
  }

  const { injectedByLevel, missing, notInjected, humanVersion } = report;
  const totalInjected = Object.values(injectedByLevel).reduce((a, b) => a + b, 0);

  console.log("=== Arena Human Model Merge ===");
  console.log("Program:", programPath);
  console.log("Human:  ", humanPath, "(version:", humanVersion + ")");
  console.log("Out:    ", outPath);
  console.log("Mode:   ", mode);
  console.log("Dry:    ", dry ? "yes (no write)" : "no (write)");
  console.log("Strict: ", strict ? "on" : "off");
  console.log("");
  console.log("Injected by level:");
  for (const id of levelIds) {
    console.log("  ", id + ":", injectedByLevel[id] ?? 0);
  }
  console.log("");
  console.log("Total injected:", totalInjected);

  if (mode === "recursive" && report.injectedPaths?.length > 0) {
    const cap = 15;
    console.log("");
    console.log("Sample paths (up to " + cap + "):");
    report.injectedPaths.slice(0, cap).forEach((x) => {
      console.log("  ", "[" + x.levelId + "]", x.kind, "@", x.path);
    });
  }

  if (missing.length > 0) {
    console.log("");
    console.log("Missing in program (no node for level):", missing.join(", "));
  }
  if (notInjected.length > 0) {
    console.log("");
    console.log("Not injected (no human model or no match):", notInjected.join(", "));
  }

  const failStrict = strict && totalInjected === 0;
  if (failStrict) {
    console.log("");
    console.error("STRICT: merge incomplete. Fix program structure, level ids, or human model.");
    process.exit(1);
  }

  if (!dry) {
    writeJson(outPath, merged);
    console.log("");
    console.log("Written to", outPath);
  } else {
    console.log("");
    console.log("Dry run; no file written.");
  }
}

main();
