#!/usr/bin/env npx tsx
/**
 * Practice provider preflight (Slice 3.2I-R5B1A.1-R2.23D-R2).
 *
 * Runs BOTH capability checks before any generation is attempted:
 *   A. the credential and the configured model answer at all;
 *   B. the endpoint honours a STRICT `json_schema` response format.
 *
 * NO TOP-LEVEL AWAIT. `package.json` declares no `"type"`, so tsx compiles to CommonJS, where a
 * top-level `await` is unrepresentable — measured as
 * `ERROR: Top-level await is currently not supported with the "cjs" output format`, which killed the
 * R2.23D-R1 runner after the operator had already entered a credential. A tracked `.ts` file fails
 * the same way, so the fix is the `async main()` wrapper below, not the file extension.
 *
 *   npx tsx scripts/practice-provider-preflight.ts
 *
 * Prints one sanitized line and exits 0 or 1. It never prints a key, a header, a request body or a
 * provider response body.
 */
import { getLlmClient, getLlmModel } from "@/lib/bty/llm/client";
import {
  formatPreflightResult,
  runProviderPreflight,
  type PreflightClient,
} from "@/lib/bty/foundry/arena/providerPreflight";

const TIMEOUT_MS = 30_000;

/**
 * TEST-ONLY mock transport.
 *
 * Guarded by an environment variable the runner never sets, and it prints a DIFFERENT marker, so a
 * mock run can never be mistaken for — or substituted for — a live one. It exists so the exact
 * program the runner executes is proven to compile and run end to end without a credential; the
 * previous runner shipped a program nobody had ever executed.
 */
const MOCK_ENV = "BTY_PREFLIGHT_MOCK";
function mockClient(): PreflightClient {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: '{"ok":true}', refusal: null }, finish_reason: "stop" }] }),
      },
    },
  };
}

async function main(): Promise<void> {
  const useMock = process.env[MOCK_ENV] === "1";
  const model = useMock ? "mock-model" : getLlmModel();

  // Client construction can throw when no credential or endpoint is configured. That is a
  // CAPABILITY failure with a real code, not an unclassified crash.
  let client: PreflightClient;
  try {
    client = useMock ? mockClient() : (getLlmClient() as unknown as PreflightClient);
  } catch {
    process.stderr.write("PROVIDER PREFLIGHT FAIL · check=capability · code=credential_or_model_unavailable · status=none\n");
    process.exitCode = 1;
    return;
  }

  const result = await runProviderPreflight(client, { model, timeoutMs: TIMEOUT_MS });

  if (!result.ok) {
    process.stderr.write(`${formatPreflightResult(result)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    useMock
      ? "PROVIDER PREFLIGHT MOCK PASS · LIVE PROVIDER NOT CALLED\n"
      : `${formatPreflightResult(result)}\n`,
  );
}

void main().catch((error: unknown) => {
  // Sanitized: the error's own message may carry request headers on some SDKs, so only its
  // constructor name and a numeric status ever reach the operator.
  const name = error instanceof Error ? error.name : "UnknownError";
  const status = (error as { status?: unknown })?.status;
  process.stderr.write(`PROVIDER PREFLIGHT FAIL · check=unknown · code=${name} · status=${typeof status === "number" ? status : "none"}\n`);
  process.exitCode = 1;
});
