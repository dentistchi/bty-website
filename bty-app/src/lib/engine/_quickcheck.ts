/**
 * Tiny sanity checks (no test runner needed).
 * You can run with: node --loader ts-node/esm ... if you have it.
 * For CI later, we can port to vitest/jest.
 */
import { createNewProgress, outcomeToEvent, applyEventToProgress, withDerived } from "./index";

const p0 = createNewProgress({ userId: "u1", seasonId: "2026Q1" });

const ev = outcomeToEvent({
  scenarioId: "conflict_staff_001",
  userId: "u1",
  createdAt: new Date().toISOString(),
  xpBase: 60,
  difficulty: 1.2,
  tags: ["gratitude"],
  hiddenDelta: { integrity: 2, communication: 1 },
});

const { next } = applyEventToProgress(p0, ev);
const p1 = withDerived(next);

if (!p1.stage) throw new Error("stage missing");
if (p1.coreXp <= 0) throw new Error("coreXp not increased");
if (p1.hidden.gratitude < 1) throw new Error("gratitude not applied");

console.log("[engine/_quickcheck] ok", {
  coreXp: p1.coreXp,
  leagueXp: p1.leagueXp,
  stage: p1.stage,
  hidden: p1.hidden,
});
