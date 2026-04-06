/**
 * Minimal terminal runner for BTY chain scenarios.
 * Run: npm run bty:test-chain
 *
 * Pattern engine + action contract (after 3 full chains):
 *   npx tsx src/scripts/bty-test-chain.ts --triple
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { ChoiceId, ScenarioNode, StateImpact } from "../lib/bty/scenario-node-validator";
import {
  buildPatternState,
  detectPatternTriggers,
  encodeActionContractQrUri,
  generateChainPatternInsight,
  generateStretchBalanceMessage,
  type ChainChoiceRecord,
} from "../lib/bty/pattern-engine/chainPatternEngine";
import {
  parseStrictChainListIndex,
  validateContractHow,
  validateContractWhat,
  validateContractWhen,
  validateContractWho,
} from "../lib/bty/pattern-engine/chainWorkspaceContractValidation";

const CHAINS_ROOT = join(process.cwd(), "src/data/bty_chain_workspace/Chains");
const CONTRACT_STORE = join(process.cwd(), ".bty-chain-action-contract.json");

const FILES = ["S1_anchor.json", "S2_consequence.json", "S3_identity.json"] as const;

function listChainFolders(): string[] {
  const entries = readdirSync(CHAINS_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

export interface PlayerState {
  reputation: number;
  trust: number;
  self_narrative: number;
  courage: number;
}

function emptyState(): PlayerState {
  return { reputation: 0, trust: 0, self_narrative: 0, courage: 0 };
}

function applyImpact(state: PlayerState, impact: StateImpact): void {
  state.reputation += impact.reputation;
  state.trust += impact.trust;
  state.self_narrative += impact.self_narrative;
  state.courage += impact.courage;
}

function formatState(state: PlayerState): string {
  return `reputation=${state.reputation}  trust=${state.trust}  self_narrative=${state.self_narrative}  courage=${state.courage}`;
}

function loadChain(chainDir: string): Map<string, ScenarioNode> {
  const map = new Map<string, ScenarioNode>();
  for (const file of FILES) {
    const raw = readFileSync(join(chainDir, file), "utf8");
    const node = JSON.parse(raw) as ScenarioNode;
    map.set(node.id, node);
  }
  return map;
}

function stageLabel(node: ScenarioNode): string {
  if (node.chain_stage === 1) return "S1";
  if (node.chain_stage === 2) return "S2";
  return "S3";
}

function parseChoice(line: string): ChoiceId | null {
  const t = line.trim().toUpperCase();
  if (t === "A" || t === "B" || t === "C") return t;
  return null;
}

type InputMode =
  | { kind: "tty"; rl: readline.Interface }
  | { kind: "pipe"; lines: string[] };

function createInputMode(): InputMode {
  if (input.isTTY) {
    return { kind: "tty", rl: readline.createInterface({ input, output }) };
  }
  const buf = readFileSync(0, "utf8");
  const lines = buf.split(/\n/).map((l) => l.replace(/\r$/, ""));
  return { kind: "pipe", lines };
}

async function readLine(mode: InputMode, prompt: string): Promise<string | null> {
  if (mode.kind === "tty") {
    return await mode.rl.question(prompt);
  }
  output.write(prompt);
  const line = mode.lines.shift();
  if (line === undefined) {
    output.write("\n");
    return null;
  }
  output.write(`${line}\n`);
  return line;
}

function closeInputMode(mode: InputMode): void {
  if (mode.kind === "tty") {
    mode.rl.close();
  }
}

async function promptChainIndex(mode: InputMode, folders: string[]): Promise<number> {
  const max = folders.length;
  output.write("\nSelect a chain to run:\n");
  for (let i = 0; i < folders.length; i++) {
    output.write(`${i + 1}. ${folders[i]}\n`);
  }
  const prompt = `Enter number (1-${max}, default 1): `;
  for (;;) {
    const line = await readLine(mode, prompt);
    if (line === null) {
      return 0;
    }
    const parsed = parseStrictChainListIndex(line, max);
    if (parsed === "default") {
      return 0;
    }
    if (parsed !== null) {
      return parsed;
    }
    output.write(
      `Invalid input. Enter a whole number from 1 to ${max} only (no letters or extra characters), or leave empty for default.\n`,
    );
  }
}

async function promptChoice(mode: InputMode): Promise<ChoiceId | null> {
  const prompt = "Your choice (A / B / C): ";
  for (;;) {
    const line = await readLine(mode, prompt);
    if (line === null) {
      output.write("Input ended before a valid choice. Exiting.\n");
      return null;
    }
    const choice = parseChoice(line);
    if (choice) return choice;
    output.write("Invalid input. Enter A, B, or C.\n");
  }
}

function printScenario(node: ScenarioNode): void {
  const step = stageLabel(node);
  output.write("\n");
  output.write(`────────── ${step}  (chain step ${node.chain_stage} of 3) ──────────\n`);
  output.write(`\n${node.title}\n\n`);
  output.write(`${node.context.narrative}\n\n`);
  for (const c of node.choices) {
    output.write(`  ${c.id}) ${c.label}\n`);
  }
  output.write("\n");
}

function printTransition(from: ScenarioNode, toId: string): void {
  const fromStep = stageLabel(from);
  const toStep =
    toId.includes("s2") ? "S2" : toId.includes("s3") ? "S3" : toId.slice(0, 12) + "…";
  output.write(`\n→ Transition: ${fromStep} → ${toStep}\n`);
}

async function runOneChain(
  mode: InputMode,
  folders: string[],
  chainRoundLabel: string,
): Promise<{ choices: ChainChoiceRecord[]; folderName: string; finalState: PlayerState } | null> {
  output.write(`\n━━ ${chainRoundLabel} ━━\n`);
  const chainIndex = await promptChainIndex(mode, folders);
  const folderName = folders[chainIndex];
  const chainDir = join(CHAINS_ROOT, folderName);

  let nodes: Map<string, ScenarioNode>;
  try {
    nodes = loadChain(chainDir);
  } catch (e) {
    output.write(`Failed to load chain "${folderName}" (${chainDir}).\n`);
    console.error(e);
    return null;
  }

  const startRaw = readFileSync(join(chainDir, FILES[0]), "utf8");
  const start = JSON.parse(startRaw) as ScenarioNode;
  let current = nodes.get(start.id);
  if (!current) {
    output.write(`Missing start node id ${start.id} in chain map.\n`);
    return null;
  }

  const state = emptyState();
  const choices: ChainChoiceRecord[] = [];

  output.write(`\nChain: ${folderName}\n`);
  output.write("Path: S1 → S2 → S3\n\n");
  output.write(`Starting state: ${formatState(state)}\n`);

  for (;;) {
    printScenario(current);

    const choice = await promptChoice(mode);
    if (choice === null) {
      return null;
    }
    const chosen = current.choices.find((c) => c.id === choice);
    if (!chosen) {
      output.write("Internal error: choice not found.\n");
      return null;
    }

    choices.push({ archetype: chosen.archetype, state_impact: chosen.state_impact });
    applyImpact(state, chosen.state_impact);
    output.write(`\nAfter choice ${choice}: ${formatState(state)}\n`);

    const isTerminal = current.chain_stage >= 3;
    if (isTerminal) {
      output.write("\n══════════ End of chain ══════════\n\n");
      output.write(`Final state: ${formatState(state)}\n\n`);
      output.write("Reflection questions (S3):\n");
      const q = current.questions;
      const order = ["level_1", "level_2", "level_3", "level_4", "level_5"] as const;
      for (const key of order) {
        const text = q[key];
        if (text?.trim()) {
          output.write(`  • ${key}: ${text}\n`);
        }
      }
      if (q.level_5?.trim()) {
        output.write("\nLevel 5 focus:\n");
        output.write(`  ${q.level_5}\n`);
      }
      break;
    }

    const nextId: string | undefined = current.next_map?.[choice];
    if (!nextId || !nodes.has(nextId)) {
      output.write(`Missing or invalid next_map for ${choice} from ${current.id}.\n`);
      return null;
    }

    printTransition(current, nextId);
    current = nodes.get(nextId)!;
  }

  return { choices, folderName, finalState: state };
}

function parseYesNo(line: string | null): boolean | null {
  if (line === null) return null;
  const x = line.trim().toLowerCase();
  if (x === "y" || x === "yes") return true;
  if (x === "n" || x === "no") return false;
  return null;
}

/**
 * Before the next chain run: follow-up for the last saved workspace contract (local JSON only).
 */
