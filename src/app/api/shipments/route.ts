import { z } from "zod";
import { requireOwner, errResponse } from "@/lib/validate";
import { listShipments, createShipment } from "@/lib/db";

export async function GET() {
  try {
    const { orgId } = await requireOwner();
    const shipments = await listShipments(orgId);
    return Response.json({ shipments });
  } catch (err) { return errResponse(err); }
}

const schema = z.object({
  orderNumber:  z.string().optional(),
  shipmentNum:  z.string().optional(),
  date:         z.string().optional(),
  retailerNum:  z.string().optional(),
  totalBooks:   z.coerce.number().int().min(0).default(0),
  notes:        z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOwner();
    const data = schema.parse(await req.json());
    const shipment = await createShipment(orgId, data);
    return Response.json({ shipment }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
