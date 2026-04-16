/**
 * Server-side Cognito JWT verification using jose.
 * Verifies the access token stored in the `access_token` httpOnly cookie.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { getUserBySub } from "./db";

const REGION = process.env.AWS_REGION!;
const POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const JWKS_URL = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`;

// Cache the JWKS fetcher across requests
let JWKS: ReturnType<typeof createRemoteJWKSet>;
function getJWKS() {
  if (!JWKS) JWKS = createRemoteJWKSet(new URL(JWKS_URL));
  return JWKS;
}

export type AuthPayload = JWTPayload & {
  sub: string;
  email: string;
  orgId: string;
  role: "owner" | "employee";
  name: string;
};

/**
 * Reads + verifies the access_token cookie.
 * Returns the decoded payload or throws 401.
 */
export async function requireAuth(): Promise<AuthPayload> {
  const jar = await cookies();
  const token = jar.get("access_token")?.value;
  if (!token) throw new AuthError(401, "Not authenticated");

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, getJWKS(), {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`,
    });
    payload = result.payload;
  } catch {
    throw new AuthError(401, "Invalid or expired token");
  }

  const sub = payload.sub as string;

  // Fetch role + orgId from DynamoDB (cached in edge/ISR would be ideal; fine for now)
  const user = await getUserBySub(sub);
  if (!user) throw new AuthError(401, "User record not found");

  return {
    ...payload,
    sub,
    email: user.email as string,
    name: user.name as string,
    orgId: user.orgId as string,
    role: user.role as "owner" | "employee",
  };
}

export async function requireOwner() {
  const payload = await requireAuth();
  if (payload.role !== "owner") throw new AuthError(403, "Owner access required");
  return payload;
}

export async function requireEmployee() {
  const payload = await requireAuth();
  if (payload.role !== "employee") throw new AuthError(403, "Employee access required");
  return payload;
}

// ── Error helpers ─────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errResponse(err: unknown) {
  if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
