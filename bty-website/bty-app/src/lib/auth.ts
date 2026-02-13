/**
 * JWT auth for Dear Me / BTY app (login, register, session).
 */

import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "demo-secret-change-in-production";
const ALG = "HS256";

export async function signToken(payload: { sub: string; email: string }): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (payload.sub && payload.email) {
      return { sub: String(payload.sub), email: String(payload.email) };
    }
    return null;
  } catch {
    return null;
  }
}
