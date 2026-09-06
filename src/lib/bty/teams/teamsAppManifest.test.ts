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
  staticTabs?: { entityId?: string; name?: string; contentUrl?: string; websiteUrl?: string; scopes?: string[] }[];
  configurableTabs?: unknown;
  webApplicationInfo?: { id?: string; resource?: string };
  validDomains?: unknown;
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

  it("declares manifest v1.25 and app version 1.0.7, and points $schema at the same version", () => {
    /*
      1.0.6 -> 1.0.7 (Slice TQ-4). The ONLY payload difference is `outline.png`, regenerated from
      the Founder's master vector. Teams caches app icons per installed package version, so an icon
      repair reaches nobody until the catalog receives a HIGHER version — the bump is not
      bookkeeping, it is the delivery mechanism.

      Every identity field is asserted unchanged above and below: same app id, same bot id, same
      scopes, same contentUrl, same validDomains, same permissions. A version bump must never be
      the change in which an identity quietly moves.
    */
    expect(manifest.manifestVersion).toBe("1.25");
    expect(manifest.version).toBe("1.0.7");
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

  it("keeps Save to BTY EXACTLY as it shipped — a change here is a regression, not an addition", () => {
    const commands = manifest.composeExtensions?.[0]?.commands ?? [];
    expect(manifest.composeExtensions).toHaveLength(1);
    expect(commands[0]?.id).toBe("saveToBty");
    expect(commands[0]?.type).toBe("action");
    expect(commands[0]?.title).toBe("Save to BTY");
    // `message` is what puts the command in a message's `...` menu; `compose`/`commandBox` would
    // put it somewhere this product does not use.
    expect(commands[0]?.context).toEqual(["message"]);
    expect(commands[0]?.fetchTask).toBe(true);
  });

  it("adds Track with BTY as the SECOND command, and exposes no third", () => {
    const commands = manifest.composeExtensions?.[0]?.commands ?? [];
    expect(commands).toHaveLength(2);
    expect(commands.map((c) => c?.id)).toEqual(["saveToBty", "trackWithBty"]);
    expect(commands[1]?.type).toBe("action");
    expect(commands[1]?.title).toBe("Track with BTY");
    expect(commands[1]?.context).toEqual(["message"]);
    expect(commands[1]?.fetchTask).toBe(true);
  });

  it("declares tier1 channel support, which is what private and shared channels require", () => {
    expect(manifest.supportsChannelFeatures).toBe("tier1");
    // The older per-type list is deliberately NOT set: tier1 declares support for all channel
    // features, and carrying both would state the same thing twice in two vocabularies.
    expect(manifest.supportedChannelTypes).toBeUndefined();
  });
});

describe("Teams app manifest — personal tab (Slice A0)", () => {
  it("declares the personal BTY tab FIRST — position is what makes it the default landing", () => {
    /*
      Slice A0.1. The personal app opened on Chat, and Microsoft says why: "Bot acts as the default
      landing capability if its scope is defined as personal, even if you don't specify entityId as
      conversations in staticTabs." The documented repair is ordering, not removal — the tab first,
      the reserved `conversations` entry second.

      The tab renders the SAME BtyDailyAppShell in place. It must not point at /{locale}/app: that
      route keeps `X-Frame-Options: DENY`, so framing it would blank the tab.
    */
    expect(manifest.staticTabs).toHaveLength(2);
    const tab = manifest.staticTabs?.[0];
    expect(tab?.entityId).toBe("btyHome");
    expect(tab?.name).toBe("BTY");
    expect(tab?.contentUrl).toBe("https://arena.btydaily.com/teams");
    expect(tab?.websiteUrl).toBe("https://arena.btydaily.com");
    expect(tab?.scopes).toEqual(["personal"]);
  });

  it("declares the reserved `conversations` entry SECOND, so the bot chat stops landing first", () => {
    const chat = manifest.staticTabs?.[1];
    expect(chat?.entityId).toBe("conversations");
    expect(chat?.scopes).toEqual(["personal"]);
    // A reserved keyword, not a page: it names the bot chat and carries no url of its own.
    expect(chat?.contentUrl).toBeUndefined();
  });

  it("KEEPS personal bot scope — removing it would withdraw Save to BTY from 1:1 chats", () => {
    /*
      Measured before touching this: `composeExtensions` has no `scopes` property of its own
      (`additionalProperties: false`), so a message extension's availability derives from the bot
      it names. Microsoft's guidance is that the personal scope is what makes action commands
      available in one-on-one chats. Dropping it to hide the Chat tab would have silently removed
      a shipped, device-proven capability — so the Chat tab is REORDERED, never removed.
    */
    expect(manifest.bots?.[0]?.scopes).toContain("personal");
    expect(manifest.bots?.[0]?.scopes).toEqual(["personal", "team", "groupChat"]);
  });

  it("declares no configurable tabs", () => {
    expect(manifest.configurableTabs).toBeUndefined();
  });

  it("binds tab SSO to this app's OWN bot, in the documented api:// shape", () => {
    // Microsoft's documented Application ID URI for an app carrying a bot, a message extension and
    // a tab is `api://<domain>/botid-<botAppId>` — which is why A0 needs no new Entra app. A
    // resource that disagreed with the Entra registration would install cleanly and then fail
    // every silent sign-in on device, which is exactly the class of defect this file exists for.
    expect(manifest.webApplicationInfo?.id).toBe(BOT_ID);
    expect(manifest.webApplicationInfo?.resource).toBe(`api://arena.btydaily.com/botid-${BOT_ID}`);
  });

  it("keeps the personal tab surface exactly as A0.1 left it", () => {
    // A1 adds a message action. It must not disturb the default-landing ordering that A0.1
    // established, or the app goes back to opening on Chat.
    expect(manifest.staticTabs?.map((t) => t.entityId)).toEqual(["btyHome", "conversations"]);
  });
});

describe("Teams app manifest — permission boundary", () => {
  it("introduces no Microsoft Graph surface", () => {
    /*
      THE PRIVACY CLAIM, CORRECTED (Slice A0).

      T1 asserted this as "`webApplicationInfo` and `authorization` are both absent". Half of that
      was wrong the moment it was written: `webApplicationInfo` is the TAB SSO BINDING — it names
      an Application ID URI so Teams can request a token for this app — and it carries no Graph
      permission of any kind. The marker for Graph/RSC is `authorization.resourceSpecific`.

      So the assertion now says what it always meant: no RSC block, no Graph scope, anywhere. The
      SSO binding is asserted positively above, as the required thing it is.
    */
    expect(manifest.authorization).toBeUndefined();
    const raw = JSON.stringify(manifest);
    expect(raw).not.toContain("resourceSpecific");
    for (const graphish of [
      "graph.microsoft.com",
      "ChannelMember.Read",
      "TeamMember.Read",
      "ChatMember.Read",
      "ChannelMessage.Read",
      "ChatMessage.Read",
      "Directory.Read",
      "User.Read.All",
    ]) {
      expect(raw).not.toContain(graphish);
    }
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
