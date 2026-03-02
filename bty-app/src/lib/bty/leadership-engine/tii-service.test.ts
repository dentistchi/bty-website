/**
 * Unit tests for TII service — compute_team_tii.
 */

import { describe, it, expect } from "vitest";
import { compute_team_tii, type GetTeamTIIInputs } from "./tii-service";

describe("compute_team_tii", () => {
  it("returns TII result from getInputs", async () => {
    const getInputs: GetTeamTIIInputs = async () => ({
      avgAIR: 0.8,
      avgMWD: 0.3,
      tsp: 4,
    });
    const result = await compute_team_tii("team-1", getInputs);
    expect(result.tii).toBeGreaterThan(0);
    expect(result.tii).toBeLessThanOrEqual(1);
    expect(result.avg_air).toBe(0.8);
    expect(result.avg_mwd).toBe(0.3);
    expect(result.tsp).toBe(4);
    expect(result.components).toBeDefined();
  });

  it("passes teamId and optional weekStart to getInputs", async () => {
    let receivedTeamId: string | undefined;
    let receivedWeekStart: string | undefined;
    const getInputs: GetTeamTIIInputs = async (teamId, weekStart) => {
      receivedTeamId = teamId;
      receivedWeekStart = weekStart;
      return { avgAIR: 0, avgMWD: 0, tsp: 1 };
    };
    await compute_team_tii("team-42", getInputs, "2026-03-10");
    expect(receivedTeamId).toBe("team-42");
    expect(receivedWeekStart).toBe("2026-03-10");
  });

  it("never exposes individual AIR (only team aggregates)", async () => {
    const getInputs: GetTeamTIIInputs = async () => ({
      avgAIR: 0.7,
      avgMWD: 0.2,
      tsp: 3,
    });
    const result = await compute_team_tii("t", getInputs);
    expect(result).toHaveProperty("tii");
    expect(result).toHaveProperty("avg_air");
    expect(result).toHaveProperty("avg_mwd");
    expect(result).toHaveProperty("tsp");
    expect(result.avg_air).toBe(0.7);
    expect(Object.keys(result)).not.toContain("individualAIR");
  });
});
