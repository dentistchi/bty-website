/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState, useRef } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useSuggestedName } from "./useSuggestedName";

/**
 * R4-R5C7A — what the learner experiences, through the REAL hook.
 *
 * The whole repair rests on one distinction: PREFILL IS NOT SUBMISSION. The field may arrive
 * filled, but the value that reaches `foundry_event_participants.display_name` is whatever the
 * learner leaves in it — which is what preserves the disclosure decision they make today.
 */

const ROOM = join(process.cwd(), "src/app/f/[token]");
const read = (f: string) => readFileSync(join(ROOM, f), "utf8");
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CLIENTS = ["FoundryJoinClient.tsx", "FoundryDocumentClient.tsx", "FoundryGuidanceClient.tsx"];

/** The pre-join field exactly as the rooms wire it. */
function JoinField({ suggested }: { suggested?: string | null }) {
  const [name, setName] = useState("");
  const touched = useRef(false);
  useSuggestedName(suggested, name, setName, touched);
  return (
    <div>
      <input
        aria-label="name"
        value={name}
        onChange={(e) => {
          touched.current = true;
          setName(e.target.value);
        }}
      />
      <span data-testid="submitted">{name.trim()}</span>
    </div>
  );
}
const field = () => screen.getByLabelText("name") as HTMLInputElement;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("T7/T6/T3 — what arrives in the field", () => {
  it("T7 — a signed-in learner with a name finds the field already filled", () => {
    render(<JoinField suggested="Jonathan Smith" />);
    expect(field().value).toBe("Jonathan Smith");
  });

  it("T6 — an anonymous visitor gets an empty field and can still join", () => {
    render(<JoinField suggested={null} />);
    expect(field().value).toBe("");
    fireEvent.change(field(), { target: { value: "Ari" } });
    expect(screen.getByTestId("submitted").textContent).toBe("Ari");
  });

  it("T3 — a signed-in account with no provider name gets an empty field", () => {
    render(<JoinField suggested={undefined} />);
    expect(field().value).toBe("");
  });

  it("a whitespace-only suggestion is not a prefill", () => {
    render(<JoinField suggested="   " />);
    expect(field().value).toBe("");
  });
});

describe("T8/T10 — the learner's value is the authority", () => {
  it("T8 — an edited name is what gets submitted; the suggestion never resurfaces", () => {
    render(<JoinField suggested="Jonathan Smith" />);
    fireEvent.change(field(), { target: { value: "Jon" } });
    expect(screen.getByTestId("submitted").textContent).toBe("Jon");
    expect(screen.getByTestId("submitted").textContent).not.toBe("Jonathan Smith");
  });

  it("T10 — a snapshot arriving late never lands on top of typing", () => {
    // The pre-join screen can render BEFORE the snapshot resolves, so this is the real sequence.
    const { rerender } = render(<JoinField suggested={null} />);
    fireEvent.change(field(), { target: { value: "typed first" } });
    rerender(<JoinField suggested="Jonathan Smith" />);
    expect(field().value).toBe("typed first");
  });

  it("clearing the field is a decision, not an invitation to refill it", () => {
    const { rerender } = render(<JoinField suggested="Jonathan Smith" />);
    expect(field().value).toBe("Jonathan Smith");
    fireEvent.change(field(), { target: { value: "" } });
    rerender(<JoinField suggested="Jonathan Smith" />);
    expect(field().value).toBe("");
  });

  it("the suggestion is a default, not a synchronised value", () => {
    const { rerender } = render(<JoinField suggested="First Name" />);
    expect(field().value).toBe("First Name");
    rerender(<JoinField suggested="Changed Later" />);
    expect(field().value).toBe("First Name");
  });
});

describe("T9 — a suggestion alone joins nothing", () => {
  it("the hook performs no I/O of any kind", () => {
    const c = code(read("useSuggestedName.ts"));
    expect(c).not.toMatch(/fetch\(|post\(|localStorage|sessionStorage|document\.cookie/);
  });

  it("join is still the learner pressing Continue — the payload reads the field, not the suggestion", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).toMatch(/display_name: name\.trim\(\)/);
      expect(c, f).not.toMatch(/display_name:\s*(snapshot\?\.)?suggested_name/);
      // No effect auto-joins when a suggestion exists.
      expect(c, f).not.toMatch(/suggested_name[^;]*onJoin|onJoin[^;]*suggested_name/);
    }
  });
});

