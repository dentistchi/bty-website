/**
 * One-time / repeatable: replace placeholder primaryChoices + generic escalation copy
 * in bty_elite_scenarios_v2.json for core_* rows.
 *
 * Run: node scripts/patch-elite-v2-core-placeholders.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, "../src/data/bty_elite_scenarios_v2.json");

const PLACEHOLDER_PREFIX = "Primary move A —";

function parseAxis(axis) {
  const raw = String(axis ?? "").trim();
  const m = raw.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!m) return { left: "the first commitment", right: "the second commitment" };
  return { left: m[1].trim(), right: m[2].trim() };
}

function primaryChoicesFromAxis(axis) {
  const { left, right } = parseAxis(axis);
  return [
    {
      id: "A",
      label: `Commit to ${left}: put this pole first in what you do next, even if it costs rapport today.`,
      subtext: "",
    },
    {
      id: "B",
      label: `Commit to ${right}: put this pole first in what you do next, even if it exposes you to pushback.`,
      subtext: "",
    },
    {
      id: "C",
      label:
        "Hold the line between them: protect people and timelines while you close information gaps you still have.",
      subtext: "",
    },
    {
      id: "D",
      label:
        "Widen ownership: bring another leader, HR, compliance, or a peer into the decision explicitly — now, not after the fact.",
      subtext: "",
    },
  ];
}

function clip(s, n) {
  const t = String(s ?? "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function escalationText(branchKey, pressure) {
  const lead = {
    A: "Immediate fallout: others react to the move you just made.",
    B: "Your stance is visible to people who were not in the room when you decided.",
    C: "Competing priorities collide before you can stabilize the narrative.",
    D: "What you avoided is now the next decision that will not stay private.",
  };
  return `${lead[branchKey]} ${clip(pressure, 360)}`;
}

function secondChoicesForScenario(tradeoff) {
  const tw = clip(tradeoff, 420);
  return [
    {
      id: "X",
      label:
        "Protect runway: defer a public stake while you confirm facts, document, and control timing — accepting that the issue stays live.",
      cost: `You limit exposure today; the underlying tension remains: ${tw}`,
      direction: "exit",
      pattern_family: "future_deferral",
    },
    {
      id: "Y",
      label:
        "Engage directly: name the tension with the people involved before the story hardens without you — accepting short-term heat.",
      cost: `You invite immediate friction; the same trade-off is still in play: ${tw}`,
      direction: "entry",
      pattern_family: "repair_avoidance",
    },
  ];
}

function patchScenario(s) {
  if (!s.id?.startsWith("core_")) return s;
  const first = s.primaryChoices?.[0]?.label ?? "";
  if (typeof first !== "string" || !first.includes(PLACEHOLDER_PREFIX)) return s;

  const axis = s.bty_tension_axis ?? "";
  const pressure = s.pressure ?? "";
  const tradeoff = s.tradeoff ?? "";

  const primaryChoices = primaryChoicesFromAxis(axis);
  const eb = s.escalationBranches ?? {};
  const nextEb = {};
  for (const key of ["A", "B", "C", "D"]) {
    const prev = eb[key];
    if (!prev) continue;
    nextEb[key] = {
      escalation_text: escalationText(key, pressure),
      pressure_increase: prev.pressure_increase,
      second_choices: secondChoicesForScenario(tradeoff),
    };
  }

  return {
    ...s,
    primaryChoices,
    escalationBranches: nextEb,
  };
}

const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
if (!raw.scenarios || !Array.isArray(raw.scenarios)) {
  console.error("Invalid dataset");
  process.exit(1);
}
raw.scenarios = raw.scenarios.map(patchScenario);
writeFileSync(jsonPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
console.log("Patched", jsonPath);
