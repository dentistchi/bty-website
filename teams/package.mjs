#!/usr/bin/env node
/**
 * Build the installable Teams app package. Slice T1.
 *
 * Zips the CONTENTS of teams/manifest/ — Teams rejects a package whose manifest.json sits inside a
 * folder, and that failure looks like a manifest error rather than a packaging one, so it is worth
 * being deliberate about.
 *
 * Substitutes ${TEAMS_BOT_APP_ID} from the environment and REFUSES to emit a package that still
 * contains an unresolved placeholder — an app uploaded with a literal `${...}` botId installs
 * cleanly and then silently never reaches the endpoint.
 *
 *   TEAMS_BOT_APP_ID=<bot app id> node teams/package.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = "teams/manifest";
const STAGE = "teams/dist/.stage";
const OUT = "teams/dist/bty-arena-teams-t1.zip";

const botAppId = (process.env.TEAMS_BOT_APP_ID ?? "").trim();
const rawManifest = readFileSync(join(SRC, "manifest.json"), "utf8");
// The bot App ID is PUBLIC — it ships inside the manifest Teams distributes — so once it is
// committed there, packaging needs no environment at all. The env var stays supported for a
// rebuild against a different bot, and is REQUIRED only while a placeholder is still present.
if (rawManifest.includes("${TEAMS_BOT_APP_ID}") && !botAppId) {
  console.error("[teams-package] manifest still has ${TEAMS_BOT_APP_ID}; set TEAMS_BOT_APP_ID to substitute it.");
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
for (const f of ["color.png", "outline.png"]) cpSync(join(SRC, f), join(STAGE, f));

const manifest = botAppId ? rawManifest.replaceAll("${TEAMS_BOT_APP_ID}", botAppId) : rawManifest;

// Refuse to ship an unresolved placeholder or a malformed manifest.
if (/\$\{[^}]+\}/.test(manifest)) {
  console.error("[teams-package] unresolved placeholder remains:", manifest.match(/\$\{[^}]+\}/g).join(", "));
  process.exit(1);
}
const parsed = JSON.parse(manifest);
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
for (const [label, value] of [
  ["manifest.id", parsed.id],
  ["composeExtensions[0].botId", parsed.composeExtensions?.[0]?.botId],
]) {
  if (!GUID.test(String(value ?? ""))) {
    console.error(`[teams-package] ${label} is not a GUID`);
    process.exit(1);
  }
}
// One capability, and only one.
const commands = parsed.composeExtensions?.[0]?.commands ?? [];
if (parsed.staticTabs || parsed.configurableTabs || parsed.bots || commands.length !== 1) {
  console.error("[teams-package] manifest exposes more than the single T1 message action");
  process.exit(1);
}
writeFileSync(join(STAGE, "manifest.json"), manifest);

rmSync(OUT, { force: true });
// -j: junk paths, so every entry lands at the ZIP ROOT.
execFileSync("zip", ["-j", "-q", OUT, join(STAGE, "manifest.json"), join(STAGE, "color.png"), join(STAGE, "outline.png")]);
rmSync(STAGE, { recursive: true, force: true });

const listing = execFileSync("unzip", ["-Z1", OUT]).toString().trim().split("\n");
console.log("[teams-package] built", OUT);
console.log("[teams-package] entries at root:", listing.join(", "));
if (!existsSync(OUT) || listing.some((e) => e.includes("/"))) {
  console.error("[teams-package] package is not flat");
  process.exit(1);
}
