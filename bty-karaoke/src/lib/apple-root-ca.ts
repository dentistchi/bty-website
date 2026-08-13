// Apple's trust anchors for App Store signed-data verification (BUILD 26P-R1.2).
//
// WHY THIS FILE EXISTS AT ALL. A StoreKit transaction arrives as a JWS whose header carries its
// own `x5c` certificate chain. That chain is EVIDENCE, never a source of trust: an attacker can
// mint their own root, sign their own intermediate and leaf, sign any payload they like, and
// present a perfectly self-consistent chain. The only thing that makes a chain meaningful is
// anchoring it to a root WE supply, out of band, and never accept from the request.
//
// R1.2 CORRECTS A WRONG INFERENCE FROM R1.1. R1.1 shipped G3 alone and justified it with:
// "StoreKit JWS is ES256, therefore only an ECC root can anchor the chain." That reasoning
// conflates two different layers and is not preserved:
//
//   JWS layer   the signing input is signed by the LEAF's private key; StoreKit requires ES256,
//               so the LEAF key must be ECDSA P-256.
//   PKI layer   the leaf CERTIFICATE is signed by the intermediate, and the intermediate by a
//               root. Those are separate signature operations with their own algorithms.
//
// Nothing requires a parent CA to use the same algorithm as its child's key, and Apple's
// SignedDataVerifier does not filter trusted roots by the JWS algorithm — it attempts
// certification against whatever trusted root set the caller supplies. The real Apple chain shows
// the layers coming apart in practice: the leaf key is ECDSA P-256 (ES256-capable) while the
// root and intermediate are P-384 and sign with ecdsa-with-SHA384.
//
// SO THE POLICY FOLLOWS APPLE'S DOCUMENTATION, NOT AN ALGORITHM GUESS. The App Store Server
// Library README says: "Download and store the root certificates found in the Apple Root
// Certificates section of the Apple PKI site. Provide these certificates as an array to a
// SignedDataVerifier." Measured 2026-08-13, that section lists exactly three roots, and all three
// are pinned below.
//
// A WIDER ROOT SET IS NOT A WIDER SECURITY BOUNDARY. Being signed somewhere under an Apple root
// is nowhere near sufficient here: apple-iap.server.ts additionally requires x5c of exactly 3,
// issuer/subject linkage, the intermediate to be a CA, Apple's purpose OID on BOTH the leaf
// (.6.11.1) and the intermediate (.6.2.1), certificate validity at the transaction's signedDate,
// an ES256 JWS, and then bundle/environment/account-binding checks. Trusting three Apple roots
// instead of one widens which Apple PKI hierarchy may anchor a chain; it does not relax a single
// one of those constraints.
//
// PROVENANCE — each obtained directly from Apple over TLS, pinned by value, hash-checked by test.
//
//   Apple Root CA (G1)
//     source   https://www.apple.com/appleca/AppleIncRootCertificate.cer
//     subject  CN=Apple Root CA, OU=Apple Certification Authority, O=Apple Inc., C=US
//     serial   02              validity 2006-04-25 .. 2035-02-09
//     key      RSA 2048        signature sha1WithRSAEncryption (self-signed)
//     sha256   b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024
//
//   Apple Root CA - G2
//     source   https://www.apple.com/certificateauthority/AppleRootCA-G2.cer
//     subject  CN=Apple Root CA - G2, OU=Apple Certification Authority, O=Apple Inc., C=US
//     serial   01E0E5B58367A3E0   validity 2014-04-30 .. 2039-04-30
//     key      RSA 4096        signature sha384WithRSAEncryption (self-signed)
//     sha256   c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050
//
//   Apple Root CA - G3     <- the anchor the real App Store chain uses today
//     source   https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
//     subject  CN=Apple Root CA - G3, OU=Apple Certification Authority, O=Apple Inc., C=US
//     serial   2DC5FC88D2C54B95   validity 2014-04-30 .. 2039-04-30
//     key      ECDSA P-384     signature ecdsa-with-SHA384 (self-signed)
//     sha256   63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179
//     NOTE     byte-identical to REAL_APPLE_ROOT_BASE64_ENCODED in Apple's own
//              app-store-server-library-node test suite (verified, 583 bytes)
//
// NEVER obtained from: the JWS x5c, the OS trust store, an npm package, a third-party repository,
// request data, or network discovery at verification time. This is public trust material, not a
// secret — there is no Apple private key, issuer id or API key anywhere in this deployment.
//
// ROTATION. If Apple adds a root, add it here with its own provenance and hash; verify against
// both across the overlap; remove the old one separately. Never swap in place — a deploy landing
// between the two would reject every genuine transaction.

