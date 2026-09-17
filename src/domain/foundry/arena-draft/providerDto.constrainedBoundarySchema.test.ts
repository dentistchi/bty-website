/**
 * REQUEST-SCOPED CONSTRAINED RENDER SCHEMA — `[GOV-ARENA-C18-CONSTRUCTION-COVERAGE-REPAIR-1]`.
 *
 * THE MEASURED GAP (c18)
 *
 * `validateChoiceConstructions` rejects an EMPTY `boundaryCompliance` the moment any confirmed
 * constraint applies, but the Render request never said so: the outbound JSON Schema bounded the
 * array from ABOVE only (`maxItems`), permitting zero items and any string. The provider was asked
 * to satisfy a floor it was never told about.
 *
 * WHAT THIS PINS
 *
 * `buildProviderScenarioSchema(confirmedIds)` derives a per-request schema:
 *
 *   - no confirmed ids  → the static `PROVIDER_SCENARIO_JSON_SCHEMA`, BY IDENTITY. An unconstrained
 *     scenario has no floor to impose, and returning the constant itself is what keeps the contract
 *     manifest's `providerSchema` component still.
 *   - confirmed ids     → the same schema with `minItems: 1` and `items.enum` = sorted unique
 *     confirmed ids on EVERY construction path, and nothing else changed.
 *
 * The VALIDATOR IS NOT TOUCHED. Its contract stays "at least one KNOWN confirmed id per
 * construction", so the schema states the floor the validator already enforces — no more.
 * `maxItems` and `items.maxLength` are preserved rather than restated, so a future bound change
 * cannot silently diverge between the base schema and its constrained derivation.
 *
 * Pure domain: no I/O, no provider, no mock.
 */

import { describe, it, expect } from "vitest";
import { PROVIDER_SCENARIO_JSON_SCHEMA, buildProviderScenarioSchema } from "./providerDto";

type SchemaNode = Record<string, unknown>;
const node = (v: unknown): SchemaNode => (v ?? {}) as SchemaNode;

/**
 * The five construction-bearing paths, named exactly as they appear on the OUTBOUND request.
 * `primaryChoices`, `flatTradeoffChoices` and `branches[].tradeoffChoices` share one choice schema;
 * `flatActionDecision` and `branches[].actionDecision` share the action-choice schema. Listing all
 * five explicitly is deliberate: shared references are an implementation detail, and this contract
 * must survive them being split apart.
 */
const PATHS = [
  "properties.primaryChoices.items.properties.construction.properties.boundaryCompliance",
  "properties.flatTradeoffChoices.items.properties.construction.properties.boundaryCompliance",
  "properties.flatActionDecision.properties.choices.items.properties.construction.properties.boundaryCompliance",
  "properties.branches.items.properties.tradeoffChoices.items.properties.construction.properties.boundaryCompliance",
  "properties.branches.items.properties.actionDecision.properties.choices.items.properties.construction.properties.boundaryCompliance",
] as const;

/** Walk a dotted path. Returns undefined rather than throwing, so a missing path fails an assertion. */
function at(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc == null ? undefined : node(acc)[key]), root);
}

