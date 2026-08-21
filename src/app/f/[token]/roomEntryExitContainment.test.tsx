/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
vi.mock("./YouTubePlayer", () => ({ YouTubePlayer: () => null }));

import FoundryDocumentClient from "./FoundryDocumentClient";
import FoundryJoinClient from "./FoundryJoinClient";
import FoundryGuidanceClient from "./FoundryGuidanceClient";
import { sanitizeRoomReturn } from "@/lib/bty/foundry/roomReturn";

/**
 * R4-R5B2 — TRAINING ROOM ENTRY / EXIT CONTAINMENT.
 *
 * The room stays architecturally public; the learner stops having to know that. Two seams:
 *
 *   ENTRY — the first word of a video or PDF training was `FOUNDRY`, an internal system name, and
 *   the controls spoke of joining a system (`Join training` / `훈련 입장`) rather than opening a
 *   training. The guidance room had already been written in ordinary language and is protected
 *   here rather than rewritten.
 *
 *   EXIT — `roomReturn` proves the learner arrived from inside the BTY app, and it was being used
 *   to REMOVE their way out: `!roomReturn` gated the only prominent completion CTA, so the assigned
 *   employee ended on a small grey top-left link while an open-link stranger got a primary button.
 *   The guidance room ended at `/` — the site root — even when it was holding a validated return.
 *
 * WHAT THIS SLICE IS NOT. The learner may still be asked their name; the participant contract still
 * requires `display_name` and nothing here pretends the room recognises anyone. That seam is
 * measured, deferred, and must not be papered over with copy.
 */

const RETURN_EN = "/en/app?tab=foundry";
const RETURN_KO = "/ko/app?tab=foundry";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
beforeEach(() => window.history.replaceState({}, "", "/f/tok"));

const at = (search = "") => window.history.replaceState({}, "", "/f/tok" + search);
const withReturn = (r: string) => at("?return=" + encodeURIComponent(r));

function preJoinDoc() {
  return { content_type: "document", event: { title: "Close the Loop", status: "open" }, participant: null, document: null, stage: "pre_join", xp_status: "none" };
}
function preJoinVideo() {
  return { event: { title: "Close the Loop", status: "open" }, participant: null, training: null, stage: "pre_join", xp_status: "none" };
}
function preJoinGuidance() {
  return { content_type: "written_guidance", event: { title: "Confirm Understanding", status: "open" }, participant: null, guidance: null, stage: "pre_join", xp_status: "none", declared: false };
}
function awardedDoc(followUpDays: 7 | 30 | null = 7) {
  return {
    content_type: "document",
    event: { title: "Close the Loop", status: "open" },
    participant: { display_name: "Ari" },
    document: { page_count: 2, min_read_seconds: 15, intro: null, last_page: 2, distinct_pages_viewed: 2, active_read_ms: 999000, reading_complete: true, completion_prompt: null, shared_question: null },
    stage: "completed_awarded",
    xp_status: "awarded",
    follow_up_days: followUpDays,
  };
}
function awardedVideo(followUpDays: 7 | 30 | null = 7) {
  return {
    event: { title: "Close the Loop", status: "open" },
    participant: { display_name: "Ari" },
    training: { youtube_video_id: "abc", completion_prompt: null, shared_question: null },
    stage: "completed_awarded",
    xp_status: "awarded",
    follow_up_days: followUpDays,
  };
}
function awardedGuidance(followUpDays: 7 | 30 | null = 7) {
  return {
    content_type: "written_guidance",
    event: { title: "Confirm Understanding", status: "open" },
    participant: { display_name: "Ari" },
    guidance: { material_text: "m", completion_prompt: "p", shared_question: null },
    declared: true,
    stage: "completed_awarded",
    xp_status: "awarded",
    follow_up_days: followUpDays,
  };
}
function mock(snapshot: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/file")) return { ok: true, status: 200, json: async () => ({ ok: true, url: "blob:pdf", expires_in: 600 }) } as unknown as Response;
    if (url.includes("/api/auth/session")) return { ok: true, status: 200, json: async () => ({ user: null }) } as unknown as Response;
    if (url.includes("claim-xp")) return { ok: true, status: 200, json: async () => ({ ok: true, ...(snapshot as object) }) } as unknown as Response;
    return { ok: true, status: 200, json: async () => snapshot } as unknown as Response;
  }));
}
const body = () => document.body.textContent ?? "";