/** Apple Root CA (G1), PEM. RSA 2048. Never read from a request, env var, or network. */
export const APPLE_ROOT_CA_G1_PEM = `-----BEGIN CERTIFICATE-----
MIIEuzCCA6OgAwIBAgIBAjANBgkqhkiG9w0BAQUFADBiMQswCQYDVQQGEwJVUzET
MBEGA1UEChMKQXBwbGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlv
biBBdXRob3JpdHkxFjAUBgNVBAMTDUFwcGxlIFJvb3QgQ0EwHhcNMDYwNDI1MjE0
MDM2WhcNMzUwMjA5MjE0MDM2WjBiMQswCQYDVQQGEwJVUzETMBEGA1UEChMKQXBw
bGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkx
FjAUBgNVBAMTDUFwcGxlIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
ggEKAoIBAQDkkakJH5HbHkdQ6wXtXnmELes2oldMVeyLGYne+Uts9QerIjAC6Bg+
+FAJ039BqJj50cpmnCRrEdCju+QbKsMflZ56DKRHi1vUFjczy8QPTc4UadHJGXL1
XQ7Vf1+b8iUDulWPTV0N8WQ1IxVLFVkds5T39pyez1C6wVhQZ48ItCD3y6wsIG9w
tj8BMIy3Q88PnT3zK0koGsj+zrW5DtleHNbLPbU6rfQPDgCSC7EhFi501TwN22IW
q6NxkkdTVcGvL0Gz+PvjcM3mo0xFfh9Ma1CWQYnEdGILEINBhzOKgbEwWOxaBDKM
aLOPHd5lc/9nXmW8Sdh2nzMUZaF3lMktAgMBAAGjggF6MIIBdjAOBgNVHQ8BAf8E
BAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUK9BpR5R2Cf70a40uQKb3
R01/CF4wHwYDVR0jBBgwFoAUK9BpR5R2Cf70a40uQKb3R01/CF4wggERBgNVHSAE
ggEIMIIBBDCCAQAGCSqGSIb3Y2QFATCB8jAqBggrBgEFBQcCARYeaHR0cHM6Ly93
d3cuYXBwbGUuY29tL2FwcGxlY2EvMIHDBggrBgEFBQcCAjCBthqBs1JlbGlhbmNl
IG9uIHRoaXMgY2VydGlmaWNhdGUgYnkgYW55IHBhcnR5IGFzc3VtZXMgYWNjZXB0
YW5jZSBvZiB0aGUgdGhlbiBhcHBsaWNhYmxlIHN0YW5kYXJkIHRlcm1zIGFuZCBj
b25kaXRpb25zIG9mIHVzZSwgY2VydGlmaWNhdGUgcG9saWN5IGFuZCBjZXJ0aWZp
Y2F0aW9uIHByYWN0aWNlIHN0YXRlbWVudHMuMA0GCSqGSIb3DQEBBQUAA4IBAQBc
NplMLXi37Yyb3PN3m/J20ncwT8EfhYOFG5k9RzfyqZtAjizUsZAS2L70c5vu0mQP
y3lPNNiiPvl4/2vIB+x9OYOLUyDTOMSxv5pPCmv/K/xZpwUJfBdAVhEedNO3iyM7
R6PVbyTi69G3cN8PReEnyvFteO3ntRcXqNx+IjXKJdXZD9Zr1KIkIxH3oayPc4Fg
xhtbCS+SsvhESPBgOJ4V9T0mZyCKM2r3DYLP3uujL/lTaltkwGMzd/c6ByxW69oP
IQ7aunMZT7XZNn/Bh1XZp5m5MkL72NVxnn6hUrcbvZNCJBIqxw8dtk2cXmPIS4AX
UKqK1drk/NAJBzewdXUh
-----END CERTIFICATE-----`;

/** DER SHA-256 of Apple Root CA (G1). */
export const APPLE_ROOT_CA_G1_SHA256 =
  'b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024';

