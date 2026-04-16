import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireOwner, errResponse } from "@/lib/validate";
import { updateBook, deleteBook } from "@/lib/db";
import { s3Client } from "@/lib/aws";

const patchSchema = z.object({
  // Status update
  status:    z.enum(["active", "inactive", "settled"]).optional(),
  slot:      z.number().int().nullable().optional(),
  // Field edits
  gameId:    z.string().min(1).optional(),
  gameName:  z.string().min(1).optional(),
  pack:      z.string().min(1).optional(),
  ticketStart: z.coerce.number().int().min(0).optional(),
  ticketEnd:   z.coerce.number().int().min(1).optional(),
  price:     z.coerce.number().positive().optional(),
  // Receipt attachment
  receiptKey: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const fields: Record<string, unknown> = {};

    if (body.status !== undefined) {
      fields.status = body.status;
      if (body.status === "active")   fields.activatedAt = new Date().toISOString();
      if (body.status === "settled")  { fields.settledAt = new Date().toISOString(); fields.slot = null; }
    }
    if (body.slot !== undefined)       fields.slot = body.slot;
    if (body.gameId !== undefined)     fields.gameId = body.gameId;
    if (body.gameName !== undefined)   fields.gameName = body.gameName;
    if (body.pack !== undefined)       fields.pack = body.pack;
    if (body.ticketStart !== undefined) fields.ticketStart = body.ticketStart;
    if (body.ticketEnd !== undefined)   fields.ticketEnd = body.ticketEnd;
    if (body.price !== undefined)      fields.price = body.price;
    if (body.receiptKey !== undefined) fields.receiptKey = body.receiptKey;
    fields.updatedAt = new Date().toISOString();

    await updateBook(orgId, id, fields);
    return Response.json({ message: "Book updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id } = await params;
    await deleteBook(orgId, id);
    return Response.json({ message: "Book deleted" });
  } catch (err) {
    return errResponse(err);
  }
}

// GET /api/books/[id] → returns a presigned read URL for the attached receipt
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id: key } = await params;
    // `id` here is actually the S3 key, passed as query param via rewrite — kept simple:
    // client calls /api/books/[id]?receiptKey=orgs/... and we return the signed url
    const url = new URL(_req.url);
    const receiptKey = url.searchParams.get("receiptKey");
    if (!receiptKey) return Response.json({ error: "receiptKey required" }, { status: 400 });

    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: receiptKey }),
      { expiresIn: 300 }
    );
    return Response.json({ url: signedUrl });
  } catch (err) {
    return errResponse(err);
  }
}
