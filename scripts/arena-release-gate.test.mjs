import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const script = fileURLToPath(new URL("./arena-release-gate.sh", import.meta.url));
const sha = "c".repeat(40);
const ready = {
  ok: true,
  mode: "arena",
  runtime_state: "ARENA_SCENARIO_READY",
  gates: { next_allowed: true },
  scenario: { scenarioId: "example" },
};

async function withFixture(run, { version = sha, scenario = ready } = {}) {
  const paths = [];
  const server = createServer(async (req, res) => {
    const path = req.url;
    paths.push(path);
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    const signedIn = req.headers.cookie === "fixture_session=verified";
    switch (path) {
      case "/api/version":
        return reply(200, { version });
      case "/api/arena/session/next?locale=en":
        return reply(410, { error: "arena_session_next_deprecated" });
      case "/api/arena/n/session?locale=en":
        return signedIn ? reply(200, scenario) : reply(401, { error: "unauthenticated" });
      case "/en/bty-arena/run":
        return reply(308, {}, { Location: "/en/bty-arena" });
      case "/en/bty-arena":
        return reply(signedIn ? 200 : 307, {});
      case "/api/auth/login": {
        let body = "";
        for await (const chunk of req) body += chunk;
        if (req.method === "POST" && body === JSON.stringify({ email: "fixture@example.test", password: 'fixture"pass' })) {
          return reply(200, {}, { "Set-Cookie": "fixture_session=verified; Path=/; HttpOnly" });
        }
        return reply(401, {});
      }
      default:
        return reply(404, {});
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await run((mode) => exec("bash", [script], {
      env: {
        PATH: process.env.PATH,
        BASE_URL: `http://127.0.0.1:${address.port}`,
        EXPECTED_SHA: sha,
        ARENA_GATE_MODE: mode,
        E2E_EMAIL: "fixture@example.test",
        E2E_PASSWORD: 'fixture"pass',
      },
    }), paths);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("the public gate checks the exact SHA and never signs in", async () => {
  await withFixture(async (run, paths) => {
    const { stdout } = await run("public");
    assert.match(stdout, /PUBLIC SMOKE PASSED/);
    assert.deepEqual(paths, ["/api/version", "/api/arena/session/next?locale=en", "/api/arena/n/session?locale=en", "/en/bty-arena/run"]);
  });
});

test("a mismatched SHA stops before sending fixture credentials", async () => {
  await withFixture(async (run, paths) => {
    await assert.rejects(run("authenticated"), /version response did not match/);
    assert.deepEqual(paths, ["/api/version"]);
  }, { version: "a".repeat(40) });
});

test("the authenticated gate verifies the cookie on Pipeline N and Arena", async () => {
  await withFixture(async (run, paths) => {
    const { stdout } = await run("authenticated");
    assert.match(stdout, /AUTHENTICATED RELEASE GATE PASSED/);
    assert.doesNotMatch(stdout, /fixture@example|fixture_session/);
    assert.deepEqual(paths.slice(-4), ["/api/auth/login", "/api/arena/n/session?locale=en", "/en/bty-arena", "/api/version"]);
  });
});

test("HTTP 200 with a non-playable state is insufficient for the authenticated gate", async () => {
  await withFixture(async (run) => {
    await assert.rejects(run("authenticated"), /scenario response did not match/);
  }, { scenario: { ...ready, runtime_state: "REEXPOSURE_DUE", scenario: null } });
});