describe("T14/T15/T16 — three rooms, one contract and one copy", () => {
  it("T14 — all three seed through the same shared hook, with the same arguments", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).toContain('from "./useSuggestedName"');
      expect(c, f).toContain("useSuggestedName(snapshot?.suggested_name, name, setName, nameTouched)");
      expect(c, f).toContain("nameTouched.current = true;");
    }
  });

  it("T15/T16 — the field says what it is for, in both languages", () => {
    for (const f of CLIENTS) {
      const c = code(read(f));
      expect(c, f).toContain('enterName: "Name shown for this training"');
      expect(c, f).toContain('enterName: "이 학습에 표시할 이름"');
      /*
        Scope the check to the `enterName` KEY. A whole-file scan flagged
        `nameError: "이름을 입력해 주세요."` — the validation message, which correctly still asks
        for a name when the field is empty. That is a different string doing a different job.
      */
      const enterNames = [...c.matchAll(/enterName: "((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
      expect(enterNames.length, `${f}: en + ko`).toBe(2);
      expect(enterNames.filter((v) => /What's your name|이름이 어떻게 되나요|이름을 입력해 주세요/.test(v))).toEqual([]);
    }
  });

  it("the copy explains nothing about auth", () => {
    const forbidden = /account name|Google|profile name|legal name|verified name|계정 이름|구글/i;
    for (const f of CLIENTS) {
      const strings = [...code(read(f)).matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
      expect(strings.filter((v) => forbidden.test(v)), f).toEqual([]);
    }
  });
});

describe("T17 — the suggestion stays on the pre-join screen", () => {
  it("it is never put in a URL, token, cookie, storage or log", () => {
    for (const f of [...CLIENTS, "useSuggestedName.ts"]) {
      const c = code(read(f));
      expect(c, f).not.toMatch(/suggested_name[^\n]*(localStorage|sessionStorage|console\.|URLSearchParams|cookie)/);
    }
    expect(code(readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/foundry-room-token.ts"), "utf8")))
      .not.toMatch(/suggest/i);
  });

  it("no Host, roster or observation projection carries it", () => {
    const dir = join(process.cwd(), "src/lib/bty/foundry/events");
    for (const f of ["foundryHostHistoryService.ts", "hostAttentionService.ts", "foundrySharedReviewService.ts", "observationSubject.ts"]) {
      expect(code(readFileSync(join(dir, f), "utf8")), f).not.toMatch(/suggest/i);
    }
  });

  it("it is emitted ONLY when there is no participant to prefill for", () => {
    for (const f of ["foundryTrainingService.ts", "foundryDocumentService.ts", "foundryGuidanceService.ts"]) {
      const c = code(readFileSync(join(process.cwd(), "src/lib/bty/foundry/events", f), "utf8"));
      expect(c, f).toContain("snap.participant ? snap : { ...snap, suggested_name: suggestedName ?? null }");
    }
  });
});

describe("T2/T12 — server-derived, and only ever from the CURRENT account", () => {
  const ROUTES = [
    "src/app/api/bty/foundry/public/[token]/route.ts",
    "src/app/api/bty/foundry/public/[token]/doc/snapshot/route.ts",
    "src/app/api/bty/foundry/public/[token]/guidance/snapshot/route.ts",
  ];
  const routeCode = (r: string) =>
    readFileSync(join(process.cwd(), r), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("T2 — the suggestion comes from the server's own auth read, never from the request", () => {
    for (const r of ROUTES) {
      const c = routeCode(r);
      expect(c, r).toContain("await supa.auth.getUser()");
      expect(c, r).toContain("resolveSuggestedTrainingName(user?.user_metadata");
      // Nothing is taken from the client to produce it.
      expect(c, r).not.toMatch(/body\?\.\s*suggested|searchParams\.get\("suggested|headers\.get\("x-.*name/i);
    }
  });

  it("T2 — the routes stay PUBLIC: a failed auth read degrades to no suggestion, never a 401", () => {
    for (const r of ROUTES) {
      const c = routeCode(r);
      expect(c, r).toContain("suggestedName = null;");
      expect(c, r).not.toMatch(/\b401\b|unauthenticated/);
    }
  });

  it("T12 — the suggestion is derived from the signed-in user, so a switched account cannot inherit A's", () => {
    /*
      There is no participant lookup in this path at all: the value is computed from the CURRENT
      `user` object. C3A1 separately drops participant A to null for account B (asserted below),
      so B lands on pre-join and sees a suggestion that can only have come from B's own metadata.
    */
    for (const r of ROUTES) {
      const c = routeCode(r);
      // The CALL site, not the import — both mention the resolver by name.
      const line =
        c.split("\n").find((l) => l.includes("resolveSuggestedTrainingName(") && !l.trimStart().startsWith("import")) ?? "";
      expect(line, r).toContain("user?.user_metadata");
      expect(line, r).not.toMatch(/participant|display_name/);
    }
    const svc = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/foundryEventService.ts"), "utf8");
    expect(svc).toContain("isParticipantAccountCompatible(resolvedParticipant?.user_id, authUserId)");
  });

  it("T11 — an existing participant still bypasses the prompt entirely", () => {
    for (const f of ["foundryTrainingService.ts", "foundryDocumentService.ts", "foundryGuidanceService.ts"]) {
      const c = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events", f), "utf8");
      // A snapshot WITH a participant is returned untouched — no suggestion attached.
      expect(c, f).toContain("snap.participant ? snap : {");
    }
  });
});
