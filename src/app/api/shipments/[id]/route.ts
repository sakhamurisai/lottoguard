import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { updateShipment, deleteShipment, listBooks, deleteBook } from "@/lib/db";

const patchSchema = z.object({
  orderNumber: z.string().optional(),
  shipmentNum: z.string().optional(),
  date:        z.string().optional(),
  notes:       z.string().optional(),
  totalBooks:  z.coerce.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id: shipmentId } = await params;
    const body = patchSchema.parse(await req.json());
    await updateShipment(orgId, shipmentId, { ...body, updatedAt: new Date().toISOString() });
    return Response.json({ message: "Shipment updated" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}

// DELETE: remove shipment + all its books
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwner();
    const { id: shipmentId } = await params;

    // Delete all books belonging to this shipment
    const allBooks = await listBooks(orgId);
    const shipmentBooks = allBooks.filter((b) => (b as { shipmentId?: string }).shipmentId === shipmentId);
    await Promise.all(shipmentBooks.map((b) => deleteBook(orgId, (b as { bookId: string }).bookId)));

    // Delete the shipment record itself
    await deleteShipment(orgId, shipmentId);

    return Response.json({ message: "Shipment deleted", booksDeleted: shipmentBooks.length });
  } catch (err) { return errResponse(err); }
}
