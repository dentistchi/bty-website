import * as jose from "jose";

const JWT_SECRET =
  process.env.JWT_SECRET || "bty-today-me-shared-secret-change-in-production";
const alg = "HS256";

export async function verifyToken(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub as string;
    const email = payload.email as string;
    return sub && email ? { sub, email } : null;
  } catch {
    return null;
  }
}
