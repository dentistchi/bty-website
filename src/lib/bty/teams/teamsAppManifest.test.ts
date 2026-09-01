import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * The Teams app package, asserted as a contract (Slice T1.1-R2).
 *
 * WHY THIS FILE EXISTS. Every defect that has cost a device cycle on this integration lived in the
 * manifest, not in the code: a `packageName` that v1.17 does not define rejected the whole upload;
 * a compose extension declared a bot it never declared in `bots`, so Teams installed no bot and
 * rendered no command; `"team"` was removed from `bots[].scopes` and restored ten minutes later.
 * None of those are visible in a diff review at a glance, and all of them are trivially assertable.
 *
 * WHAT IT DOES NOT DO. It does not validate against Microsoft's published schema — that needs the
 * network, and a test that fails when developer.microsoft.com is slow is worse than no test. The
 * schema check belongs to the packager (`teams/package.mjs`), which is pinned to the property set
 * of the version the manifest declares. This file asserts the identity and capability facts that
 * must not drift: the ids Teams and the Bot Framework already know, and the one message action.
 */

const MANIFEST_DIR = "teams/manifest";
const MANIFEST_PATH = `${MANIFEST_DIR}/manifest.json`;
const PACKAGE_PATH = "teams/dist/bty-arena-teams-t1.zip";

/** The files the packager copies into the zip — nothing else may live in the manifest directory. */
const PACKAGE_FILES = ["color.png", "manifest.json", "outline.png"] as const;

type Manifest = {
  $schema?: string;
  manifestVersion?: string;
  version?: string;
  id?: string;
  supportsChannelFeatures?: string;
  supportedChannelTypes?: unknown;
  permissions?: unknown;
  validDomains?: unknown;
  webApplicationInfo?: unknown;
  authorization?: unknown;
  bots?: { botId?: string; scopes?: string[]; isNotificationOnly?: boolean }[];
  composeExtensions?: {
    botId?: string;
    commands?: { id?: string; type?: string; title?: string; context?: string[]; fetchTask?: boolean }[];
  }[];
};

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;

/** Known to Teams and to the Bot Framework already. A new value here is a new app, not an update. */
const APP_ID = "374ec662-0deb-4e0b-8514-e38a035a349e";
const BOT_ID = "820f231b-9dbb-4c84-94c5-65bc43d35d91";

describe("Teams app manifest — identity", () => {
  it("keeps the published app id and bot id", () => {
    expect(manifest.id).toBe(APP_ID);
    expect(manifest.bots?.[0]?.botId).toBe(BOT_ID);
    expect(manifest.composeExtensions?.[0]?.botId).toBe(BOT_ID);
  });

  it("declares manifest v1.25 and app version 1.0.3, and points $schema at the same version", () => {
    expect(manifest.manifestVersion).toBe("1.25");
    expect(manifest.version).toBe("1.0.3");
    // A manifest that declares one version and links another is the state in which a property is
    // "valid" against the schema nobody is actually validating against.
    expect(manifest.$schema).toContain("/v1.25/");
  });
});

describe("Teams app manifest — capability", () => {
  it("keeps all three bot scopes, so the app can be installed in a team as well as personally", () => {
    // `team` is what makes a host-team installation possible at all; it was removed once by accident.
    expect(manifest.bots?.[0]?.scopes).toEqual(["personal", "team", "groupChat"]);
    expect(manifest.bots?.[0]?.isNotificationOnly).toBe(false);
  });

  it("exposes exactly one message action, unchanged", () => {
    const commands = manifest.composeExtensions?.[0]?.commands ?? [];
    expect(manifest.composeExtensions).toHaveLength(1);
    expect(commands).toHaveLength(1);
    expect(commands[0]?.id).toBe("saveToBty");
    expect(commands[0]?.type).toBe("action");
    expect(commands[0]?.title).toBe("Save to BTY");
    // `message` is what puts the command in a message's `...` menu; `compose`/`commandBox` would
    // put it somewhere this product does not use.
    expect(commands[0]?.context).toEqual(["message"]);
    expect(commands[0]?.fetchTask).toBe(true);
  });

  it("declares tier1 channel support, which is what private and shared channels require", () => {
    expect(manifest.supportsChannelFeatures).toBe("tier1");
    // The older per-type list is deliberately NOT set: tier1 declares support for all channel
    // features, and carrying both would state the same thing twice in two vocabularies.
    expect(manifest.supportedChannelTypes).toBeUndefined();
  });
});

describe("Teams app manifest — permission boundary", () => {
  it("introduces no Microsoft Graph surface", () => {
    // `webApplicationInfo` and `authorization` are the two places a Graph permission can enter a
    // manifest. Both absent is the whole T1 privacy claim: Teams hands us the chosen message, and
    // BTY can read nothing else.
    expect(manifest.webApplicationInfo).toBeUndefined();
    expect(manifest.authorization).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain("resourceSpecific");
  });

  it("requests only identity, and only its own domain", () => {
    expect(manifest.permissions).toEqual(["identity"]);
    expect(manifest.validDomains).toEqual(["arena.btydaily.com"]);
  });
});

describe("Teams app package contents", () => {
  it("ships exactly manifest.json, color.png and outline.png", () => {
    // The packager copies this directory's three files and nothing else, so the directory listing
    // IS the package contents — asserted here because it holds on a clean checkout, where the
    // built zip (gitignored) does not exist.
    expect(readdirSync(MANIFEST_DIR).sort()).toEqual([...PACKAGE_FILES]);
  });

  it("the built zip, when present, is flat and contains exactly those three entries", () => {
    if (!existsSync(PACKAGE_PATH)) {
      // Build artifact, not source. Its absence is not a failure; its being WRONG would be.
      expect(existsSync(MANIFEST_PATH)).toBe(true);
      return;
    }
    const entries = execFileSync("unzip", ["-Z1", PACKAGE_PATH]).toString().trim().split("\n").sort();
    expect(entries).toEqual([...PACKAGE_FILES]);
    expect(entries.some((e) => e.includes("/"))).toBe(false);
  });

  it("the built zip, when present, carries the same manifest bytes as the repo", () => {
    if (!existsSync(PACKAGE_PATH)) return;
    const zipped = execFileSync("unzip", ["-p", PACKAGE_PATH, "manifest.json"]);
    expect(zipped.toString("utf8")).toBe(readFileSync(MANIFEST_PATH, "utf8"));
  });
});
