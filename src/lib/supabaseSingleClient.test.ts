import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * ONE browser Supabase client, shared by every consumer (Slice A0-RUNTIME2, §5).
 *
 * The Teams tab mints its session once and applies it with `setSession` to the client returned by
 * `getSupabase()`. That only reaches every consumer because `getSupabase()` is a module-level
 * SINGLETON and nothing else constructs a client. A component that built its own would silently
 * get an ANONYMOUS client — no `auth.uid()`, RLS returning nothing — and would fail as an empty
 * list rather than as an error, which is the hardest kind of defect to see.
 *
 * A0-RUNTIME2 measured 0 such components. This keeps it at 0: adding one has to be a deliberate
 * act that fails here first.
 */
const SEARCH_DIRS = ["src/components", "src/features"];

function grep(pattern: string): string[] {
  try {
    return execFileSync(
      "grep",
      ["-rEl", pattern, ...SEARCH_DIRS, "--include=*.ts", "--include=*.tsx"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((f) => !/\.test\.tsx?$/.test(f));
  } catch {
    return []; // grep exits non-zero when nothing matches
  }
}

describe("no component constructs its own Supabase client", () => {
  it("only the shared singleton exists — every consumer sees the same auth.uid()", () => {
    expect(grep("createBrowserClient\\(")).toEqual([]);
    expect(grep("createClient\\(")).toEqual([]);
  });
});
