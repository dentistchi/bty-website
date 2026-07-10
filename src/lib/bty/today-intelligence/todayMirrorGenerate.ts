/**
 * BTY Today AI Mirror — provider adapter + generation pipeline (service layer, shadow-only).
 *
 * Pipeline: analysis → prompt → LLM (structured JSON) → coerce → deterministic post-fix →
 * validate → shadow result. FAIL QUIET on any error/timeout/invalid/violation: return no
 * response (never a fabricated motivational fallback). Reuses the existing OpenAI-compatible
 * client (src/lib/bty/llm/client). The model owns wording only; lens, evidence ids, and the
 * open-contract invariant are fixed deterministically here.
 *
 * NOT wired to any route/UI. No raw evidence or prompt-with-evidence is logged.
 */
import { getLlmClient, getLlmModel, isLlmAvailable } from "@/lib/bty/llm/client";
import type {
  RecentTodayMirrorContext,
  TodayMirrorAnalysis,
  TodayMirrorEvidencePacket,
  TodayMirrorResponse,
} from "@/domain/daily/todayMirror.types";
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import { noveltySignatureOf } from "@/domain/daily/todayMirrorNovelty";
import { validateMirrorResponse } from "@/lib/bty/today-intelligence/todayMirrorPolicy";
import { buildMirrorPrompt, type MirrorLocale } from "@/lib/bty/today-intelligence/todayMirrorPrompt";

/** Minimal structural type for the LLM client (satisfied by getLlmClient()). */
export interface MirrorLlmClient {
  chat: {
    completions: {
      create(
        params: {
          model: string;
          temperature?: number;
          max_tokens?: number;
          response_format?: { type: "json_object" };
          messages: { role: "system" | "user" | "assistant"; content: string }[];
        },
        options?: { signal?: AbortSignal },
      ): Promise<{ choices: { message: { content: string | null } }[] }>;
    };
  };
}

export type MirrorGenerateOptions = {
  packet: TodayMirrorEvidencePacket;
  recent: RecentTodayMirrorContext;
  locale: MirrorLocale;
  /** Injectable for tests; defaults to the configured server-side client. */
  client?: MirrorLlmClient;
  timeoutMs?: number;
  maxRetries?: number;
};

export type MirrorGenerateResult =
  | { ok: true; response: TodayMirrorResponse; analysis: TodayMirrorAnalysis; modelId: string }
  | { ok: false; reason: string; analysis: TodayMirrorAnalysis; violations?: string[] };

const TEMPERATURE = 0.6;
const MAX_TOKENS = 320;
const DEFAULT_TIMEOUT_MS = 12_000;

type RawTurn = {
  mirror?: unknown;
  perspective?: unknown;
  suggestedStep?: unknown;
  uncertaintyNote?: unknown;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Coerce raw model JSON into the text fields we allow the model to own. */
function coerceTurn(raw: RawTurn): {
  mirror: string;
  perspective: string;
  suggestedStep: TodayMirrorResponse["suggestedStep"];
  uncertaintyNote: string | null;
} | null {
  const mirror = asString(raw.mirror);
  const perspective = asString(raw.perspective);
  if (!mirror) return null;
  let suggestedStep: TodayMirrorResponse["suggestedStep"] = null;
  if (raw.suggestedStep && typeof raw.suggestedStep === "object") {
    const s = raw.suggestedStep as Record<string, unknown>;
    const text = asString(s.text);
    if (text) {
      suggestedStep = {
        text,
        observableCompletion: asString(s.observableCompletion),
        timeWindow: asString(s.timeWindow) || null,
      };
    }
  }
  const uncertaintyNote = asString(raw.uncertaintyNote) || null;
  return { mirror, perspective, suggestedStep, uncertaintyNote };
}

async function callModel(
  client: MirrorLlmClient,
  model: string,
  system: string,
  user: string,
  timeoutMs: number,
): Promise<RawTurn | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { signal: controller.signal },
    );
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) return null;
    return JSON.parse(content) as RawTurn;
  } catch {
    return null; // timeout / network / invalid JSON → fail quiet
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a shadow Today Mirror response. Deterministic lens first; the model verbalizes
 * within constraints; deterministic validators gate the result. Returns ok:false (no text)
 * on any failure — the caller shows nothing.
 */
export async function generateTodayMirror(
  opts: MirrorGenerateOptions,
): Promise<MirrorGenerateResult> {
  const { packet, recent, locale } = opts;
  const analysis = selectMirrorLens(packet);

  const client = opts.client ?? (isLlmAvailable() ? (getLlmClient() as MirrorLlmClient) : null);
  if (!client) return { ok: false, reason: "llm_unavailable", analysis };

  const model = getLlmModel();
  const { system, user } = buildMirrorPrompt(packet, analysis, locale);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? 1;

  let raw: RawTurn | null = null;
  for (let attempt = 0; attempt <= maxRetries && !raw; attempt++) {
    raw = await callModel(client, model, system, user, timeoutMs);
  }
  if (!raw) return { ok: false, reason: "no_model_output", analysis };

  const coerced = coerceTurn(raw);
  if (!coerced) return { ok: false, reason: "unparseable_turn", analysis };

  // Deterministic post-fix: open-contract invariant overrides any step the model produced.
  const suggestedStep = analysis.mustAvoidContractDuplication ? null : coerced.suggestedStep;

  const response: TodayMirrorResponse = {
    mirror: coerced.mirror,
    perspective: coerced.perspective,
    suggestedStep,
    uncertaintyNote: coerced.uncertaintyNote,
    lens: analysis.selectedLens,
    evidenceIds: analysis.supportingEvidenceIds,
    noveltySignature: noveltySignatureOf(
      analysis.selectedLens,
      coerced.mirror,
      suggestedStep?.text ?? null,
    ),
  };

  const verdict = validateMirrorResponse(response, packet, analysis, recent);
  if (!verdict.ok) {
    return { ok: false, reason: "validation_failed", analysis, violations: verdict.violations };
  }
  return { ok: true, response, analysis, modelId: model };
}