/** Apple Root CA - G2, PEM. RSA 4096. Never read from a request, env var, or network. */
export const APPLE_ROOT_CA_G2_PEM = `-----BEGIN CERTIFICATE-----
MIIFkjCCA3qgAwIBAgIIAeDltYNno+AwDQYJKoZIhvcNAQEMBQAwZzEbMBkGA1UE
AwwSQXBwbGUgUm9vdCBDQSAtIEcyMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0
aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMw
HhcNMTQwNDMwMTgxMDA5WhcNMzkwNDMwMTgxMDA5WjBnMRswGQYDVQQDDBJBcHBs
ZSBSb290IENBIC0gRzIxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0
aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzCCAiIwDQYJ
KoZIhvcNAQEBBQADggIPADCCAgoCggIBANgREkhI2imKScUcx+xuM23+TfvgHN6s
XuI2pyT5f1BrTM65MFQn5bPW7SXmMLYFN14UIhHF6Kob0vuy0gmVOKTvKkmMXT5x
ZgM4+xb1hYjkWpIMBDLyyED7Ul+f9sDx47pFoFDVEovy3d6RhiPw9bZyLgHaC/Yu
OQhfGaFjQQscp5TBhsRTL3b2CtcM0YM/GlMZ81fVJ3/8E7j4ko380yhDPLVoACVd
J2LT3VXdRCCQgzWTxb+4Gftr49wIQuavbfqeQMpOhYV4SbHXw8EwOTKrfl+q04tv
ny0aIWhwZ7Oj8ZhBbZF8+NfbqOdfIRqMM78xdLe40fTgIvS/cjTf94FNcX1RoeKz
8NMoFnNvzcytN31O661A4T+B/fc9Cj6i8b0xlilZ3MIZgIxbdMYs0xBTJh0UT8TU
gWY8h2czJxQI6bR3hDRSj4n4aJgXv8O7qhOTH11UL6jHfPsNFL4VPSQ08prcdUFm
IrQB1guvkJ4M6mL4m1k8COKWNORj3rw31OsMiANDC1CvoDTdUE0V+1ok2Az6DGOe
HwOx4e7hqkP0ZmUoNwIx7wHHHtHMn23KVDpA287PT0aLSmWaasZobNfMmRtHsHLD
d4/E92GcdB/O/WuhwpyUgquUoue9G7q5cDmVF8Up8zlYNPXEpMZ7YLlmQ1A/bmH8
DvmGqmAMQ0uVAgMBAAGjQjBAMB0GA1UdDgQWBBTEmRNsGAPCe8CjoA1/coB6HHcm
jTAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQwF
AAOCAgEAUabz4vS4PZO/Lc4Pu1vhVRROTtHlznldgX/+tvCHM/jvlOV+3Gp5pxy+
8JS3ptEwnMgNCnWefZKVfhidfsJxaXwU6s+DDuQUQp50DhDNqxq6EWGBeNjxtUVA
eKuowM77fWM3aPbn+6/Gw0vsHzYmE1SGlHKy6gLti23kDKaQwFd1z4xCfVzmMX3z
ybKSaUYOiPjjLUKyOKimGY3xn83uamW8GrAlvacp/fQ+onVJv57byfenHmOZ4VxG
/5IFjPoeIPmGlFYl5bRXOJ3riGQUIUkhOb9iZqmxospvPyFgxYnURTbImHy99v6Z
SYA7LNKmp4gDBDEZt7Y6YUX6yfIjyGNzv1aJMbDZfGKnexWoiIqrOEDCzBL/FePw
N983csvMmOa/orz6JopxVtfnJBtIRD6e/J/JzBrsQzwBvDR4yGn1xuZW7AYJNpDr
FEobXsmII9oDMJELuDY++ee1KG++P+w8j2Ud5cAeh6Squpj9kuNsJnfdBrRkBof0
Tta6SqoWqPQFZ2aWuuJVecMsXUmPgEkrihLHdoBR37q9ZV0+N0djMenl9MU/S60E
inpxLK8JQzcPqOMyT/RFtm2XNuyE9QoB6he7hY1Ck3DDUOUUi78/w0EP3SIEIwiK
um1xRKtzCTrJ+VKACd+66eYWyi4uTLLT3OUEVLLUNIAytbwPF+E=
-----END CERTIFICATE-----`;

/** DER SHA-256 of Apple Root CA - G2. */
export const APPLE_ROOT_CA_G2_SHA256 =
  'c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050';

/** Apple Root CA - G3, PEM. ECDSA P-384. Never read from a request, env var, or network. */
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

/** DER SHA-256 of the certificate above. Pinned so an edit to the PEM cannot pass unnoticed. */
export const APPLE_ROOT_CA_G3_SHA256 =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

/**
 * Every root we will anchor a chain to — Apple's documented App Store Server Library set.
 *
 * G3 is listed first because it is the anchor the real App Store chain uses today, so the common
 * case matches on the first attempt. Order is an efficiency detail only: the loop in
 * apple-iap.server.ts requires a genuine issuer/subject linkage AND signature match, so no root
 * can be selected by position, name, or resemblance to Apple.
 */
export const APPLE_TRUSTED_ROOTS: readonly string[] = [
  APPLE_ROOT_CA_G3_PEM,
  APPLE_ROOT_CA_G2_PEM,
  APPLE_ROOT_CA_G1_PEM,
];