/** Replace the value at a dotted path, in place, on an already-cloned object. */
function setAt(root: SchemaNode, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  const parent = keys.reduce<SchemaNode>((acc, key) => node(acc[key]), root);
  parent[last] = value;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// The bounds the BASE schema already imposes. Read, never hardcoded — the constrained copy must
// preserve whatever they happen to be.
const BASE_FRAGMENT = node(at(PROVIDER_SCENARIO_JSON_SCHEMA, PATHS[0]));
const BASE_MAX_ITEMS = BASE_FRAGMENT.maxItems;
const BASE_ITEM_MAX_LENGTH = node(BASE_FRAGMENT.items).maxLength;

describe("[GOV-ARENA-C18-CONSTRUCTION-COVERAGE-REPAIR-1] request-scoped construction boundary coverage", () => {
  it("A. an empty confirmed set returns the static schema BY IDENTITY", () => {
    // Identity, not deep equality: the manifest digests this exact object, and an unconstrained
    // request must therefore be byte-for-byte the contract the manifest already describes.
    expect(buildProviderScenarioSchema([])).toBe(PROVIDER_SCENARIO_JSON_SCHEMA);
    // Inputs that NORMALIZE to nothing are unconstrained too — a blank id is not a boundary.
    expect(buildProviderScenarioSchema(["", "   "])).toBe(PROVIDER_SCENARIO_JSON_SCHEMA);
  });

  it("B. every construction path carries the floor and the confirmed-id enum", () => {
    const schema = buildProviderScenarioSchema(["c1_verify"]);
    expect(schema).not.toBe(PROVIDER_SCENARIO_JSON_SCHEMA);

    // Sanity: the base bounds this test preserves are actually present to preserve.
    expect(typeof BASE_MAX_ITEMS).toBe("number");
    expect(typeof BASE_ITEM_MAX_LENGTH).toBe("number");

    for (const path of PATHS) {
      const fragment = at(schema, path);
      expect(fragment, `missing construction path ${path}`).toBeDefined();
      const f = node(fragment);
      const items = node(f.items);

      expect(f.type, path).toBe("array");
      expect(f.minItems as number, path).toBeGreaterThanOrEqual(1);
      expect(items.enum, path).toEqual(["c1_verify"]);

      // The existing bounds survive the derivation.
      expect(f.maxItems, path).toBe(BASE_MAX_ITEMS);
      expect(items.type, path).toBe("string");
      expect(items.maxLength, path).toBe(BASE_ITEM_MAX_LENGTH);
    }
  });

  it("C. the enum is sorted, de-duplicated and drawn only from the input", () => {
    const schema = buildProviderScenarioSchema(["c2_privacy", "c1_verify", "c2_privacy", " c1_verify "]);
    for (const path of PATHS) {
      expect(node(node(at(schema, path)).items).enum, path).toEqual(["c1_verify", "c2_privacy"]);
    }
    // Deterministic: the same set in a different order produces the same schema.
    expect(JSON.stringify(buildProviderScenarioSchema(["c1_verify", "c2_privacy"]))).toBe(
      JSON.stringify(buildProviderScenarioSchema(["c2_privacy", "c1_verify"])),
    );
    // No id is invented. Every enum entry came from the input.
    const enums = PATHS.map((p) => node(node(at(schema, p)).items).enum as string[]);
    for (const e of enums) for (const id of e) expect(["c1_verify", "c2_privacy"]).toContain(id);
  });

  it("D. ONLY the five boundaryCompliance fragments differ from the base schema", () => {
    const constrained = clone(buildProviderScenarioSchema(["c1_verify"]));
    // Put each base fragment back. If anything ELSE moved, the comparison below reports it.
    for (const path of PATHS) setAt(constrained, path, clone(at(PROVIDER_SCENARIO_JSON_SCHEMA, path)));
    expect(constrained).toEqual(JSON.parse(JSON.stringify(PROVIDER_SCENARIO_JSON_SCHEMA)));
  });

  it("E. building a constrained schema does not mutate the static constant", () => {
    const before = JSON.stringify(PROVIDER_SCENARIO_JSON_SCHEMA);
    buildProviderScenarioSchema(["c1_verify"]);
    buildProviderScenarioSchema(["c1_verify", "c2_privacy"]);
    buildProviderScenarioSchema([]);
    expect(JSON.stringify(PROVIDER_SCENARIO_JSON_SCHEMA)).toBe(before);

    // And the base fragment still has no floor of its own.
    for (const path of PATHS) {
      const f = node(at(PROVIDER_SCENARIO_JSON_SCHEMA, path));
      expect(f.minItems, path).toBeUndefined();
      expect(node(f.items).enum, path).toBeUndefined();
    }
  });
});