/** Render a room by family. Typed per client so the guidance prop stays required, not optional. */
function renderRoom(family: "video" | "document" | "guidance") {
  if (family === "video") return render(<FoundryJoinClient token="btyroom.a.b" />);
  if (family === "document") return render(<FoundryDocumentClient token="btyroom.a.b" />);
  return render(<FoundryGuidanceClient token="btyroom.a.b" contentType="written_guidance" />);
}

// ── T1 / T2 — entry vocabulary ──────────────────────────────────────────────────────────────────
describe("T1/T2 — video and PDF entry speak ordinary language", () => {
  for (const [label, Client, snap] of [
    ["video", FoundryJoinClient, preJoinVideo()],
    ["document", FoundryDocumentClient, preJoinDoc()],
  ] as const) {
    it(`${label} — no FOUNDRY, no join-a-system wording; TRAINING / What's your name? / Continue`, async () => {
      mock(snap);
      render(<Client token="btyroom.a.b" />);
      await waitFor(() => expect(screen.getByText("Close the Loop")).toBeTruthy());
      const text = body();
      expect(text, "the internal system name must not be the first word a learner reads").not.toContain("FOUNDRY");
      expect(text).not.toContain("Foundry");
      expect(text).not.toContain("Join training");
      expect(text).not.toContain("Enter your name to join.");
      expect(screen.getByText("TRAINING")).toBeTruthy();
      expect(screen.getByText("What's your name?")).toBeTruthy();
      expect(screen.getByText("Continue")).toBeTruthy();
    });

    it(`${label} — KO parity: 학습 / 이름을 입력해 주세요. / 계속하기, and no 파운드리 or 입장`, () => {
      const src = readFileSync(join(process.cwd(), `src/app/f/[token]/${label === "video" ? "FoundryJoinClient" : "FoundryDocumentClient"}.tsx`), "utf8");
      // The KO dictionary is asserted at source: these clients pick locale from `navigator.language`
      // in a mount effect, so a rendered KO assertion would be testing the shim, not the copy.
      const ko = src.slice(src.indexOf("  ko: {"));
      expect(ko).toContain('eyebrow: "학습"');
      expect(ko).toContain('enterName: "이름을 입력해 주세요."');
      expect(ko).toContain('join: "계속하기"');
      expect(ko).not.toContain('join: "입장"');
      expect(ko).not.toContain('join: "훈련 입장"');
    });
  }

  it("the name field still exists — this slice contains the seam, it does not pretend to solve it", async () => {
    mock(preJoinDoc());
    render(<FoundryDocumentClient token="btyroom.a.b" />);
    await waitFor(() => expect(screen.getByText("What's your name?")).toBeTruthy());
    expect(document.querySelector("input")).toBeTruthy();
  });
});

