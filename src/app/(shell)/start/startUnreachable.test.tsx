/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { StartNavySurface, StartUnreachableSurface } from "./StartNavySurface";

/**
 * R4-R4B-R1 — THE LAUNCH MUST BE ABLE TO END.
 *
 * `/start` renders `<StartNavySurface />` for as long as `useAuth().loading` is true, and `loading`
 * clears only inside a `finally`. Every boot request was unbounded, so a request that never settled
 * never cleared it: the Founder's app sat on the quiet navy frame with no error and nothing to
 * press. The failure was swallowed by never arriving.
 *
 * What these pin is the DISTINCTION the repair rests on. "We could not reach BTY" is not "you are
 * signed out" — one is the absence of an answer, the other is an answer — and the surface must
 * never say the second when it only knows the first.
 */

afterEach(cleanup);

describe("R4-R4B-R1 · 5/8 · an expired bound produces something to press", () => {
  it("5 — the unreachable surface offers a retry, not an orb", () => {
    render(<StartUnreachableSurface locale="en" onRetry={() => {}} />);
    expect(screen.getByTestId("start-unreachable")).toBeTruthy();
    expect(screen.getByTestId("start-unreachable-retry").textContent).toBe("Retry");
    expect(screen.getByText("Couldn’t reach BTY.")).toBeTruthy();
  });

  it("6 — pressing retry re-runs the caller's session resolution", () => {
    const onRetry = vi.fn();
    render(<StartUnreachableSurface locale="en" onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId("start-unreachable-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("while retrying, the control says so and cannot be double-fired", () => {
    const onRetry = vi.fn();
    render(<StartUnreachableSurface locale="en" onRetry={onRetry} retrying />);
    const btn = screen.getByTestId("start-unreachable-retry") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("Retrying…");
    fireEvent.click(btn);
    expect(onRetry).not.toHaveBeenCalled();
  });

  /*
    THE COPY RULE, AS A TEST. A first-time reader must be able to answer three questions without
    anyone explaining the app to them: what happened, what do I do, and is my account still there.
    The surface answered the first two and left the third to fear — which is what sends a person
    to sign in again on their own.
  */
  it("it answers all three questions a person actually has", () => {
    render(<StartUnreachableSurface locale="en" onRetry={() => {}} />);
    expect(screen.getByText("Couldn’t reach BTY.")).toBeTruthy(); // what happened
    expect(screen.getByText("Your account is safe. Check your connection.")).toBeTruthy(); // safe + what to do
    expect(screen.getByTestId("start-unreachable-retry").textContent).toBe("Retry"); // what happens next
  });

  it("it speaks plainly — no engineering vocabulary reaches the person", () => {
    render(<StartUnreachableSurface locale="en" onRetry={() => {}} />);
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const jargon of [
      "javascript",
      "webview",
      "hydrat",
      "runtime",
      "oauth",
      "callback",
      "token",
      "timeout",
      "timed out",
      "error",
      "network request",
    ]) {
      expect(body, `must not say "${jargon}"`).not.toContain(jargon);
    }
  });

  it("4 — it never claims the person is signed out or asks them to log in", () => {
    render(<StartUnreachableSurface locale="en" onRetry={() => {}} />);
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const bad of ["sign in", "signed out", "log in", "login", "session expired", "unauthorized"]) {
      expect(body, `must not say "${bad}"`).not.toContain(bad);
    }
  });

  it("8 — the plain navy surface is unchanged, so a normal boot looks exactly as before", () => {
    render(<StartNavySurface />);
    expect(screen.getByText("Better Than Yesterday")).toBeTruthy();
    expect(screen.queryByTestId("start-unreachable")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("R4-R4B-R1 · 9 · EN / KO", () => {
  it("Korean carries the same two ideas and no sign-out language", () => {
    render(<StartUnreachableSurface locale="ko" onRetry={() => {}} />);
    expect(screen.getByText("BTY에 연결하지 못했습니다.")).toBeTruthy();
    expect(screen.getByTestId("start-unreachable-retry").textContent).toBe("다시 시도");
    expect(screen.getByText("계정은 그대로 있습니다. 연결 상태를 확인해 주세요.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("로그인");
  });

  it("the retrying label is translated too", () => {
    render(<StartUnreachableSurface locale="ko" onRetry={() => {}} retrying />);
    expect(screen.getByTestId("start-unreachable-retry").textContent).toBe("다시 시도하는 중…");
  });
});

describe("R4-R4B-R1 · 10 · the repair clears nothing", () => {
  const files = [
    "src/app/(shell)/start/StartNavySurface.tsx",
    "src/app/(shell)/start/page.client.tsx",
    "src/lib/auth/boundedSessionRead.ts",
  ];

  it("no boot surface added a sign-out or cookie clear", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const forbidden of ["signOut(", "document.cookie", "logout"]) {
        expect(src, `${f} must not ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("the UNREACHABLE branch specifically never routes to login", () => {
    /*
      `/start` legitimately sends an unauthenticated visitor to login — that is the `!user` path and
      it is correct, because there the server ANSWERED. The first version of this test forbade the
      string file-wide and so failed on behaviour that should exist. What must never route is the
      branch that only knows we could not reach BTY.
    */
    const src = readFileSync("src/app/(shell)/start/page.client.tsx", "utf8");
    const start = src.indexOf("if (unreachable)");
    const end = src.indexOf("if (loading) return <StartNavySurface />");
    const branch = src.slice(start, end);
    expect(branch.length).toBeGreaterThan(0);
    for (const forbidden of ["/bty/login", "router.replace", "location.assign", "signOut"]) {
      expect(branch, `the unreachable branch must not ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("`unreachable` is rendered BEFORE the loading frame, so the bound can actually end the wait", () => {
    const src = readFileSync("src/app/(shell)/start/page.client.tsx", "utf8");
    const u = src.indexOf("if (unreachable)");
    const l = src.indexOf("if (loading) return <StartNavySurface />");
    expect(u).toBeGreaterThan(-1);
    expect(l).toBeGreaterThan(-1);
    expect(u, "unreachable must be checked before loading").toBeLessThan(l);
  });
});
