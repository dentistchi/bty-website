/**
 * Route wrapper: run an existing handler, then if the request had levelId + userText
 * and the response is JSON, append a reflection object. Use when you want a single
 * response to include both the original payload and reflection (e.g. avoid a second
 * call to /api/arena/reflect). Server-only; do not ship to client.
 *
 * Limitations:
 * - Does not resolve levelId from tenure (no auth here). Only attaches reflection
 *   when levelId and userText are present in the request body.
 * - Original handler must return JSON for merging; otherwise response is unchanged.
 */

import { buildReflection, type HumanModelConfig, type LevelId, type ScenarioContext } from "@/lib/bty/arena/reflection-engine";
import humanModelJson from "@/lib/bty/arena/arena_human_model.json";

const HUMAN_MODEL = humanModelJson as HumanModelConfig;
const VALID_LEVEL_IDS: LevelId[] = ["S1", "S2", "S3", "L1", "L2", "L3", "L4"];

export type ArenaHandler = (req: Request) => Promise<Response>;

/**
 * Wraps an Arena API handler:
 * 1. Reads request body from a clone (so original handler can still read body).
 * 2. Calls the original handler.
 * 3. If response is JSON and body had levelId + userText, merges in
 *    reflection: { summary, questions, next_action, detected } (no scores).
 */
export function withArenaReflection(original: ArenaHandler): ArenaHandler {
  return async (req: Request) => {
    let body: { levelId?: string; userText?: string; scenario?: unknown } = {};
    try {
      body = await req.clone().json();
    } catch {
      return original(req);
    }

    const res = await original(req);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return res;

    let data: Record<string, unknown>;
    try {
      data = await res.clone().json();
    } catch {
      return res;
    }

    const levelIdRaw = (body.levelId ?? data.levelId) != null ? String(body.levelId ?? data.levelId).trim().toUpperCase() : "";
    const levelId = VALID_LEVEL_IDS.includes(levelIdRaw as LevelId) ? (levelIdRaw as LevelId) : null;
    const userText = String(body.userText ?? data.userText ?? "").trim();
    const scenario = body.scenario ?? data.scenario;

    if (!levelId || !userText || !HUMAN_MODEL.levels[levelId]) return res;

    const reflection = buildReflection(levelId, userText, HUMAN_MODEL, scenario as ScenarioContext | undefined);
    const safeReflection = {
      summary: reflection.summary,
      questions: reflection.questions,
      next_action: reflection.next_action,
      detected: { tags: reflection.detected.tags, topTag: reflection.detected.topTag },
    };

    const merged = { ...data, reflection: safeReflection };
    return new Response(JSON.stringify(merged), {
      status: res.status,
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        "content-type": "application/json",
      },
    });
  };
}
