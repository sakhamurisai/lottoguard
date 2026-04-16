import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { cognitoClient } from "@/lib/aws";
import { getUserBySub } from "@/lib/db";
import { errResponse } from "@/lib/validate";
import { createHmac } from "crypto";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function secretHash(email: string) {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(email + process.env.COGNITO_CLIENT_ID!)
    .digest("base64");
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    const authParams: Record<string, string> = {
      USERNAME: body.email,
      PASSWORD: body.password,
    };
    const hash = secretHash(body.email);
    if (hash) authParams.SECRET_HASH = hash;

    const result = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: authParams,
    }));

    const tokens = result.AuthenticationResult;
    if (!tokens?.AccessToken) {
      return Response.json({ error: "Authentication failed" }, { status: 401 });
    }

    // Decode sub from AccessToken (base64url middle segment)
    const sub = JSON.parse(
      Buffer.from(tokens.AccessToken.split(".")[1], "base64url").toString()
    ).sub as string;

    // GSI is eventually consistent — retry once if the record isn't visible yet
    let user = await getUserBySub(sub);
    if (!user) {
      await new Promise((r) => setTimeout(r, 800));
      user = await getUserBySub(sub);
    }
    if (!user) return Response.json({ error: "User profile not found" }, { status: 404 });

    const res = Response.json({
      user: {
        id: sub,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        orgName: (user as Record<string, unknown>).orgName,
      },
    });

    const ttl = tokens.ExpiresIn ?? 3600;
    const base = `; HttpOnly; Path=/; SameSite=Lax; Max-Age=${ttl}`;
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

    res.headers.append("Set-Cookie", `access_token=${tokens.AccessToken}${base}${secure}`);
    if (tokens.IdToken)
      res.headers.append("Set-Cookie", `id_token=${tokens.IdToken}${base}${secure}`);
    if (tokens.RefreshToken)
      res.headers.append("Set-Cookie", `refresh_token=${tokens.RefreshToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`);

    return res;
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (name === "UserNotConfirmedException") {
      return Response.json({ error: "Please verify your email first.", code: "UNCONFIRMED" }, { status: 403 });
    }
    if (err instanceof z.ZodError) {
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    return errResponse(err);
  }
}
