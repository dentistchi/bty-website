// A controlled test PKI for BUILD 26P. TEST SUPPORT ONLY — never imported by app code.
//
// The point of this file is that the crypto tests exercise REAL chain logic. It would be trivial
// to make them green by stubbing the verifier; that would prove nothing. Instead we mint an
// actual root → intermediate → leaf hierarchy with ECDSA P-256 keys and sign a real ES256 JWS,
// then let the production verifier reject the ways it should.
//
// Every knob below exists so a specific attack can be built: a self-supplied root, a leaf signed
// by the wrong key, an intermediate that is not a CA, an expired certificate, a leaf without
// Apple's purpose OID. The tests are the reason for the parameters.

import 'reflect-metadata';
import * as x509 from '@peculiar/x509';

x509.cryptoProvider.set(crypto);

const SIG = { name: 'ECDSA', hash: 'SHA-256' } as const;
const KEY = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const DAY = 86_400_000;

/** Apple's signed-data leaf marker; the production verifier requires it. */
export const LEAF_PURPOSE_OID = '1.2.840.113635.100.6.11.1';

export interface TestPki {
  rootPem: string;
  intermediatePem: string;
  leafPem: string;
  /** DER-base64 chain in Apple's order: leaf, intermediate, root. */
  x5c: string[];
  leafKey: CryptoKeyPair;
  intermediateKey: CryptoKeyPair;
  rootKey: CryptoKeyPair;
}

export interface PkiOptions {
  /** Make the intermediate a non-CA certificate (basicConstraints CA=false). */
  intermediateNotCa?: boolean;
  /** Omit Apple's purpose OID from the leaf. */
  leafWithoutPurposeOid?: boolean;
  /** Leaf validity window offsets, in days, relative to now. */
  leafNotBeforeDays?: number;
  leafNotAfterDays?: number;
  /** Sign the leaf with the ROOT key instead of the intermediate (breaks the chain). */
  leafSignedByRoot?: boolean;
}

const genKey = () => crypto.subtle.generateKey(KEY, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
const toB64 = (cert: x509.X509Certificate) =>
  btoa(String.fromCharCode(...new Uint8Array(cert.rawData)));

/** Build a fresh, independent PKI. Each call produces new keys, so tests cannot bleed into each other. */
export async function buildTestPki(options: PkiOptions = {}): Promise<TestPki> {
  const now = Date.now();
  const rootKey = await genKey();
  const intermediateKey = await genKey();
  const leafKey = await genKey();

  const root = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01',
    name: 'CN=BTY Test Root CA',
    notBefore: new Date(now - DAY),
    notAfter: new Date(now + 365 * DAY),
    signingAlgorithm: SIG,
    keys: rootKey,
    extensions: [
      new x509.BasicConstraintsExtension(true, 2, true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
        true,
      ),
    ],
  });

  const intermediate = await x509.X509CertificateGenerator.create({
    serialNumber: '02',
    subject: 'CN=BTY Test Intermediate',
    issuer: root.subject,
    notBefore: new Date(now - DAY),
    notAfter: new Date(now + 200 * DAY),
    signingAlgorithm: SIG,
    publicKey: intermediateKey.publicKey,
    signingKey: rootKey.privateKey,
    extensions: [
      new x509.BasicConstraintsExtension(!options.intermediateNotCa, 1, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign, true),
    ],
  });

  const leafExtensions: x509.Extension[] = [
    new x509.BasicConstraintsExtension(false, undefined, true),
  ];
  if (!options.leafWithoutPurposeOid) {
    leafExtensions.push(new x509.Extension(LEAF_PURPOSE_OID, true, new Uint8Array([5, 0])));
  }

  const leaf = await x509.X509CertificateGenerator.create({
    serialNumber: '03',
    subject: 'CN=BTY Test Leaf',
    issuer: options.leafSignedByRoot ? root.subject : intermediate.subject,
    notBefore: new Date(now + (options.leafNotBeforeDays ?? -1) * DAY),
    notAfter: new Date(now + (options.leafNotAfterDays ?? 100) * DAY),
    signingAlgorithm: SIG,
    publicKey: leafKey.publicKey,
    signingKey: options.leafSignedByRoot ? rootKey.privateKey : intermediateKey.privateKey,
    extensions: leafExtensions,
  });

  return {
    rootPem: root.toString('pem'),
    intermediatePem: intermediate.toString('pem'),
    leafPem: leaf.toString('pem'),
    x5c: [toB64(leaf), toB64(intermediate), toB64(root)],
    leafKey,
    intermediateKey,
    rootKey,
  };
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodeJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

/** A payload shaped like Apple's JWSTransaction. Every field is overridable so tests can bend one. */
export function transactionPayload(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: '2000000900000001',
    originalTransactionId: '2000000900000001',
    bundleId: 'com.bty.BTYNorebangAdmin',
    productId: 'com.btydaily.norebang.pass.1hour',
    purchaseDate: Date.now(),
    quantity: 1,
    type: 'Consumable',
    inAppOwnershipType: 'PURCHASED',
    environment: 'Sandbox',
    appAccountToken: '11111111-2222-4333-8444-555555555555',
    signedDate: Date.now(),
    transactionReason: 'PURCHASE',
    ...overrides,
  };
}

export interface SignOptions {
  /** Header algorithm. Tests use this to attempt `none` and alg substitution. */
  alg?: string;
  /** Replace the x5c chain entirely (wrong order, wrong length, garbage). */
  x5c?: string[];
  /** Sign with a key other than the leaf's — a valid chain over a forged signature. */
  signWith?: CryptoKey;
  /** Corrupt the signature after signing. */
  tamperSignature?: boolean;
  /** Corrupt the payload after signing, leaving the signature intact. */
  tamperPayload?: boolean;
}

/** Produce a compact JWS the production verifier will actually parse. */
export async function signTransaction(
  pki: TestPki,
  payload: Record<string, unknown>,
  options: SignOptions = {},
): Promise<string> {
  const header = { alg: options.alg ?? 'ES256', x5c: options.x5c ?? pki.x5c };
  const headerB64 = encodeJson(header);
  let payloadB64 = encodeJson(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const raw = await crypto.subtle.sign(
    SIG,
    options.signWith ?? pki.leafKey.privateKey,
    new TextEncoder().encode(signingInput),
  );
  let sig = b64url(new Uint8Array(raw));

  if (options.tamperSignature) {
    sig = `${sig.slice(0, -4)}${sig.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
  }
  if (options.tamperPayload) {
    payloadB64 = encodeJson({ ...payload, transactionId: 'tampered-9999' });
  }
  return `${headerB64}.${payloadB64}.${sig}`;
}
