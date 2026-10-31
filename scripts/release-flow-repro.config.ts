import { defineConfig } from "vitest/config";
import base from "../vitest.config";

/** Deliberate RED legacy gates; excluded from the normal src-only suite. No live clients. */
export default defineConfig({
  ...base,
  test: { ...base.test, include: ["docs/release-flow-qa/*.repro.test.ts"] },
});
