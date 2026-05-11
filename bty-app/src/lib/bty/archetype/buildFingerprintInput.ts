import { normalizePatternFamilyId } from "@/domain/pattern-family";
import { computeMetrics } from "@/features/arena/logic";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";
import type { AxisVector, FingerprintInput } from "./fingerprint";

/**
 * Maps Arena signals + pattern signatures to FingerprintInput.
 *
 * AxisVector derivation:
 *  - Base values come from LeadershipMetrics (0–1 scale).
 *  - Active distortion patterns lower their corresponding axis by 0.30
 *    (clamped to 0).
 */
export function buildFingerprintInput(
  signals: ArenaSignal[],
  patterns: UserPatternSignaturePublic[],
  scenariosCompleted: number,
  contractsCompleted: number,
): FingerprintInput {
  const metrics = computeMetrics(signals);
  const { AIR, TII, relationalBias, operationalBias, emotionalRegulation } = metrics;

  // AL-2-D-P0: alias-aware activePatterns Set (R3.5.2 closure).
  // Resolves aliases to canonical via normalizePatternFamilyId so pen() lookups
  // hit canonical literals. Falls back to raw lowercased value for unknown families.
  const activePatterns = new Set(
    patterns.map((p) => (normalizePatternFamilyId(p.pattern_family) ?? p.pattern_family).toLowerCase()),
  );
  const pen = (family: string, base: number) =>
    activePatterns.has(family) ? Math.max(0, base - 0.3) : base;

  const axisVector: AxisVector = {
    ownership: pen("ownership_escape", relationalBias),
    time: pen("future_deferral", emotionalRegulation),
    authority: pen("authority_protection", operationalBias),
    truth: pen("truth_naming", AIR),
    repair: pen("repair_avoidance", TII),
    conflict: pen("delegation_deflection", operationalBias),
    integrity: pen("integrity_compromise", TII),
    visibility: pen("reputation_protection", relationalBias),
    accountability: pen("explanation_substitution", AIR),
    courage: emotionalRegulation,
    control: pen("self_protection", operationalBias),
    identity: TII,
  };

  return {
    axisVector,
    patternFamilies: patterns.map((p) => p.pattern_family),
    scenariosCompleted,
    contractsCompleted,
  };
}
