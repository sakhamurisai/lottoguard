import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { randomUUID } from "crypto";
import { s3Client } from "@/lib/aws";
import { requireEmployee, errResponse } from "@/lib/validate";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const schema = z.object({
  filename:    z.string().min(1),
  contentType: z.string().refine((t) => ALLOWED_TYPES.includes(t), { message: "Unsupported file type" }),
});

export async function POST(req: Request) {
  try {
    const { orgId } = await requireEmployee();
    const { filename, contentType } = schema.parse(await req.json());

    const ext = filename.split(".").pop() ?? "jpg";
    const key = `orgs/${orgId}/serials/${randomUUID()}.${ext}`;

    const url = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 120 }
    );

    return Response.json({ url, key });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
