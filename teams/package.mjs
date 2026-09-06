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

/*
  ★ THE ICON FILES COME FROM THE MANIFEST, NOT FROM A LIST IN THIS FILE (Slice TQ-4.7B).

  This used to be a literal two-element array of icon filenames. It worked for as long as the icons were
  never renamed — and the moment TQ-4.7B pointed `icons.outline` at `outline-s1-v110.png` to test a
  path-keyed icon cache, a hardcoded list would have shipped the OLD `outline.png` and referenced a
  file the package does not contain. Teams would have rejected it, or worse, rendered nothing, and
  the experiment would have produced a meaningless result blamed on the hypothesis.

  Reading the names from the manifest makes the package ship exactly what it declares. It also means
  the stale asset cannot ride along: only the declared icons are staged.
*/
const declaredIcons = JSON.parse(rawManifest).icons ?? {};
const iconFiles = [...new Set(Object.values(declaredIcons))].filter((f) => typeof f === "string" && f.length > 0);
if (iconFiles.length < 2) {
  console.error("[teams-package] manifest must declare at least color and outline icons");
  process.exit(1);
}
for (const f of iconFiles) {
  if (!existsSync(join(SRC, f))) {
    console.error(`[teams-package] manifest declares icon "${f}" but ${join(SRC, f)} does not exist`);
    process.exit(1);
  }
  cpSync(join(SRC, f), join(STAGE, f));
}

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
// Every top-level key must be one Teams v1.25 actually defines. The published schema sets
// `additionalProperties: false`, so ONE unknown key rejects the whole upload — and Teams stops at
// the first failure, so the next unknown key would only surface on the next attempt. This list is
// the property set of the v1.25 schema the manifest declares, checked offline so a bad package
// never reaches a person. (T1 shipped a `packageName` this way; it is not a property in any of these
// schema versions.)
//
// RE-PINNED 1.17 -> 1.25 (T1.1-R2) because the manifest now declares `supportsChannelFeatures`,
// which private/shared channel support requires and which v1.17 does not define. The list below was
// READ FROM the published v1.25 schema rather than edited by hand: pinning it to the version the
// manifest declares is the whole point of the check, so widening it one key at a time would quietly
// turn a version gate into a spelling gate.
const V1_25_TOP_LEVEL = new Set(["$schema", "accentColor", "activities", "agenticUserTemplates", "authorization", "backgroundLoadConfiguration", "bots", "composeExtensions", "configurableProperties", "configurableTabs", "connectors", "copilotAgents", "dashboardCards", "defaultBlockUntilAdminAction", "defaultGroupCapability", "defaultInstallScope", "description", "developer", "devicePermissions", "elementRelationshipSet", "extensions", "graphConnector", "icons", "id", "intuneInfo", "isFullScreen", "localizationInfo", "manifestVersion", "meetingExtensionDefinition", "name", "permissions", "publisherDocsUrl", "showLoadingIndicator", "staticTabs", "subscriptionOffer", "supportedChannelTypes", "supportsChannelFeatures", "validDomains", "version", "webApplicationInfo"]);
const unknown = Object.keys(parsed).filter((k) => k !== "$schema" && !V1_25_TOP_LEVEL.has(k));
if (unknown.length) {
  console.error("[teams-package] top-level properties not defined in Teams v1.25:", unknown.join(", "));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// THE A0 SAFETY CONTRACT (was: the T1 single-message-action contract).
//
// T1's rule was "one compose command and NO tabs", and it did its job — it is why a tab could not
// arrive by accident. A0 adds a personal tab deliberately, so the rule is REPLACED rather than
// deleted: the package must now carry exactly one personal static tab, exactly one compose
// command still named `saveToBty`, no configurable tabs, and an SSO binding that names this app's
// own bot. Anything more is still refused.
//
// `webApplicationInfo` is an SSO BINDING, not a Graph surface. The Graph markers are
// `authorization` / `resourceSpecific`, and those must stay absent — that is asserted separately
// below so the two claims can never be confused for one another again.
// ---------------------------------------------------------------------------
const commands = parsed.composeExtensions?.[0]?.commands ?? [];
if (parsed.configurableTabs) {
  console.error("[teams-package] configurableTabs are not part of the A0 surface");
  process.exit(1);
}
// Slice A1 — TWO known commands now, and only these two, in this order. `saveToBty` shipped and
// is device-proven; a change to it is a regression to an existing capability, not an addition.
const EXPECTED_COMMANDS = ["saveToBty", "trackWithBty"];
if ((parsed.composeExtensions ?? []).length !== 1) {
  console.error("[teams-package] manifest must expose exactly one compose extension");
  process.exit(1);
}
if (commands.length !== EXPECTED_COMMANDS.length
    || commands.some((c, i) => c?.id !== EXPECTED_COMMANDS[i])) {
  console.error(`[teams-package] compose commands must be exactly [${EXPECTED_COMMANDS.join(", ")}]`);
  process.exit(1);
}
for (const c of commands) {
  // Both act on a MESSAGE and open a dialog. A `compose`/`commandBox` context would put them
  // somewhere this product has no behaviour for.
  if (c?.type !== "action" || c?.fetchTask !== true
      || !Array.isArray(c?.context) || c.context.length !== 1 || c.context[0] !== "message") {
    console.error(`[teams-package] command ${c?.id} must be a fetchTask action in the message context`);
    process.exit(1);
  }
}

// ORDER IS THE MECHANISM (Slice A0.1). Microsoft: "Bot acts as the default landing capability if
// its scope is defined as personal, even if you don't specify entityId as conversations" — which
// is why the personal app opened on Chat. The documented repair is to list the tab FIRST and the
// reserved `conversations` entry (the bot chat) second. Personal bot scope is NOT removed: message
// extensions carry no scopes of their own, so the 1:1 Save to BTY surface depends on it.
//
// Both entries are required, in this order, and nothing else may appear.
const tabs = parsed.staticTabs ?? [];
if (tabs.length !== 2) {
  console.error("[teams-package] manifest must declare exactly two personal static tabs: the BTY tab, then `conversations`");
  process.exit(1);
}
const tab = tabs[0] ?? {};
if (
  tab.entityId !== "btyHome" ||
  tab.contentUrl !== "https://arena.btydaily.com/teams" ||
  !Array.isArray(tab.scopes) ||
  tab.scopes.length !== 1 ||
  tab.scopes[0] !== "personal"
) {
  console.error("[teams-package] the FIRST static tab must be the personal BTY tab pointing at /teams — its position is what makes it the default landing capability");
  process.exit(1);
}
const chat = tabs[1] ?? {};
if (chat.entityId !== "conversations" || !Array.isArray(chat.scopes) || chat.scopes[0] !== "personal") {
  console.error("[teams-package] the SECOND static tab must be the reserved `conversations` entry — without it the bot chat reclaims the default landing position");
  process.exit(1);
}

// The 1:1 message action depends on this and nothing declares it but here.
const botScopes = parsed.bots?.[0]?.scopes ?? [];
if (!botScopes.includes("personal")) {
  console.error("[teams-package] bots[0].scopes must keep `personal` — message extensions have no scopes of their own, and removing it withdraws Save to BTY from one-on-one chats");
  process.exit(1);
}

// The SSO binding must name THIS app's bot, in the exact Application ID URI shape Microsoft
// documents for an app carrying a bot, a message extension and a tab. A resource that disagreed
// with the Entra registration would install fine and then fail every silent sign-in on device.
const wai = parsed.webApplicationInfo ?? {};
const expectedResource = `api://arena.btydaily.com/botid-${parsed.bots?.[0]?.botId}`;
if (wai.id !== parsed.bots?.[0]?.botId || wai.resource !== expectedResource) {
  console.error("[teams-package] webApplicationInfo must bind this app's own bot id and its api:// resource");
  process.exit(1);
}

// THE PRIVACY CLAIM, stated where it actually lives: no Graph, no RSC. Not "no
// webApplicationInfo" — that property is the SSO binding above and is now REQUIRED.
if (parsed.authorization || JSON.stringify(parsed).includes("resourceSpecific")) {
  console.error("[teams-package] manifest introduces a Microsoft Graph / RSC surface");
  process.exit(1);
}

// EVERY compose-extension botId must also appear in `bots`.
//
// This is the defect that shipped as 1.0.0: the package declared a bot-powered message action and
// never declared the bot. It is schema-valid — `bots` is optional — so validation passed, the app
// installed cleanly org-wide, and the command simply never appeared in the message menu. Nothing
// reports an error; the capability is just absent. Every Microsoft sample with this command shape
// declares the bot, so the agreement is checked here rather than discovered on a device again.
const declaredBots = new Set((parsed.bots ?? []).map((b) => b?.botId));
for (const ce of parsed.composeExtensions ?? []) {
  if (ce?.botId && !declaredBots.has(ce.botId)) {
    console.error("[teams-package] composeExtensions botId is not declared in `bots` — Teams will not install the bot, and the message action will not appear");
    process.exit(1);
  }
}
writeFileSync(join(STAGE, "manifest.json"), manifest);

rmSync(OUT, { force: true });
// -j: junk paths, so every entry lands at the ZIP ROOT.
/*
  The SAME manifest-derived list is used here. This line used to name the three files literally, and
  when the icon was renamed it silently zipped only two of them — `zip -q` says nothing about a file
  it was not given, so the package looked built and shipped without an outline icon at all. One list,
  derived once, used for both staging and zipping.
*/
execFileSync("zip", ["-j", "-q", OUT, join(STAGE, "manifest.json"), ...iconFiles.map((f) => join(STAGE, f))]);
rmSync(STAGE, { recursive: true, force: true });

const listing = execFileSync("unzip", ["-Z1", OUT]).toString().trim().split("\n");
console.log("[teams-package] built", OUT);
console.log("[teams-package] entries at root:", listing.join(", "));
if (!existsSync(OUT) || listing.some((e) => e.includes("/"))) {
  console.error("[teams-package] package is not flat");
  process.exit(1);
}