// ── T3 — guidance must not be degraded ──────────────────────────────────────────────────────────
describe("T3 — guidance entry stays exactly as it already was", () => {
  it("Guidance / What's your name? / Continue are intact", async () => {
    mock(preJoinGuidance());
    render(<FoundryGuidanceClient token="btyroom.a.b" contentType="written_guidance" />);
    await waitFor(() => expect(screen.getByText("Confirm Understanding")).toBeTruthy());
    expect(screen.getByText("Guidance")).toBeTruthy();
    expect(screen.getByText("What's your name?")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
    expect(body()).not.toContain("FOUNDRY");
  });

  it("live discussion keeps its own eyebrow", async () => {
    mock({ ...preJoinGuidance(), content_type: "live_discussion" });
    render(<FoundryGuidanceClient token="btyroom.a.b" contentType="live_discussion" />);
    await waitFor(() => expect(screen.getByText("Team discussion")).toBeTruthy());
  });
});

// ── T4 — back label ─────────────────────────────────────────────────────────────────────────────
describe("T4 — the return control is named for where it goes", () => {
  for (const [label, snap] of [
    ["video", preJoinVideo()],
    ["document", preJoinDoc()],
    ["guidance", preJoinGuidance()],
  ] as const) {
    it(`${label} — Back to Learn, never Back to Foundry`, async () => {
      withReturn(RETURN_EN);
      mock(snap);
      renderRoom(label);
      const back = await screen.findByTestId("room-back-to-foundry"); // testid is an INTERNAL id, unchanged
      expect(back.textContent).toContain("Back to Learn");
      expect(back.textContent).not.toContain("Foundry");
      expect(back.getAttribute("href")).toBe(RETURN_EN);
    });
  }

  it("KO back label carries no 파운드리, in all three rooms and the in-shell follow-up", () => {
    for (const rel of [
      "src/app/f/[token]/FoundryJoinClient.tsx",
      "src/app/f/[token]/FoundryDocumentClient.tsx",
      "src/app/f/[token]/FoundryGuidanceClient.tsx",
      "src/components/foundry/event-rooms/FoundryFollowUpResponse.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const strings = [...src.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
      expect(strings.filter((v) => v.includes("파운드리")), rel).toEqual([]);
      expect(strings.filter((v) => /Back to Foundry/.test(v)), rel).toEqual([]);
      expect(strings.some((v) => v.includes("학습으로 돌아가기")), rel).toBe(true);
    }
  });

  it("the label is TRUE: the repository's only producer of ?return= aims at the Learn tab", () => {
    // If a second producer ever aims somewhere else, "Back to Learn" becomes a lie — so this pins
    // the premise rather than the label.
    const req = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/FoundryRequiredLearning.tsx"), "utf8");
    expect(req).toContain("?return=${encodeURIComponent(`/${loc}/app?tab=foundry`)}");
    // Match the URL-BUILDING form, not the substring: the room clients discuss `?return=` in prose.
    const producers = execSync(
      "grep -rln 'return=\\${encodeURIComponent' src --include='*.tsx' --include='*.ts' | grep -v '\\.test\\.' || true",
      { encoding: "utf8" },
    ).split("\n").map((s) => s.trim()).filter(Boolean).filter((f) => !f.includes("legal/accept") && !f.includes("Comeback.tsx"));
    expect(producers).toEqual(["src/components/foundry/event-rooms/FoundryRequiredLearning.tsx"]);
  });
});

// ── T5 / T6 / T7 — assigned completion has a primary exit ───────────────────────────────────────
describe("T5/T6/T7 — an assigned learner finishes with a way back", () => {
  for (const [label, snap] of [
    ["video", awardedVideo()],
    ["document", awardedDoc()],
    ["guidance", awardedGuidance()],
  ] as const) {
    it(`${label} — a primary CTA whose href is the sanitized return, verbatim`, async () => {
      withReturn(RETURN_EN);
      mock(snap);
      renderRoom(label);
      const cta = (await screen.findByTestId("assigned-return")) as HTMLAnchorElement;
      expect(cta.tagName).toBe("A"); // a link, not a write
      expect(cta.getAttribute("href")).toBe(RETURN_EN); // not reconstructed
      expect(cta.textContent).toContain("Back to Learn");
      // No further action is demanded of someone who already finished.
      expect(screen.queryByTestId("guidance-claim-xp")).toBeNull();
      expect(screen.queryByTestId("claim-signin")).toBeNull();
    });

    it(`${label} — the href is exactly what sanitizeRoomReturn returns for a KO target`, async () => {
      withReturn(RETURN_KO);
      mock(snap);
      renderRoom(label);
      const cta = (await screen.findByTestId("assigned-return")) as HTMLAnchorElement;
      expect(cta.getAttribute("href")).toBe(sanitizeRoomReturn(RETURN_KO));
    });
  }

  it("guidance no longer falls to the generic site root when it holds a validated return", async () => {
    withReturn(RETURN_EN);
    mock(awardedGuidance());
    render(<FoundryGuidanceClient token="btyroom.a.b" contentType="written_guidance" />);
    const cta = (await screen.findByTestId("assigned-return")) as HTMLAnchorElement;
    expect(cta.getAttribute("href")).not.toBe("/");
  });
});

// ── T8 — follow-up truth ────────────────────────────────────────────────────────────────────────
describe("T8 — the follow-up is explained to the person it applies to", () => {
  for (const [label, mk] of [
    ["video", awardedVideo],
    ["document", awardedDoc],
    ["guidance", awardedGuidance],
  ] as const) {
    it(`${label} — a 7-day checkpoint is stated on the awarded path`, async () => {
      withReturn(RETURN_EN);
      mock(mk(7));
      renderRoom(label);
      const line = await screen.findByTestId("awarded-followup");
      expect(line.textContent).toBe("This training includes a 7-day follow-up.");
    });

    it(`${label} — 30-day is stated as 30, not normalised`, async () => {
      withReturn(RETURN_EN);
      mock(mk(30));
      renderRoom(label);
      expect((await screen.findByTestId("awarded-followup")).textContent).toContain("30-day");
    });

    it(`${label} — NO checkpoint fabricates nothing`, async () => {
      withReturn(RETURN_EN);
      mock(mk(null));
      renderRoom(label);
      await screen.findByTestId("assigned-return");
      expect(screen.queryByTestId("awarded-followup")).toBeNull();
      expect(body()).not.toContain("follow-up");
    });

    it(`${label} — nothing about signing in or securing XP leaks onto the awarded path`, async () => {
      withReturn(RETURN_EN);
      mock(mk(7));
      renderRoom(label);
      await screen.findByTestId("awarded-followup");
      const text = body();
      // These belong to `terminalIdentityCopy`'s claimable branch and are untrue here.
      expect(text).not.toContain("Sign in so we can connect that follow-up to you.");
      expect(text).not.toContain("Your 10 Core XP will be saved too.");
      // And nothing invents timing the domain refuses to promise.
      expect(text).not.toMatch(/overdue|due in|days left|remind/i);
    });
  }
});

// ── T9 — open-link preservation ─────────────────────────────────────────────────────────────────
describe("T9 — the open-link ending is untouched", () => {
  for (const [label, Client, snap] of [
    ["video", FoundryJoinClient, awardedVideo()],
    ["document", FoundryDocumentClient, awardedDoc()],
  ] as const) {
    it(`${label} — with NO return, the existing handoff panel and destination still render`, async () => {
      at(""); // open-link entry
      mock(snap);
      render(<Client token="btyroom.a.b" />);
      await waitFor(() => expect(screen.getByTestId("saved-to-bty")).toBeTruthy());
      const cont = screen.getByTestId("continue-to-bty") as HTMLAnchorElement;
      expect(cont.getAttribute("href")).toBe("/en/app?tab=foundry&view=my-learning");
      expect(cont.textContent).toBe("Continue to BTY");
      // The assigned exit is assigned-only: a visitor with no app origin is not sent "back" anywhere.
      expect(screen.queryByTestId("assigned-return")).toBeNull();
      expect(screen.queryByTestId("room-back-to-foundry")).toBeNull();
    });
  }

  it("guidance with no return keeps its previous root destination and label", async () => {
    at("");
    mock(awardedGuidance());
    render(<FoundryGuidanceClient token="btyroom.a.b" contentType="written_guidance" />);
    const cta = (await screen.findByTestId("continue-to-bty")) as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/");
    expect(cta.textContent).toContain("Continue to BTY");
  });
});

// ── T10 — the sanitizer still refuses everything it used to ─────────────────────────────────────
describe("T10 — return containment is unchanged", () => {
  it("rejects external, protocol-relative, backslash and non-app targets", () => {
    for (const bad of [
      "https://evil.com/x", "//evil.com", "http://evil.com", "\\\\evil.com",
      "/en/bty-arena", "/ko/center", "evil.com", "/", "/en/appfoo", "javascript:alert(1)",
    ]) {
      expect(sanitizeRoomReturn(bad), bad).toBeNull();
    }
  });

  it("accepts only the app shell, in both locales", () => {
    expect(sanitizeRoomReturn("/en/app")).toBe("/en/app");
    expect(sanitizeRoomReturn(RETURN_KO)).toBe(RETURN_KO);
    expect(sanitizeRoomReturn("/en/app/anything")).toBe("/en/app/anything");
  });

  it("a rejected return produces NO assigned exit and NO back control", async () => {
    withReturn("https://evil.com/steal");
    mock(awardedVideo());
    render(<FoundryJoinClient token="btyroom.a.b" />);
    await waitFor(() => expect(screen.getByTestId("saved-to-bty")).toBeTruthy());
    expect(screen.queryByTestId("assigned-return")).toBeNull();
    expect(screen.queryByTestId("room-back-to-foundry")).toBeNull();
    expect(body()).not.toContain("evil.com");
  });

  it("the sanitizer source is byte-identical to the shipped contract", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/bty/foundry/roomReturn.ts"), "utf8");
    expect(src).toContain('if (!p.startsWith("/")) return null;');
    expect(src).toContain('if (p.includes("://") || p.includes("//") || p.includes("\\\\")) return null;');
    expect(src).toContain('if (!/^\\/(en|ko)\\/app(\\?|\\/|$)/.test(p)) return null;');
  });
});

// ── T11 — no architecture changed ───────────────────────────────────────────────────────────────
describe("T11 — this slice changed copy and navigation only", () => {
  /*
    ANCHORED TO THIS SLICE'S OWN DIFF, not to the working tree. The repository has twice shipped a
    `git diff --name-only HEAD` scope guard that passed vacuously on a clean tree and then failed an
    unrelated later slice (`legacyPortalContainment` T6/T6b, re-anchored in R4-R5A;
    `managerResponsiveLayout` test 11, re-anchored in R4-R5B1). This compares against the parent of
    the working tree instead, so it measures real changed files and cannot pass on an empty diff.
  */
  /*
    RE-ANCHORED TO THIS SLICE'S OWN COMMIT (R4-R5C3A1).

    R4-R5B2 wrote this as `git diff HEAD~1` — better than the two `git diff HEAD` guards it was
    reacting to, but still MOVING: `HEAD~1` means "the previous commit", so the very next slice
    makes this test measure someone else's diff. R4-R5C3A1 (which legitimately adds a migration
    and touches API routes) is that next slice, and it tripped here.

    `e71b3c84` IS R4-R5B2. Pinning it makes the assertion measure the diff it is named for, the
    same repair applied to `legacyPortalContainment` T6/T6b and `managerResponsiveLayout` test 11.
    Third time: a scope guard must name a commit, never a relative ref.
  */
  const SLICE_COMMIT = "e71b3c84";
  const changed = execSync(`git show --pretty=format: --name-only ${SLICE_COMMIT}`, { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean);

  it("the comparison is non-vacuous", () => {
    expect(changed.length).toBeGreaterThan(0);
  });

  it("no migration, no schema, no RPC, no API route was touched", () => {
    for (const f of changed) {
      expect(f.startsWith("supabase/"), f).toBe(false);
      expect(f.includes("/api/"), f).toBe(false);
      expect(f.endsWith(".sql"), f).toBe(false);
      expect(f.includes("middleware"), f).toBe(false);
    }
  });

  it("the join-token payload and participant contract are untouched at source", () => {
    const tok = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/foundry-room-token.ts"), "utf8");
    expect(tok).toContain("type: \"foundry_room\";");
    expect(tok).toContain("eventId: string;");
    expect(tok).not.toMatch(/userId|authUserId|assignmentId|displayName/);
    const sess = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/participant-session.ts"), "utf8");
    expect(sess).toContain("participant_session_token_hash");
  });

  it("the rooms still demand a name — no prefill, no profile read, no identity smuggling", () => {
    for (const rel of ["FoundryJoinClient", "FoundryDocumentClient", "FoundryGuidanceClient"]) {
      const src = readFileSync(join(process.cwd(), `src/app/f/[token]/${rel}.tsx`), "utf8");
      expect(src).toMatch(/name_required|nameError|enterName/);
      expect(src, rel).not.toMatch(/arena_profiles|full_name|user_metadata/);
      expect(src, rel).not.toMatch(/defaultValue=\{.*name/);
    }
  });
});
