// Apple Root CA — G3. The ONLY trust anchor for App Store signed-data verification.
//
// WHY THIS FILE EXISTS AT ALL. A StoreKit transaction arrives as a JWS whose header carries its
// own `x5c` certificate chain. That chain is EVIDENCE, never a source of trust: an attacker can
// mint their own root, sign their own intermediate and leaf, sign any payload they like, and
// present a perfectly self-consistent chain. The only thing that makes a chain meaningful is
// anchoring it to a root WE supply, out of band, and never accept from the request.
//
// PROVENANCE
//   name         Apple Root CA - G3
//   source       https://www.apple.com/certificateauthority/AppleRootCA-G3.cer  (Apple, public)
//   subject      CN=Apple Root CA - G3, OU=Apple Certification Authority, O=Apple Inc., C=US
//   issuer       identical to subject — self-signed, as a root must be
//   serial       2DC5FC88D2C54B95
//   validity     2014-04-30T18:19:06Z .. 2039-04-30T18:19:06Z
//   key          ECDSA P-384
//   SHA-256      63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:
//                7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
//
// WHY IT IS TRUSTED. It is the root Apple publishes for verifying App Store signed data, obtained
// directly from Apple over TLS and pinned here by value. `APPLE_ROOT_CA_G3_SHA256` below lets a
// test assert the bytes have not drifted, so a careless edit to the PEM fails loudly instead of
// silently changing who we trust.
//
// ROTATION. Apple has not rotated this root (it runs to 2039), but if it ever does: add the new
// root alongside this one, verify against BOTH for an overlap window, then remove the old one in
// a separate change. Never swap in place — a deploy that lands between the two would reject every
// genuine transaction. `APPLE_TRUSTED_ROOTS` is an array for exactly that reason.
//
// THIS IS PUBLIC MATERIAL. It is a root certificate, not a secret. There is no Apple private key,
// issuer id, or API key anywhere in this deployment — local JWS verification needs none, which is
// the same property `apple-auth.server.ts` documents for Sign in with Apple.

/** Apple Root CA - G3, PEM. Never read from a request, env var, or network. */
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
 * Every root we will anchor a chain to. An array so a future rotation can trust two roots during
 * the overlap, rather than swapping one out in a single deploy.
 */
export const APPLE_TRUSTED_ROOTS: readonly string[] = [APPLE_ROOT_CA_G3_PEM];
