/**
 * Pilot shadow — READ-ONLY guarantee + PROVIDER hard block (matrix §12: READ ONLY 25–28).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  makeSupabaseReadOnlyReaders,
  wrapReadOnly,
  PilotReadOnlyViolation,
} from "@/lib/bty/today-intelligence/pilotShadow";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNTH_USER_ID } from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";

/** Fake client whose mutators are spies; readers only ever call the read chain. */
function makeMutationSpyClient() {
  const spies = { insert: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), rpc: vi.fn() };
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    not: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: null }),
    then: (r: (v: { data: unknown[] }) => unknown) => Promise.resolve({ data: [] }).then(r),
    insert: spies.insert,
    update: spies.update,
    upsert: spies.upsert,
    delete: spies.delete,
  });
  const client = { from: () => builder, rpc: spies.rpc } as unknown as SupabaseClient;
  return { client, spies };
}

const HARNESS_FILES = [
  "src/lib/bty/today-intelligence/pilotShadow.ts",
  "src/lib/bty/today-intelligence/pilotShadowConfig.ts",
  "scripts/today-mirror-pilot-shadow.ts",
];
const PROVIDER_TOKENS = [
  "getLlmClient",
  "isLlmAvailable",
  "todayMirrorGenerate",
  "todayMirrorPrompt",
  "openai",
  "OpenAI",
  "gemini",
  "safe-mirror",
  "safeMirror",
  "mentor",
  "chat.completions",
];

describe("pilot read-only + provider hard block", () => {
  it("25. no mutation dependency exists in the harness reader interface", () => {
    const { client } = makeMutationSpyClient();
    const readers = makeSupabaseReadOnlyReaders(client) as unknown as Record<string, unknown>;
    for (const m of ["insert", "update", "upsert", "delete", "rpc"]) expect(readers[m]).toBeUndefined();
    // The read-only wrapper actively blocks mutation entry points.
    const ro = wrapReadOnly(client);
    expect(() => (ro as SupabaseClient).from("t").insert({})).toThrow(PilotReadOnlyViolation);
    expect(() => (ro as unknown as { rpc: () => unknown }).rpc()).toThrow(PilotReadOnlyViolation);
  });

  it("26. mutation spy remains zero after both readers run", async () => {
    const { client, spies } = makeMutationSpyClient();
    const readers = makeSupabaseReadOnlyReaders(client);
    await readers.readCompletionsForLatency(SYNTH_USER_ID);
    await readers.readTopSignature(SYNTH_USER_ID);
    for (const s of Object.values(spies)) expect(s).not.toHaveBeenCalled();
  });

  it("27. no provider dependency exists (static import scan of harness sources)", () => {
    for (const f of HARNESS_FILES) {
      const src = readFileSync(f, "utf8");
      const importLines = src.split("\n").filter((l) => /^\s*import\b/.test(l) || /\bimport\(/.test(l));
      for (const token of PROVIDER_TOKENS) {
        expect(importLines.join("\n"), `${f} must not import provider token "${token}"`).not.toContain(token);
      }
    }
  });

  it("28. provider spy remains zero — the LLM client is never constructed by the harness", async () => {
    // Spy the provider client factory; if the harness path touched it, this would fire.
    const llm = await import("@/lib/bty/llm/client");
    const spy = vi.spyOn(llm, "getLlmClient");
    const { client } = makeMutationSpyClient();
    const readers = makeSupabaseReadOnlyReaders(client);
    await readers.readCompletionsForLatency(SYNTH_USER_ID);
    await readers.readTopSignature(SYNTH_USER_ID);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
