/**
 * BTY FOUNDRY LAB — Layer C model critic (M0, ADVISORY).
 *
 * Off unless `--critic` is passed. It reads a program that ALREADY passed the deterministic
 * layers and returns a structured, versioned opinion per Layer B dimension. It can never change
 * `valid`, a Layer A gate or a Layer B gate — it is stored beside them, never merged into them.
 * It uses the same runtime provider as the run, so it cannot introduce a paid call on its own.
 */
import { getLlmClient, getLlmModel } from "@/lib/bty/llm/client";
import { LAYER_B_DIMENSIONS, type LayerBDimension } from "./evaluate";
import type { BenchmarkCase } from "./manifest";
import type { GenerationOutcome } from "./adapter";

export const CRITIC_VERSION = "foundry_arena_critic_v1";

export type CriticResult = {
  critic_version: string;
  advisory: true;
  model: string;
  ok: boolean;
  error: string | null;
  dimensions: Partial<Record<LayerBDimension, { verdict: "pass" | "concern"; note: string }>>;
  elapsed_ms: number;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dimensions"],
  properties: {
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: [...LAYER_B_DIMENSIONS],
      properties: Object.fromEntries(
        LAYER_B_DIMENSIONS.map((d) => [
          d,
          {
            type: "object",
            additionalProperties: false,
            required: ["verdict", "note"],
            properties: { verdict: { type: "string", enum: ["pass", "concern"] }, note: { type: "string" } },
          },
        ]),
      ),
    },
  },
} as const;

export function criticMessages(c: BenchmarkCase, o: GenerationOutcome) {
  const program = (o.proposal?.elements ?? []).map((e) => `[${e.kind}] ${e.content}`).join("\n");
  return [
    {
      role: "system" as const,
      content:
        "You review workplace training programs for a manager. Judge each dimension as pass or concern, with one short note. " +
        "Do not invent facts about the workplace; judge only what is written. Return JSON only.",
    },
    {
      role: "user" as const,
      content: `Manager's intent: ${c.answers.problem}\nBehaviour: ${c.answers.observableBehavior}\nWhen: ${c.answers.recurringMoment}\n\nProgram title: ${o.proposal?.displayTitle}\n${program}\n\nDimensions: ${LAYER_B_DIMENSIONS.join(", ")}.`,
    },
  ];
}

export async function runCritic(c: BenchmarkCase, o: GenerationOutcome): Promise<CriticResult> {
  const t0 = Date.now();
  const base = { critic_version: CRITIC_VERSION, advisory: true as const, model: getLlmModel() };
  try {
    const completion = await getLlmClient().chat.completions.create({
      model: getLlmModel(),
      messages: criticMessages(c, o),
      temperature: 0,
      max_tokens: 900,
      response_format: { type: "json_schema", json_schema: { name: "foundry_arena_critic_v1", strict: true, schema: SCHEMA } },
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as { dimensions: CriticResult["dimensions"] };
    return { ...base, ok: true, error: null, dimensions: parsed.dimensions ?? {}, elapsed_ms: Date.now() - t0 };
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "critic_failed", dimensions: {}, elapsed_ms: Date.now() - t0 };
  }
}
