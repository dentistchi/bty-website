/**
 * Live Memory Engine smoke (service-role). Run from bty-app:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/memory-engine-smoke.ts <user_uuid>
 *
 * Steps: insertBehaviorMemoryEvent → aggregateRepeatedFlagTypes → enqueueMemoryTrigger
 * (memory_pattern_threshold) → consumePendingPatternThresholdRecall.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenvLocal() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const s = readFileSync(p, "utf8");
    for (const line of s.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
    }
  }
}

loadDotenvLocal();

import { insertBehaviorMemoryEvent } from "../src/engine/memory/memory-record.service";
import { aggregateRepeatedFlagTypes } from "../src/engine/memory/memory-pattern-aggregation.service";
import { enqueueMemoryTrigger } from "../src/engine/memory/memory-trigger-queue.service";
import { consumePendingPatternThresholdRecall } from "../src/engine/memory/memory-recall-prompt.service";

const userId = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    console.error("Usage: npx tsx scripts/memory-engine-smoke.ts <user_uuid>");
    process.exit(1);
  }
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const flagType = "SMOKE_INTENT";
  const playedAt = new Date();
  const scenarioId = "smoke_scenario_memory_engine";
  const choiceId = "A";

  console.log("1) insertBehaviorMemoryEvent …");
  const eventId = await insertBehaviorMemoryEvent({
    userId,
    scenarioId,
    choiceId,
    flagType,
    playedAt,
    payload: { smoke: true },
  });
  if (!eventId) {
    console.error("FAIL: insertBehaviorMemoryEvent returned null (check schema + RLS/service role)");
    process.exit(2);
  }
  console.log("   ok id=", eventId);

  console.log("2) aggregateRepeatedFlagTypes …");
  await aggregateRepeatedFlagTypes(userId, flagType, playedAt);
  console.log("   ok");

  console.log("3) enqueueMemoryTrigger (memory_pattern_threshold) …");
  const triggerId = await enqueueMemoryTrigger({
    userId,
    triggerType: "memory_pattern_threshold",
    payload: {
      flag_type: flagType,
      milestones: ["consecutive_3"],
      total_count: 3,
      consecutive_count: 3,
      /** Same shape as enqueuePatternThresholdIfEligible (choice scenario that crossed the threshold). */
      recalled_from_scenario_id: scenarioId,
      idempotency_key: `${userId}:smoke:${Date.now()}`,
    },
  });
  if (!triggerId) {
    console.error("FAIL: enqueueMemoryTrigger returned null (user_memory_trigger_queue?)");
    process.exit(3);
  }
  console.log("   ok id=", triggerId);

  console.log("4) consumePendingPatternThresholdRecall …");
  const recall = await consumePendingPatternThresholdRecall({
    userId,
    locale: "en",
    scenarioId: "smoke_next_scenario",
  });
  if (!recall) {
    console.error("FAIL: consume returned null (trigger not pending or admin issue)");
    process.exit(4);
  }
  console.log("   ok recall=", JSON.stringify(recall));

  console.log("ALL OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
