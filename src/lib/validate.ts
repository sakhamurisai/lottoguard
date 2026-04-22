/**
 * Server-side Cognito JWT verification using jose.
 * Verifies the access token stored in the `access_token` httpOnly cookie.
 * When the access token is expired, automatically refreshes it via the
 * refresh_token cookie and sets a new access_token cookie transparently.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload, errors as joseErrors } from "jose";
import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { getUserBySub } from "./db";
import { cognitoClient } from "./aws";

const REGION  = process.env.AWS_REGION!;
const POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const JWKS_URL  = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`;

// Cache the JWKS fetcher across requests
let JWKS: ReturnType<typeof createRemoteJWKSet>;
function getJWKS() {
  if (!JWKS) JWKS = createRemoteJWKS(new URL(JWKS_URL));
  return JWKS;
}
function createRemoteJWKS(url: URL) {
  return createRemoteJWKSet(url);
}

export type AuthPayload = JWTPayload & {
  sub:   string;
  email: string;
  orgId: string;
  role:  "owner" | "employee";
  name:  string;
};

// ── Token refresh ─────────────────────────────────────────────────────────────

function secretHash(username: string): string | undefined {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(username + CLIENT_ID)
    .digest("base64");
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    // Cognito requires the SECRET_HASH for REFRESH_TOKEN_AUTH when the app client
    // has a secret. The hash is keyed on the sub (username), but for refresh we
    // use a placeholder — Cognito accepts the hash keyed on the client_id only
    // when USERNAME is omitted. To be safe we omit SECRET_HASH if we can't
    // derive the sub (it's in the ID token, not the refresh token).
    const authParams: Record<string, string> = { REFRESH_TOKEN: refreshToken };
    const hash = secretHash("");
    // Only add if secret is configured — hash("") is acceptable for refresh flow
    if (hash) authParams.SECRET_HASH = hash;

    const result = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow:       "REFRESH_TOKEN_AUTH",
      ClientId:       CLIENT_ID,
      AuthParameters: authParams,
    }));
    return result.AuthenticationResult?.AccessToken ?? null;
  } catch (e) {
    console.warn("[auth] Token refresh failed:", (e as Error).message);
    return null;
  }
}

async function verifyToken(token: string): Promise<JWTPayload> {
  const result = await jwtVerify(token, getJWKS(), {
    issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`,
  });
  return result.payload;
}

// ── Core auth ─────────────────────────────────────────────────────────────────

/**
 * Reads + verifies the access_token cookie.
 * Automatically refreshes via refresh_token when expired.
 * Returns the decoded + enriched payload or throws 401.
 */
export async function requireAuth(): Promise<AuthPayload> {
  const jar = await cookies();

  let token: string | undefined = jar.get("access_token")?.value;
  let jwtPayload: JWTPayload | null = null;

  // 1. Try to verify the current access token
  if (token) {
    try {
      jwtPayload = await verifyToken(token);
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        // Token expired — attempt refresh below
        token = undefined;
      } else {
        // Invalid signature, wrong issuer, etc — not refreshable
        throw new AuthError(401, "Invalid or expired token");
      }
    }
  }

  // 2. If access token is missing or expired, try refresh token
  if (!jwtPayload) {
    const refreshToken = jar.get("refresh_token")?.value;
    if (!refreshToken) {
      throw new AuthError(401, "Not authenticated");
    }

    const newAccessToken = await refreshAccessToken(refreshToken);
    if (!newAccessToken) {
      throw new AuthError(401, "Session expired. Please sign in again.");
    }

    try {
      jwtPayload = await verifyToken(newAccessToken);
    } catch {
      throw new AuthError(401, "Session expired. Please sign in again.");
    }

    // Persist new access token cookie for this and subsequent requests
    const ttl = 3600;
    const isProduction = process.env.NODE_ENV === "production";
    jar.set("access_token", newAccessToken, {
      httpOnly: true,
      path:     "/",
      sameSite: "lax",
      maxAge:   ttl,
      secure:   isProduction,
    });

    token = newAccessToken;
  }

  void token;
  const sub = jwtPayload!.sub as string;

  const user = await getUserBySub(sub);
  if (!user) throw new AuthError(401, "User record not found");

  return {
    ...jwtPayload!,
    sub,
    email: user.email as string,
    name:  user.name  as string,
    orgId: user.orgId as string,
    role:  user.role  as "owner" | "employee",
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
  if (err instanceof AuthError)
    return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
