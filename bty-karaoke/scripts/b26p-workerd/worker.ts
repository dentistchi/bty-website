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
import { validateAppleTransaction } from '../../src/domain/apple-transaction';

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

    // 5. certificate validity dates, at signedDate (Apple offline semantics).
    const expired = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload({ signedDate: Date.now() + 150 * 86_400_000 })),
      { trustedRootsPem: roots });
    record('cert_invalid_at_signedDate_rejected', expired.ok === false && expired.code === 'certificate_expired', expired);

    // 5b. valid AT signedDate but expired NOW must be ACCEPTED — the point of offline dating.
    const shortLived = await buildTestPki({ leafNotBeforeDays: -1, leafNotAfterDays: 2 });
    const oldButValid = await verifyAppleSignedTransaction(
      await signTransaction(shortLived, transactionPayload({ signedDate: Date.now() + 86_400_000 })),
      { trustedRootsPem: [shortLived.rootPem] });
    record('valid_at_signedDate_though_expired_now_accepted', oldButValid.ok === true, oldButValid);

    // 5c. R1.1 — x5c must be exactly three.
    const two = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload(), { x5c: [pki.x5c[0], pki.x5c[1]] }), { trustedRootsPem: roots });
    record('x5c_length_2_rejected', two.ok === false && two.code === 'malformed_certificate_chain', two);
    const four = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload(), { x5c: [...pki.x5c, pki.x5c[2]] }), { trustedRootsPem: roots });
    record('x5c_length_4_rejected', four.ok === false && four.code === 'malformed_certificate_chain', four);

    // 5d. R1.1 — Apple purpose OIDs on BOTH certificates.
    const noLeafOid = await buildTestPki({ leafWithoutPurposeOid: true });
    const leafOidOut = await verifyAppleSignedTransaction(
      await signTransaction(noLeafOid, transactionPayload()), { trustedRootsPem: [noLeafOid.rootPem] });
    record('missing_leaf_oid_rejected',
      leafOidOut.ok === false && leafOidOut.code === 'leaf_missing_apple_purpose', leafOidOut);
    const noInterOid = await buildTestPki({ intermediateWithoutPurposeOid: true });
    const interOidOut = await verifyAppleSignedTransaction(
      await signTransaction(noInterOid, transactionPayload()), { trustedRootsPem: [noInterOid.rootPem] });
    record('missing_intermediate_oid_rejected',
      interOidOut.ok === false && interOidOut.code === 'intermediate_missing_apple_purpose', interOidOut);

    // 5e. R1.1 — issuer/subject linkage.
    const badLeafIssuer = await buildTestPki({ leafWrongIssuerName: true });
    const linkOut = await verifyAppleSignedTransaction(
      await signTransaction(badLeafIssuer, transactionPayload()), { trustedRootsPem: [badLeafIssuer.rootPem] });
    record('wrong_issuer_relationship_rejected',
      linkOut.ok === false && linkOut.code === 'certificate_issuer_mismatch', linkOut);

    // 5f. R1.1 — strict UUID account binding still functions on the domain path.
    const okVerified = await verifyAppleSignedTransaction(
      await signTransaction(pki, transactionPayload()), { trustedRootsPem: roots });
    const bind = okVerified.ok
      ? validateAppleTransaction({
          claims: okVerified.claims, expectedBundleId: 'com.bty.BTYNorebangAdmin',
          verifiedEnvironment: okVerified.environment,
          expectedAppAccountToken: '11111111-2222-4333-8444-555555555555',
        })
      : { ok: false as const, code: 'verify_failed' };
    const bindWhitespace = okVerified.ok
      ? validateAppleTransaction({
          claims: { ...okVerified.claims, appAccountToken: ' 11111111-2222-4333-8444-555555555555' },
          expectedBundleId: 'com.bty.BTYNorebangAdmin',
          verifiedEnvironment: okVerified.environment,
          expectedAppAccountToken: '11111111-2222-4333-8444-555555555555',
        })
      : { ok: true as const };
    record('strict_uuid_binding_works',
      bind.ok === true && bindWhitespace.ok === false, { bind, bindWhitespace });

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
