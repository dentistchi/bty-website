/**
 * VALIDATOR_ARCHITECTURE_V1 §3 — semantic evaluation; temperature 0.2; no user identity in payload.
 */
import { fetchJson } from "@/lib/read-json";
import type { Layer2ModelResult, PatternContextForModel } from "./types";
import { VALIDATOR_CONFIDENCE_THRESHOLD } from "./routeLayer2Outcome";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const TEMPERATURE = 0.2;

type OpenAIChatResp = {
  choices?: { message?: { content?: string | null } }[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeCriterion(raw: unknown): { outcome: "pass" | "fail" | "ambiguous"; confidence: number } {
  if (raw === null || typeof raw !== "object") {
    return { outcome: "ambiguous", confidence: 0 };
  }
  const o = raw as Record<string, unknown>;
  const oc = o.outcome;
  const conf = typeof o.confidence === "number" ? o.confidence : Number.NaN;
  const outcome =
    oc === "pass" || oc === "fail" || oc === "ambiguous" ? oc : "ambiguous";
  return { outcome, confidence: clamp01(conf) };
}

export function parseLayer2Json(content: string): Layer2ModelResult | null {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== "object") return null;
  const j = obj as Record<string, unknown>;
  return {
    re_entry_direction: normalizeCriterion(j.re_entry_direction),
    external_measurability: normalizeCriterion(j.external_measurability),
    non_cosmetic: normalizeCriterion(j.non_cosmetic),
  };
}

export type Layer2SemanticInput = {
  pattern: PatternContextForModel;
  who: string;
  what: string;
  how: string;
  when: string;
  rawText: string;
};

/**
 * Calls the configured model with contract text + pattern context only (no user id / email / snapshot).
 */
export async function runLayer2Semantic(input: Layer2SemanticInput): Promise<{
  ok: true;
  result: Layer2ModelResult;
  modelId: string;
} | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return { ok: false, error: "missing_openai_key" };
  }

  const model = (process.env.BTY_VALIDATOR_OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  const systemPrompt = [
    "You are a contract semantic validator for structured action commitments.",
    "Definitions: Action means measurable change in external reality; not solely internal processing or planning.",
    "Non-goals: do not rewrite the contract, suggest alternatives, or judge the user morally.",
    `Answer the three criteria with outcome pass, fail, or ambiguous and confidence in [0,1].`,
    `Use confidence >= ${VALIDATOR_CONFIDENCE_THRESHOLD} only when the text clearly supports your label.`,
    "Output a single JSON object with keys re_entry_direction, external_measurability, non_cosmetic.",
    "Each value must be {\"outcome\":\"pass|fail|ambiguous\",\"confidence\":number}.",
    "No other keys. No rationale strings.",
  ].join(" ");

  const userPayload = {
    pattern_context: input.pattern,
    contract: {
      who: input.who,
      what: input.what,
      how: input.how,
      when: input.when,
      raw_text: input.rawText,
    },
    criteria_questions: {
      re_entry_direction:
        "Does the action move toward the pattern family's re-entry direction relative to its avoided reality, not away, compensate abstractly, or substitute reflection for contact?",
      external_measurability:
        "Does the action produce measurable change in external reality rather than solely internal narrative or planning?",
      non_cosmetic:
        "Does the action include real relational, reputational, or logistical cost appropriate to the band, not purely symbolic?",
    },
  };

  const r = await fetchJson<OpenAIChatResp>(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: TEMPERATURE,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
    }),
  });

  if (!r.ok) {
    return { ok: false, error: "openai_request_failed" };
  }

  const content = r.json?.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = parseLayer2Json(content);
  if (!parsed) {
    return { ok: false, error: "openai_invalid_json" };
  }

  return { ok: true, result: parsed, modelId: model };
}

export const VALIDATOR_MODEL_TEMPERATURE = TEMPERATURE;