async function promptChainContractFollowupFromFile(mode: InputMode): Promise<void> {
  if (!existsSync(CONTRACT_STORE)) return;
  let raw: string;
  try {
    raw = readFileSync(CONTRACT_STORE, "utf8");
  } catch {
    return;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  if (!data.answers || data.followup) return;

  output.write("\n── Follow-up (last saved action contract) ──\n");
  for (;;) {
    const line = await readLine(mode, "Did you start the conversation? (yes / no): ");
    if (line === null) return;
    const yn = parseYesNo(line);
    if (yn !== null) {
      let first30: string | null = null;
      if (yn) {
        const t = await readLine(mode, "What happened in the first 30 seconds? ");
        first30 = t === null ? "" : t;
      }
      const deltas = yn
        ? { trust_delta: 1, courage_delta: 1, self_narrative_delta: 1 }
        : { trust_delta: 0, courage_delta: 0, self_narrative_delta: 0 };
      const next = {
        ...data,
        followup: {
          startedConversation: yn,
          first_30_seconds: yn ? first30 : null,
          ...deltas,
          recordedAt: new Date().toISOString(),
        },
      };
      writeFileSync(CONTRACT_STORE, JSON.stringify(next, null, 2), "utf8");
      output.write(`Updated: ${CONTRACT_STORE}\n`);
      return;
    }
    output.write("Invalid input. Enter yes or no.\n");
  }
}

async function promptActionContract(mode: InputMode): Promise<{
  who: string;
  what: string;
  when: string;
  how: string;
} | null> {
  output.write("\n── Action contract ──\n");

  let who: string;
  for (;;) {
    output.write("\nWho is one specific person affected by this pattern?\nUse a real name.\n");
    const line = await readLine(mode, "Answer: ");
    if (line === null) return null;
    const err = validateContractWho(line);
    if (!err) {
      who = line;
      break;
    }
    output.write(`${err}\n`);
  }

  let what: string;
  for (;;) {
    output.write(
      "\nWhat is one conversation you have been avoiding with this person?\nDescribe the situation, not the person.\n",
    );
    const line = await readLine(mode, "Answer: ");
    if (line === null) return null;
    const err = validateContractWhat(line);
    if (!err) {
      what = line;
      break;
    }
    output.write(`${err}\n`);
  }

  let when: string;
  for (;;) {
    output.write("\nWhen will you start this conversation?\nChoose a near, real time.\n");
    const line = await readLine(mode, "Answer: ");
    if (line === null) return null;
    const err = validateContractWhen(line);
    if (!err) {
      when = line;
      break;
    }
    output.write(`${err}\n`);
  }

  let how: string;
  for (;;) {
    output.write(
      "\nWhat is your first sentence?\nWrite exactly what you will say. No explanation.\nStart with your honesty or responsibility, not accusation.\n",
    );
    const line = await readLine(mode, "Answer: ");
    if (line === null) return null;
    const err = validateContractHow(line);
    if (!err) {
      how = line;
      break;
    }
    output.write(`${err}\n`);
  }

  return { who, what, when, how };
}

async function runTriplePatternFlow(mode: InputMode, folders: string[]): Promise<void> {
  const allChoices: ChainChoiceRecord[] = [];
  const chainNames: string[] = [];

  for (let r = 1; r <= 3; r++) {
    const result = await runOneChain(mode, folders, `Chain ${r} of 3`);
    if (!result) {
      process.exitCode = 1;
      return;
    }
    allChoices.push(...result.choices);
    chainNames.push(result.folderName);
  }

  const patternState = buildPatternState(allChoices);
  const triggers = detectPatternTriggers(patternState);
  const insight = generateChainPatternInsight(patternState, triggers);

  output.write("\n╔══════════════════════════════════════════════════════════╗\n");
  output.write("║ Pattern engine (after 3 chains)                          ║\n");
  output.write("╚══════════════════════════════════════════════════════════╝\n");
  output.write(`Chains played: ${chainNames.join(", ")}\n`);
  output.write(
    `Archetype counts — avoid: ${patternState.archetypeCounts.avoid}, structure: ${patternState.archetypeCounts.structure}, confront: ${patternState.archetypeCounts.confront}\n`,
  );
  output.write(
    `Summed impact — reputation: ${patternState.summedImpact.reputation}, trust: ${patternState.summedImpact.trust}, self_narrative: ${patternState.summedImpact.self_narrative}, courage: ${patternState.summedImpact.courage}\n`,
  );
  output.write(
    `Triggers — repetition: ${triggers.repetition}, negative drift: ${triggers.negativeDrift}, imbalance: ${triggers.imbalance}, interventionQr: ${triggers.interventionQr}, stretchPrompt: ${triggers.stretchPrompt}\n`,
  );
  output.write(`\nInsight:\n  ${insight}\n`);

  if (!triggers.interventionQr && !triggers.stretchPrompt) {
    output.write(
      "\nNo intervention QR or stretch prompt (needs repetition plus negative drift for QR, or repetition plus imbalance without drift for stretch).\n",
    );
    return;
  }

  if (triggers.stretchPrompt) {
    const balance = generateStretchBalanceMessage(patternState);
    output.write("\n── Stretch (balance) ──\n");
    output.write(`${balance}\n`);
    const storedStretch = {
      savedAt: new Date().toISOString(),
      chains: chainNames,
      patternState,
      triggers,
      insight,
      patternOutcome: "stretch_prompt" as const,
      stretchBalanceMessage: balance,
    };
    writeFileSync(CONTRACT_STORE, JSON.stringify(storedStretch, null, 2), "utf8");
    output.write(`\nStored: ${CONTRACT_STORE} (stretch note only; no contract QR)\n`);
  }

  if (triggers.interventionQr) {
    output.write("\nIntervention — action contract + QR payload.\n");
    const answers = await promptActionContract(mode);
    if (!answers) {
      process.exitCode = 1;
      return;
    }

    const qrLine = encodeActionContractQrUri(answers);
    const stored = {
      savedAt: new Date().toISOString(),
      chains: chainNames,
      patternState,
      triggers,
      insight,
      patternOutcome: "intervention_qr" as const,
      answers,
      qrUri: qrLine,
    };
    writeFileSync(CONTRACT_STORE, JSON.stringify(stored, null, 2), "utf8");

    output.write(`\nStored: ${CONTRACT_STORE}\n`);
    output.write("\nQR payload (copy or encode as QR):\n");
    output.write(`${qrLine}\n`);
  }
}

async function main(): Promise<void> {
  const triple = process.argv.includes("--triple");
  const folders = listChainFolders();
  if (folders.length === 0) {
    output.write(`No chain folders found under ${CHAINS_ROOT}\n`);
    process.exitCode = 1;
    return;
  }

  const inputMode = createInputMode();

  output.write("\nBTY chain test\n");
  if (triple) {
    output.write("Mode: --triple (3 chains → pattern engine → optional contract)\n");
  }

  try {
    await promptChainContractFollowupFromFile(inputMode);
    if (triple) {
      await runTriplePatternFlow(inputMode, folders);
    } else {
      const result = await runOneChain(inputMode, folders, "Single chain");
      if (!result && process.exitCode !== 1) {
        process.exitCode = 1;
      }
    }
  } finally {
    closeInputMode(inputMode);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
