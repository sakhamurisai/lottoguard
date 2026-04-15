import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { updateBook } from "@/lib/db";

const schema = z.object({
  status: z.enum(["active", "inactive", "settled"]),
  slot:   z.number().int().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const fields: Record<string, unknown> = { status: body.status };
    if (body.status === "active")   fields.activatedAt = new Date().toISOString();
    if (body.status === "settled")  { fields.settledAt = new Date().toISOString(); fields.slot = null; }
    if (body.slot !== undefined)    fields.slot = body.slot;

    await updateBook(orgId, id, fields);
    return Response.json({ message: "Book updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.errors[0].message }, { status: 400 });
    return errResponse(err);
  }
}
