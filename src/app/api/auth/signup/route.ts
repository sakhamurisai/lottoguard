import { SignUpCommand, type SignUpCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { randomUUID, createHmac } from "crypto";
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

function secretHash(email: string): string | undefined {
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
    const hash = secretHash(body.email);

    // 1. Cognito SignUp — Cognito sends a verification email automatically
    const signUpInput: SignUpCommandInput = {
      ClientId:   process.env.COGNITO_CLIENT_ID!,
      Username:   body.email,
      Password:   body.password,
      SecretHash: hash,
      UserAttributes: [
        { Name: "email", Value: body.email },
      ],
    };

    const signUp = await cognitoClient.send(new SignUpCommand(signUpInput));
    const sub = signUp.UserSub!;

    // 2. DynamoDB: org + owner records — written before email confirmation
    //    so they're ready the moment the user verifies and logs in
    await Promise.all([
      createOrg({
        orgId, orgName: body.orgName, llcName: body.llcName,
        address: body.address, retailNum: body.retailNum,
        phone: body.phone, slots: body.slots, inviteCode,
      }),
      createOwner(orgId, sub, { name: "Store Owner", email: body.email }),
    ]);

    return Response.json({ message: "Check your email for a verification code.", email: body.email }, { status: 201 });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "UsernameExistsException")
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
