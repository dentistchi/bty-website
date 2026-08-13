// BUILD 26P — HARD GATE: the PRODUCTION verifier, executed by workerd.
//
// Vitest runs on Node, where `crypto.X509Certificate` and friends exist. workerd is the runtime
// that actually ships, and its compatibility layer defines X509Certificate as a throwing stub —
// which is exactly why Apple's own Node library was rejected. So passing in Vitest proves nothing
// about production. This worker imports the REAL modules (no reimplementation, no stubs) and runs
// them under `wrangler dev`, which is workerd.
import {
  verifyAppleSignedTransaction,
  signedTransactionDigest,
} from '../../src/lib/apple-iap.server';
import { APPLE_TRUSTED_ROOTS } from '../../src/lib/apple-root-ca';
import { buildTestPki, signTransaction, transactionPayload } from '../../src/lib/apple-test-pki.fixture';

export default {
  async fetch(): Promise<Response> {
    const results: Record<string, unknown> = {};
    const record = (name: string, ok: boolean, detail?: unknown) => {
      results[name] = detail === undefined ? { ok } : { ok, detail };
    };

    const pki = await buildTestPki();
    const roots = [pki.rootPem];

    // 1. certificate parsing + chain verification + WebCrypto signature, end to end.
    const t0 = Date.now();
    const good = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload()), { trustedRootsPem: roots });
    const elapsedMs = Date.now() - t0;
    record('valid_fixture_passes', good.ok === true,
      good.ok ? { transactionId: good.claims.transactionId, environment: good.environment } : good);

    // 2. an attacker's self-supplied root must NOT become a trust anchor.
    const attacker = await buildTestPki();
    const badChain = await verifyAppleSignedTransaction(
      await signTransaction(attacker, transactionPayload()), { trustedRootsPem: roots });
    record('attacker_root_rejected', badChain.ok === false && badChain.code === 'untrusted_certificate_chain', badChain);

    // 3. tampered signature.
    const badSig = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload(), { tamperSignature: true }), { trustedRootsPem: roots });
    record('bad_signature_rejected', badSig.ok === false && badSig.code === 'invalid_apple_signature', badSig);

    // 4. algorithm pinning.
    const noneAlg = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload(), { alg: 'none' }), { trustedRootsPem: roots });
    record('alg_none_rejected', noneAlg.ok === false && noneAlg.code === 'unsupported_algorithm', noneAlg);

    // 5. certificate validity dates.
    const expired = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload()),
      { trustedRootsPem: roots, at: new Date(Date.now() + 150 * 86_400_000) });
    record('expired_leaf_rejected', expired.ok === false && expired.code === 'certificate_expired', expired);

    // 6. bundle/environment values survive into the verified claims.
    const prod = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload({ environment: 'Production' })), { trustedRootsPem: roots });
    record('environment_read_from_verified_payload',
      prod.ok === true && prod.environment === 'Production' &&
      prod.claims.bundleId === 'com.bty.BTYNorebangAdmin');

    // 7. the REAL Apple root parses under workerd (the pinned anchor is usable here).
    const realRootRejectsTestChain = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload()), { trustedRootsPem: APPLE_TRUSTED_ROOTS });
    record('apple_root_parses_and_rejects_test_chain',
      realRootRejectsTestChain.ok === false && realRootRejectsTestChain.code === 'untrusted_certificate_chain');

    // 8. SHA-256 digest helper.
    const digest = await signedTransactionDigest('aaa.bbb.ccc');
    record('digest_works', /^[0-9a-f]{64}$/.test(digest));

    const allOk = Object.values(results).every((r) => (r as { ok: boolean }).ok);
    return new Response(JSON.stringify({ runtime: 'workerd', allOk, elapsedMs, results }, null, 2), {
      status: allOk ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    });
  },
};
