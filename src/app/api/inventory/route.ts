import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { listBooks, createBook } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const books = await listBooks(orgId);
    return Response.json({ books });
  } catch (err) { return errResponse(err); }
}

const schema = z.object({
  gameId:      z.string().min(1),
  gameName:    z.string().min(1),
  pack:        z.string().min(1),
  ticketStart: z.coerce.number().int().min(0),
  ticketEnd:   z.coerce.number().int().min(1),
  price:       z.coerce.number().positive(),
});

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const data = schema.parse(await req.json());
    const book = await createBook(orgId, data);
    return Response.json({ book }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.errors[0].message }, { status: 400 });
    return errResponse(err);
  }
}
