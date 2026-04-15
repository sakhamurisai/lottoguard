import { SignUpCommand, AdminConfirmSignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createHmac } from "crypto";
import { cognitoClient } from "@/lib/aws";
import { createOrg, createOwner } from "@/lib/db";
import { errResponse } from "@/lib/validate";

const schema = z.object({
  orgName:   z.string().min(1),
  llcName:   z.string().min(1),
  address:   z.string().min(1),
  retailNum: z.string().min(1),
  phone:     z.string().min(7),
  slots:     z.coerce.number().int().min(1).max(100),
  email:     z.string().email(),
  password:  z.string().min(8),
});

function secretHash(email: string) {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(email + process.env.COGNITO_CLIENT_ID!)
    .digest("base64");
}

function generateInviteCode(retailNum: string) {
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  return `${retailNum.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6)}-${suffix}`;
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const orgId = randomUUID();
    const inviteCode = generateInviteCode(body.retailNum);

    // 1. Cognito SignUp
    const signUpParams: Parameters<typeof SignUpCommand>[0]["input"] = {
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        { Name: "email", Value: body.email },
        { Name: "custom:role", Value: "owner" },
        { Name: "custom:orgId", Value: orgId },
      ],
    };
    const hash = secretHash(body.email);
    if (hash) signUpParams.SecretHash = hash;

    const signUp = await cognitoClient.send(new SignUpCommand(signUpParams));
    const sub = signUp.UserSub!;

    // 2. Auto-confirm (dev convenience — in prod use email verification)
    if (process.env.NODE_ENV !== "production") {
      await cognitoClient.send(new AdminConfirmSignUpCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: body.email,
      }));
    }

    // 3. DynamoDB: org + owner records
    await Promise.all([
      createOrg({ orgId, orgName: body.orgName, llcName: body.llcName, address: body.address, retailNum: body.retailNum, phone: body.phone, slots: body.slots, inviteCode }),
      createOwner(orgId, sub, { name: "Store Owner", email: body.email }),
    ]);

    return Response.json({ message: "Account created. Please sign in." }, { status: 201 });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "UsernameExistsException") {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (err instanceof z.ZodError) {
      return Response.json({ error: err.errors[0].message }, { status: 400 });
    }
    return errResponse(err);
  }
}
