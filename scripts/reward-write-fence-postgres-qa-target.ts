import assert from "node:assert/strict";

/**
 * Disposable-database guard shared by the reward-fence harnesses: the connected server
 * must report the task database on port 55491 at loopback. A GitHub Actions service
 * container reports its private bridge address instead; that is accepted only when
 * the workflow opts in and GITHUB_ACTIONS=true, and only for RFC1918 IPv4.
 */
export function validateFenceServer(
  s: { db: string; host: string | null; port: number | string },
  options: { containerService?: boolean; githubActions?: boolean },
  database: string,
) {
  const context = `connectedServer=${JSON.stringify(s)}`;
  assert.equal(s.db, database, context); assert.equal(String(s.port), "55491", context);
  if (s.host && ["127.0.0.1", "::1"].includes(s.host)) return;
  const parts = String(s.host ?? "").split("."); const n = parts.map(Number);
  const ipv4 = parts.length === 4 && parts.every(x => /^(0|[1-9][0-9]{0,2})$/.test(x)) && n.every(x => x <= 255);
  const privateIp = ipv4 && (n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168));
  assert(options.containerService === true && options.githubActions === true && privateIp, context);
}
