import { SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { createHmac, randomUUID } from "crypto";
import { cognitoClient } from "@/lib/aws";
import { getOrgByInviteCode, createEmployee } from "@/lib/db";
import { errResponse } from "@/lib/validate";

const schema = z.object({
  name:       z.string().min(1),
  email:      z.string().email(),
  phone:      z.string().min(7),
  inviteCode: z.string().min(1),
});

function secretHash(email: string): string | undefined {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(email + process.env.COGNITO_CLIENT_ID!)
    .digest("base64");
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    // 1. Validate invite code → find org
    const org = await getOrgByInviteCode(body.inviteCode.toUpperCase());
    if (!org) return Response.json({ error: "Invalid invite code." }, { status: 400 });
    const orgId = org.orgId as string;

    // 2. Cognito SignUp — Cognito sends verification email automatically
    const tempPassword = `Lg-${randomUUID().slice(0, 8)}!`;
    const hash = secretHash(body.email);

    const signUp = await cognitoClient.send(new SignUpCommand({
      ClientId:   process.env.COGNITO_CLIENT_ID!,
      Username:   body.email,
      Password:   tempPassword,
      SecretHash: hash,
      UserAttributes: [
        { Name: "email", Value: body.email },
        { Name: "name",  Value: body.name  },
      ],
    }));
    const sub = signUp.UserSub!;

    // 3. DynamoDB employee record — pending until owner approves
    await createEmployee(orgId, sub, { name: body.name, email: body.email, phone: body.phone });

    return Response.json({
      message: "Check your email for a verification code.",
      email: body.email,
    }, { status: 201 });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "UsernameExistsException")
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
