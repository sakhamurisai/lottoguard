import { ConfirmSignUpCommand, ResendConfirmationCodeCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { createHmac } from "crypto";
import { cognitoClient } from "@/lib/aws";
import { errResponse } from "@/lib/validate";

function secretHash(email: string): string | undefined {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(email + process.env.COGNITO_CLIENT_ID!)
    .digest("base64");
}

const confirmSchema = z.object({
  email: z.string().email(),
  code:  z.string().min(1),
});

const resendSchema = z.object({
  email:  z.string().email(),
  action: z.literal("resend"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Resend confirmation code
    if (body.action === "resend") {
      const { email } = resendSchema.parse(body);
      await cognitoClient.send(new ResendConfirmationCodeCommand({
        ClientId:   process.env.COGNITO_CLIENT_ID!,
        Username:   email,
        SecretHash: secretHash(email),
      }));
      return Response.json({ message: "Verification code resent." });
    }

    // Confirm sign-up
    const { email, code } = confirmSchema.parse(body);
    await cognitoClient.send(new ConfirmSignUpCommand({
      ClientId:            process.env.COGNITO_CLIENT_ID!,
      Username:            email,
      ConfirmationCode:    code,
      SecretHash:          secretHash(email),
    }));

    return Response.json({ message: "Email verified. You can now sign in." });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "CodeMismatchException")
      return Response.json({ error: "Invalid code. Check your email and try again." }, { status: 400 });
    if (name === "ExpiredCodeException")
      return Response.json({ error: "Code expired. Click 'Resend code' to get a new one." }, { status: 400 });
    if (name === "NotAuthorizedException")
      return Response.json({ error: "Account is already confirmed. Please sign in." }, { status: 400 });
    if (name === "LimitExceededException")
      return Response.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
    if (err instanceof z.ZodError)
      return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
